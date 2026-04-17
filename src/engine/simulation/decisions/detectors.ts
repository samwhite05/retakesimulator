import {
  DecisionPoint,
  GameEvent,
  SimAgent,
  Scenario,
} from "@/types";
import type { SimState } from "../simState";
import { canSeeAgent } from "../vision";
import {
  createFirstContactDecision,
  createAllyDownDecision,
  createReconInfoDecision,
  createSpikeThresholdDecision,
  createLowHpDuelDecision,
  type DecisionFactoryContext,
} from "./catalog";

/**
 * Emergent decision detectors. Each function inspects the current SimState
 * (and optionally the most recent event) and returns a DecisionPoint to
 * pause the sim on, or null.
 *
 * The phase stepper calls these after every sub-step. Each detector is
 * responsible for memo-marking itself so it doesn't re-fire infinitely.
 */

function buildFactory(state: SimState, scenario: Scenario): DecisionFactoryContext {
  return {
    state,
    scenario,
    nextId() {
      state.decisionIdCounter = (state.decisionIdCounter || 0) + 1;
      return `dp-${state.decisionIdCounter}`;
    },
    turnIndex: state.turns.length,
  };
}

export interface DetectInput {
  state: SimState;
  scenario: Scenario;
  /** Events just emitted by the most recent sub-step (may be empty). */
  recentEvents: GameEvent[];
}

/**
 * First time any attacker gains line-of-sight to a defender post-setup.
 * Fires at most once per run.
 */
function detectFirstContact(input: DetectInput): DecisionPoint | null {
  const { state, scenario } = input;
  if (state.seenFirstContact) return null;

  const smokeSet = new Set(state.smokeTiles);
  const wallSet = new Set(state.wallTiles);

  const attackers = state.agents.filter((a) => a.alive && a.team === "attacker");
  const defenders = state.agents.filter((a) => a.alive && a.team === "defender" && !a.offAngle);

  for (const atk of attackers) {
    for (const def of defenders) {
      if (canSeeAgent(scenario.grid, atk, def, smokeSet, wallSet)) {
        state.seenFirstContact = true;
        return createFirstContactDecision(buildFactory(state, scenario), atk, def);
      }
    }
  }
  return null;
}

/**
 * Any attacker died during the last sub-step. Ally-down decision fires once
 * per distinct victim.
 */
function detectAllyDown(input: DetectInput): DecisionPoint | null {
  const { state, scenario, recentEvents } = input;
  for (const evt of recentEvents) {
    if (evt.type !== "kill") continue;
    const victim = state.agents.find((a) => a.agentId === evt.victim);
    if (!victim || victim.team !== "attacker") continue;
    if (state.seenAllyDowns.includes(evt.victim)) continue;
    state.seenAllyDowns.push(evt.victim);
    return createAllyDownDecision(buildFactory(state, scenario), victim);
  }
  return null;
}

/**
 * A reveal event popped during utility or movement. Attackers now know a
 * defender position — ask the player whether to exploit it.
 */
function detectReconInfo(input: DetectInput): DecisionPoint | null {
  const { state, scenario, recentEvents } = input;
  for (const evt of recentEvents) {
    if (evt.type !== "reveal") continue;
    if (state.seenReconReveals.includes(evt.revealedEnemy)) continue;
    state.seenReconReveals.push(evt.revealedEnemy);
    return createReconInfoDecision(buildFactory(state, scenario), evt.revealedEnemy, evt.agentId);
  }
  return null;
}

/**
 * Spike clock crossed a notable threshold (30s / 15s / 5s). Fires at most
 * once per threshold.
 */
function detectSpikeThreshold(input: DetectInput): DecisionPoint | null {
  const { state, scenario } = input;
  if (state.phase !== "spike" && state.phase !== "combat") return null;

  const thresholds = [30, 15];
  for (const t of thresholds) {
    if (state.seenSpikeThresholds.includes(t)) continue;
    if (state.spikeSecondsLeft <= t) {
      state.seenSpikeThresholds.push(t);
      const aliveAtk = state.agents.filter((a) => a.alive && a.team === "attacker").length;
      const aliveDef = state.agents.filter((a) => a.alive && a.team === "defender").length;
      if (aliveAtk === 0 || aliveDef === 0) return null;
      return createSpikeThresholdDecision(
        buildFactory(state, scenario),
        state.spikeSecondsLeft,
        aliveAtk,
        aliveDef
      );
    }
  }
  return null;
}

/**
 * Attacker about to take a duel at ≤40 HP. Fires once per agent per run.
 * Called from the combat stepper before `resolveCombat`.
 */
function detectLowHpDuel(
  state: SimState,
  scenario: Scenario,
  attacker: SimAgent,
  defender: SimAgent
): DecisionPoint | null {
  if (attacker.team !== "attacker") return null;
  if (attacker.hp > 40) return null;
  if (state.seenLowHpDuels.includes(attacker.agentId)) return null;
  state.seenLowHpDuels.push(attacker.agentId);
  return createLowHpDuelDecision(buildFactory(state, scenario), attacker, defender);
}

/**
 * Run all post-substep detectors in priority order. The first one to fire
 * wins. Ordering reflects narrative importance — ally_down trumps a
 * first_contact decision because the board just changed dramatically.
 */
export function runDetectors(input: DetectInput): DecisionPoint | null {
  return (
    detectAllyDown(input) ||
    detectReconInfo(input) ||
    detectSpikeThreshold(input) ||
    detectFirstContact(input) ||
    null
  );
}

/** Exposed so the combat stepper can check "before-duel" triggers explicitly. */
export const beforeDuel = {
  detectLowHpDuel,
};
