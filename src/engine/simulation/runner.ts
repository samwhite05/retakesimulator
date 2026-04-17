import {
  PlayerPlan,
  Scenario,
  SimulationLog,
  TurnLog,
  GameEvent,
  SimAgent,
  Outcome,
  RuleResult,
  OutcomeTier,
  TileCoord,
  GridMap,
  Position,
  AgentPosition,
  DecisionPoint,
  DecisionRecord,
} from "@/types";
import { posToTile, tileToPos, getTile, findPath, tileKey } from "./grid";
import { getAgentDef, GRID_COLS, GRID_ROWS } from "@/lib/constants";
import {
  resolveUtility,
  checkMollieDamage,
  checkTraps,
  AbilityContext,
} from "./abilities";
import { resolveCombat } from "./combat";
import { canSeeAgent, hasLineOfSight } from "./vision";
import { normalizePlayerPlan, type EffectivePlayerPlan } from "@/lib/normalizePlan";
import { computePathExposure } from "./exposure";
import {
  createRng,
  restoreRng,
  stringToSeed,
  type Rng,
} from "./rng";
import {
  SimState,
  StepResult,
  PendingMutation,
  phaseToLogKey,
} from "./simState";
import { runDetectors, beforeDuel } from "./decisions/detectors";
import {
  applyChoice,
  defaultChoiceId,
} from "./decisions/catalog";
import {
  gradeDecision,
  decisionScoreValue,
} from "./decisions/grading";

type DefuseMode = "wipe" | "uncontested" | "none";

const HIGH_EXPOSURE = 0.55;
const MED_EXPOSURE = 0.25;
const SPIKE_START_SECONDS = 45;

// ─── State bootstrap ────────────────────────────────────────────────────────

/**
 * Build a fresh `SimState` from a submitted plan. The plan is normalised
 * first (legacy wave fields → single continuous paths), agents spawn at
 * their planned tiles, and the defender roster is lifted from the scenario
 * (including hidden ones, which start `revealed = false`).
 */
export function initSimState(
  planInput: PlayerPlan,
  scenario: Scenario,
  seedInput?: number | string
): SimState {
  const plan = normalizePlayerPlan(planInput);
  const seed =
    typeof seedInput === "string"
      ? stringToSeed(seedInput)
      : seedInput ?? stringToSeed(`${plan.scenarioId}:${plan.createdAt}`);

  const agents: SimAgent[] = [];

  for (const ap of plan.agentPositions) {
    const def = getAgentDef(ap.agentId);
    if (!def) continue;
    agents.push({
      agentId: ap.agentId,
      team: "attacker",
      hp: 100,
      maxHp: 100,
      position: posToTile(ap.position),
      role: def.role,
      weapon: "vandal",
      alive: true,
      blinded: false,
      stunned: false,
      revealed: false,
    });
  }

  for (const e of [...scenario.enemyAgents, ...scenario.hiddenEnemies]) {
    const def = getAgentDef(e.agentId);
    agents.push({
      agentId: e.id,
      team: "defender",
      hp: 100,
      maxHp: 100,
      position: posToTile(e.position),
      role: def?.role || "sentinel",
      weapon: e.weapon || "phantom",
      alive: true,
      blinded: false,
      stunned: false,
      revealed: !e.isHidden,
      offAngle: e.offAngle || e.isHidden,
    });
  }

  return {
    plan,
    scenarioId: scenario.id,
    seed,
    rngState: seed,
    phase: "setup",
    utilityCursor: 0,
    movementCursor: 0,
    movementOrder: [],
    combat: {
      side: "attacker",
      index: 0,
      sortedAttackers: [],
      sortedDefenders: [],
      engagedDefenders: [],
    },
    spikeDone: false,
    agents,
    smokeTiles: [],
    wallTiles: [],
    mollieTiles: [],
    trapTiles: [],
    turns: [],
    decisionPoints: [],
    decisionHistory: [],
    seenFirstContact: false,
    seenAllyDowns: [],
    seenReconReveals: [],
    seenSpikeThresholds: [],
    seenLowHpDuels: [],
    spikeSecondsLeft: SPIKE_START_SECONDS,
    decisionIdCounter: 0,
    pendingMutations: [],
  };
}

// ─── Step function ──────────────────────────────────────────────────────────

/**
 * Advance the simulation by one or more sub-steps, pausing the moment an
 * emergent decision fires. The caller is expected to either:
 *   - pass `choiceId` + `timedOut` on the next call when the user makes a
 *     decision, or
 *   - persist the `SimState` and resume later.
 */
export function stepSimulation(
  state: SimState,
  scenario: Scenario,
  choice?: { choiceId: string; timedOut: boolean }
): StepResult {
  // If a decision was pending, resolve it first: grade the previous choice,
  // record it, and queue up the mutations. The effects land on the very next
  // sub-step so the phase stepper can consume them.
  if (state.pendingDecision && choice) {
    const decision = state.pendingDecision;
    const preSnapshot = cloneAgents(state.agents);

    const mutations = applyChoice(decision, choice.choiceId, state, scenario);
    state.pendingMutations.push(...mutations);

    // The grading is deferred until we've actually produced the follow-up
    // events — we stash the snapshot here so the grading at finalisation
    // can compare against it.
    state.decisionHistory.push({
      decision,
      chosenId: choice.choiceId,
      timedOut: choice.timedOut,
      grade: "acceptable",
      gradeReason: "pending",
    });
    // Tag the history entry with the snapshot via a side map kept on state.
    (state as SimState & { _preSnapshots?: Record<string, SimAgent[]> })._preSnapshots =
      (state as SimState & { _preSnapshots?: Record<string, SimAgent[]> })._preSnapshots || {};
    (state as SimState & { _preSnapshots?: Record<string, SimAgent[]> })._preSnapshots![decision.id] =
      preSnapshot;

    state.pendingDecision = undefined;
  }

  const segment: TurnLog[] = [];
  const segmentStartEvents: GameEvent[] = [];
  const rng = restoreRng(state.rngState);

  // Main loop: run one sub-step at a time, then check detectors.
  while (state.phase !== "done") {
    const stepEvents = runOneSubstep(state, scenario, rng);
    // Flush `stepEvents` into the appropriate TurnLog in both state.turns
    // and the current segment.
    pushEventsForCurrentPhase(state, segment, stepEvents);
    segmentStartEvents.push(...stepEvents);

    // Persist rng state immediately so a pause between iterations is safe.
    state.rngState = rng.export();

    // Check emergent decision triggers.
    const pending = runDetectors({
      state,
      scenario,
      recentEvents: stepEvents,
    });
    if (pending) {
      state.pendingDecision = pending;
      state.decisionPoints.push(pending);
      return { segment, pendingDecision: pending };
    }
  }

  // Run finalised — grade all decisions retrospectively and build outcome.
  finaliseDecisionGrades(state);
  return { segment, finalised: true };
}

// ─── Phase stepper ──────────────────────────────────────────────────────────

function runOneSubstep(state: SimState, scenario: Scenario, rng: Rng): GameEvent[] {
  switch (state.phase) {
    case "setup":
      return runSetupSubstep(state);
    case "utility":
      return runUtilitySubstep(state, scenario);
    case "movement":
      return runMovementSubstep(state, scenario);
    case "combat":
      return runCombatSubstep(state, scenario, rng);
    case "spike":
      return runSpikeSubstep(state, scenario);
    case "done":
      return [];
  }
}

function runSetupSubstep(state: SimState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const a of state.agents) {
    events.push({
      type: "agent_spawn",
      agentId: a.agentId,
      position: tileToPos(a.position),
    });
  }
  state.phase = "utility";
  state.utilityCursor = 0;
  return events;
}

function runUtilitySubstep(state: SimState, scenario: Scenario): GameEvent[] {
  // Drain pending mutations first — these are queued by decision choices and
  // fire _before_ the next utility step so injected utility shows up early.
  const mutationEvents = applyPendingMutations(state, scenario);

  if (state.utilityCursor >= state.plan.utilityPlacements.length) {
    // Transition to movement after last placement.
    state.phase = "movement";
    state.movementCursor = 0;
    state.movementOrder = computeMovementOrder(state);
    return mutationEvents;
  }

  const util = state.plan.utilityPlacements[state.utilityCursor];
  state.utilityCursor += 1;
  const ctx = buildAbilityContext(state, scenario);
  const events = resolveUtility(util, ctx);
  flushAbilityContext(state, ctx);
  return [...mutationEvents, ...events];
}

function runMovementSubstep(state: SimState, scenario: Scenario): GameEvent[] {
  const mutationEvents = applyPendingMutations(state, scenario);

  if (state.movementCursor >= state.movementOrder.length) {
    state.phase = "combat";
    state.combat = {
      side: "attacker",
      index: 0,
      sortedAttackers: computeAttackerOrder(state),
      sortedDefenders: state.agents
        .filter((a) => a.alive && a.team === "defender")
        .map((a) => a.agentId),
      engagedDefenders: [],
    };
    return mutationEvents;
  }

  const agentId = state.movementOrder[state.movementCursor];
  state.movementCursor += 1;

  const agent = state.agents.find((a) => a.agentId === agentId);
  if (!agent || !agent.alive) return mutationEvents;

  const mp = state.plan.movementPaths.find((p) => p.agentId === agentId);
  if (!mp || mp.path.length < 2) return mutationEvents;

  const ctx = buildAbilityContext(state, scenario);
  const events = runSingleAgentPath(agent, mp.path, state, scenario, ctx);
  flushAbilityContext(state, ctx);
  return [...mutationEvents, ...events];
}

function runCombatSubstep(state: SimState, scenario: Scenario, rng: Rng): GameEvent[] {
  const mutationEvents = applyPendingMutations(state, scenario);
  // The spike clock "burns" during combat — one tick per combat substep. This
  // keeps the `spike_threshold` detector in sync with the UX clock.
  state.spikeSecondsLeft = Math.max(0, state.spikeSecondsLeft - 5);

  const smokeSet = new Set(state.smokeTiles);
  const wallSet = new Set(state.wallTiles);

  if (state.combat.side === "attacker") {
    if (state.combat.index >= state.combat.sortedAttackers.length) {
      state.combat.side = "defender";
      state.combat.index = 0;
      return mutationEvents;
    }
    const attackerId = state.combat.sortedAttackers[state.combat.index];
    state.combat.index += 1;
    const attacker = state.agents.find((a) => a.agentId === attackerId);
    if (!attacker || !attacker.alive) return mutationEvents;

    // "Cancel next duel" mutation lets decisions make an agent skip their peek.
    const skipIdx = state.pendingMutations.findIndex(
      (m) => m.kind === "cancel_next_duel_for" && m.agentId === attackerId
    );
    if (skipIdx !== -1) {
      state.pendingMutations.splice(skipIdx, 1);
      return mutationEvents;
    }

    const target = pickVisibleTarget(
      attacker,
      state.agents.filter((a) => a.alive && a.team === "defender"),
      scenario.grid,
      smokeSet,
      wallSet,
      state.combat.engagedDefenders
    );
    if (!target) return mutationEvents;

    // Emergent low-HP duel check BEFORE the duel rolls.
    const pause = beforeDuel.detectLowHpDuel(state, scenario, attacker, target);
    if (pause) {
      // Rewind the cursor so after the decision resumes, we re-attempt this
      // same attacker (and honour a possible "cancel" mutation).
      state.combat.index -= 1;
      state.pendingDecision = pause;
      state.decisionPoints.push(pause);
      return mutationEvents;
    }

    state.combat.engagedDefenders.push(target.agentId);
    const adv = consumeStimAdvantage(state, attacker.agentId);
    // A blinded defender's next duel is heavily skewed — consumed on use.
    const blindBonus = target.blinded ? 28 : 0;
    if (target.blinded) target.blinded = false;
    const { events } = rollDuel(attacker, target, {
      grid: scenario.grid,
      smokeTiles: smokeSet,
      wallTiles: wallSet,
      rng,
      advantageBonus: adv + blindBonus,
    });
    return [...mutationEvents, ...events];
  }

  // Defender side — unengaged defenders that see attackers return fire.
  if (state.combat.index >= state.combat.sortedDefenders.length) {
    state.phase = "spike";
    state.spikeDone = false;
    return mutationEvents;
  }
  const defenderId = state.combat.sortedDefenders[state.combat.index];
  state.combat.index += 1;
  const defender = state.agents.find((a) => a.agentId === defenderId);
  if (!defender || !defender.alive) return mutationEvents;
  if (state.combat.engagedDefenders.includes(defenderId)) return mutationEvents;

  const visibleAttackers = state.agents.filter(
    (a) => a.alive && a.team === "attacker" && canSeeAgent(scenario.grid, defender, a, smokeSet, wallSet)
  );
  if (visibleAttackers.length === 0) return mutationEvents;
  const target = visibleAttackers[0];
  const adv = consumeStimAdvantage(state, target.agentId); // attacker benefits from their own stims
  const { events } = rollDuel(defender, target, {
    grid: scenario.grid,
    smokeTiles: smokeSet,
    wallTiles: wallSet,
    rng,
    advantageBonus: -adv,
  });
  return [...mutationEvents, ...events];
}

function runSpikeSubstep(state: SimState, scenario: Scenario): GameEvent[] {
  const mutationEvents = applyPendingMutations(state, scenario);
  if (state.spikeDone) {
    state.phase = "done";
    return mutationEvents;
  }

  const smokeSet = new Set(state.smokeTiles);
  const wallSet = new Set(state.wallTiles);
  const aliveAttackers = state.agents.filter((a) => a.alive && a.team === "attacker");
  const aliveDefenders = state.agents.filter((a) => a.alive && a.team === "defender");
  const spikeTile = posToTile(scenario.spikeSite);

  const { events: spikeEvents } = resolveSpikePhase(
    state.agents,
    aliveAttackers,
    aliveDefenders,
    scenario.grid,
    smokeSet,
    wallSet,
    spikeTile,
    scenario.spikeSite
  );
  state.spikeDone = true;
  state.phase = "done";
  return [...mutationEvents, ...spikeEvents];
}

// ─── Movement helpers ───────────────────────────────────────────────────────

function computeMovementOrder(state: SimState): string[] {
  const entries = state.plan.movementPaths
    .map((mp) => {
      const agent = state.agents.find((a) => a.agentId === mp.agentId && a.alive);
      if (!agent) return null;
      if (mp.path.length < 2) return null;
      return { id: mp.agentId, len: mp.path.length };
    })
    .filter(Boolean) as { id: string; len: number }[];
  return entries.sort((a, b) => a.len - b.len).map((e) => e.id);
}

function runSingleAgentPath(
  agent: SimAgent,
  rawPath: Position[],
  state: SimState,
  scenario: Scenario,
  ctx: AbilityContext
): GameEvent[] {
  const events: GameEvent[] = [];
  const def = getAgentDef(agent.agentId);
  const role = def?.role || "initiator";
  const isDash = state.plan.utilityPlacements.some(
    (u) => u.agentId === agent.agentId && u.type === "dash"
  );
  const start = agent.position;
  const end = posToTile(rawPath[rawPath.length - 1]);
  const computedPath = findPath(scenario.grid, start, end, role, ctx.wallTiles, {
    maxCost: 9999,
  });
  const finalPath =
    computedPath && computedPath.length > 1 ? computedPath : rawPath.map(posToTile);

  const exposureReport = computePathExposure(
    scenario,
    tileToPos(start),
    rawPath,
    state.plan.utilityPlacements
  );

  if (exposureReport.averageExposure >= HIGH_EXPOSURE) {
    const defender = pickWatchingDefender(agent, scenario, ctx.smokeTiles, ctx.wallTiles);
    if (defender) {
      agent.hp = 0;
      agent.alive = false;
      events.push({
        type: "duel",
        attacker: defender.agentId,
        defender: agent.agentId,
        winner: defender.agentId,
        damage: 100,
      });
      events.push({
        type: "kill",
        victim: agent.agentId,
        position: tileToPos(finalPath[Math.floor(finalPath.length / 2)] ?? end),
        killer: defender.agentId,
      });
      return events;
    }
  } else if (exposureReport.averageExposure >= MED_EXPOSURE) {
    agent.hp = Math.max(1, agent.hp - 40);
  }

  agent.position = finalPath[finalPath.length - 1];
  events.push({
    type: "agent_move",
    agentId: agent.agentId,
    path: finalPath.map(tileToPos),
    speed: isDash ? "dash" : "walk",
  });
  events.push(...checkMollieDamage(agent, ctx));
  events.push(...checkTraps(agent, ctx));
  return events;
}

// ─── Combat helpers ─────────────────────────────────────────────────────────

function computeAttackerOrder(state: SimState): string[] {
  const rolePriority: Record<string, number> = {
    initiator: 0,
    duelist: 1,
    controller: 2,
    sentinel: 3,
  };
  return state.agents
    .filter((a) => a.alive && a.team === "attacker")
    .slice()
    .sort((a, b) => (rolePriority[a.role] || 2) - (rolePriority[b.role] || 2))
    .map((a) => a.agentId);
}

function pickVisibleTarget(
  attacker: SimAgent,
  defenders: SimAgent[],
  grid: GridMap,
  smokeSet: Set<string>,
  wallSet: Set<string>,
  engaged: string[]
): SimAgent | null {
  const visible = defenders.filter(
    (d) => !engaged.includes(d.agentId) && canSeeAgent(grid, attacker, d, smokeSet, wallSet)
  );
  if (visible.length === 0) return null;
  return visible.sort(
    (a, b) =>
      Math.abs(a.position.col - attacker.position.col) +
      Math.abs(a.position.row - attacker.position.row) -
      (Math.abs(b.position.col - attacker.position.col) +
        Math.abs(b.position.row - attacker.position.row))
  )[0];
}

interface DuelCtx {
  grid: GridMap;
  smokeTiles: Set<string>;
  wallTiles: Set<string>;
  rng: Rng;
  advantageBonus: number;
}

/**
 * Local wrapper around `resolveCombat` that folds in decision-driven
 * advantage boosts (eg. "Commit · Push" = +15 advantage on the next duel).
 */
function rollDuel(attacker: SimAgent, defender: SimAgent, ctx: DuelCtx) {
  const result = resolveCombat(attacker, defender, {
    grid: ctx.grid,
    smokeTiles: ctx.smokeTiles,
    wallTiles: ctx.wallTiles,
    rng: ctx.rng,
  });
  if (ctx.advantageBonus !== 0) {
    // If the attacker had a stim advantage, give them a re-roll chance: if
    // they lost the initial duel and the bonus would flip the result, flip it.
    const loser = result.loser;
    const winner = result.winner;
    const bias = ctx.advantageBonus / 100;
    if (loser === attacker && ctx.rng.chance(Math.max(0, bias))) {
      // Re-assign winner
      loser.hp = 100;
      loser.alive = true;
      winner.hp = Math.max(0, winner.hp - result.damage);
      if (winner.hp <= 0) winner.alive = false;
      // Rewrite the trailing duel event and kill event accordingly.
      return {
        events: [
          {
            type: "duel" as const,
            attacker: attacker.agentId,
            defender: defender.agentId,
            winner: attacker.agentId,
            damage: result.damage,
          },
          ...(winner.alive
            ? []
            : [
                {
                  type: "kill" as const,
                  victim: winner.agentId,
                  killer: attacker.agentId,
                  position: {
                    x: (winner.position.col + 0.5) / GRID_COLS,
                    y: (winner.position.row + 0.5) / GRID_ROWS,
                  },
                },
              ]),
        ],
      };
    }
  }
  return { events: result.events };
}

/**
 * Shift `agent` a short distance toward `toward`, clamped to the grid and
 * respecting wall tiles. Emits the `agent_move` event that the cinematic
 * animates so the player can see the veer happen immediately after their
 * decision lands.
 *
 * `distance` is expressed in tiles (e.g. 1.5 = move ~1–2 tiles).
 */
function veerAgent(
  agent: SimAgent,
  toward: Position,
  distance: number,
  scenario: Scenario
): GameEvent | null {
  const from = tileToPos(agent.position);
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-4) return null;
  const stepNorm = distance / GRID_COLS;
  const ratio = Math.min(1, stepNorm / mag);
  const targetPos: Position = {
    x: Math.max(0, Math.min(1, from.x + dx * ratio)),
    y: Math.max(0, Math.min(1, from.y + dy * ratio)),
  };
  // Nudge away from walls — try the proposed tile, then back off if blocked.
  let targetTile = posToTile(targetPos);
  const tryTile = getTile(scenario.grid, targetTile);
  if (!tryTile || tryTile.type === "wall") {
    // Fall back to half-distance toward target.
    const half = {
      x: Math.max(0, Math.min(1, from.x + dx * ratio * 0.5)),
      y: Math.max(0, Math.min(1, from.y + dy * ratio * 0.5)),
    };
    targetTile = posToTile(half);
    const fallback = getTile(scenario.grid, targetTile);
    if (!fallback || fallback.type === "wall") return null;
    agent.position = targetTile;
    return {
      type: "agent_move",
      agentId: agent.agentId,
      path: [from, half],
      speed: "walk",
    };
  }
  agent.position = targetTile;
  return {
    type: "agent_move",
    agentId: agent.agentId,
    path: [from, targetPos],
    speed: "walk",
  };
}

function consumeStimAdvantage(state: SimState, agentId: string): number {
  let total = 0;
  state.pendingMutations = state.pendingMutations.filter((m) => {
    if (m.kind === "stim_advantage" && m.agentId === agentId) {
      total += m.amount;
      return false;
    }
    return true;
  });
  return total;
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function applyPendingMutations(state: SimState, scenario: Scenario): GameEvent[] {
  if (state.pendingMutations.length === 0) return [];
  const events: GameEvent[] = [];
  const remaining: PendingMutation[] = [];
  const ctx = buildAbilityContext(state, scenario);

  for (const m of state.pendingMutations) {
    switch (m.kind) {
      case "inject_smoke": {
        const tile = posToTile(m.position);
        const radius = Math.max(1, m.radius);
        const tiles: TileCoord[] = [];
        for (let dr = -Math.ceil(radius); dr <= Math.ceil(radius); dr++) {
          for (let dc = -Math.ceil(radius); dc <= Math.ceil(radius); dc++) {
            if (dr * dr + dc * dc <= radius * radius) {
              tiles.push({ col: tile.col + dc, row: tile.row + dr });
            }
          }
        }
        for (const t of tiles) {
          ctx.smokeTiles.add(tileKey(t));
        }
        events.push({
          type: "smoke_expand",
          agentId: m.agentId,
          position: m.position,
          radius,
        });
        break;
      }
      case "inject_mollie": {
        const tile = posToTile(m.position);
        const radius = Math.max(1, m.radius);
        for (let dr = -Math.ceil(radius); dr <= Math.ceil(radius); dr++) {
          for (let dc = -Math.ceil(radius); dc <= Math.ceil(radius); dc++) {
            if (dr * dr + dc * dc <= radius * radius) {
              ctx.mollieTiles.add(tileKey({ col: tile.col + dc, row: tile.row + dr }));
            }
          }
        }
        events.push({
          type: "mollie_erupt",
          agentId: m.agentId,
          position: m.position,
          radius,
        });
        break;
      }
      case "reposition_agent": {
        const a = state.agents.find((x) => x.agentId === m.agentId);
        if (a && a.alive) {
          const from = tileToPos(a.position);
          const targetTile = posToTile(m.position);
          // Respect walkability — fall back to staying put if blocked.
          const tile = getTile(scenario.grid, targetTile);
          if (tile && tile.type !== "wall") {
            a.position = targetTile;
            events.push({
              type: "agent_move",
              agentId: a.agentId,
              path: [from, m.position],
              speed: "walk",
            });
          }
        }
        break;
      }
      case "path_veer": {
        const a = state.agents.find((x) => x.agentId === m.agentId);
        if (a && a.alive) {
          const ve = veerAgent(a, m.toward, m.distance, scenario);
          if (ve) events.push(ve);
        }
        break;
      }
      case "group_push": {
        for (const aid of m.agentIds) {
          const a = state.agents.find((x) => x.agentId === aid);
          if (!a || !a.alive) continue;
          const ve = veerAgent(a, m.toward, m.distance, scenario);
          if (ve) events.push(ve);
          if (m.stim && m.stim > 0) {
            // Defer the stim onto the pending queue so it's consumed by the
            // combat stepper on the very next duel for that agent.
            remaining.push({ kind: "stim_advantage", agentId: aid, amount: m.stim });
          }
        }
        break;
      }
      case "inject_flash": {
        const tile = posToTile(m.position);
        const radius = 3;
        for (const a of state.agents) {
          if (a.team !== "defender" || !a.alive) continue;
          const dc = a.position.col - tile.col;
          const dr = a.position.row - tile.row;
          if (dc * dc + dr * dr <= radius * radius) {
            a.blinded = true;
          }
        }
        events.push({
          type: "flash_detonate",
          agentId: m.agentId,
          position: m.position,
          angle: m.angle ?? 0,
        });
        break;
      }
      case "blind_defender": {
        const d = state.agents.find((x) => x.agentId === m.defenderId);
        if (d && d.alive && d.team === "defender") {
          d.blinded = true;
        }
        break;
      }
      case "swap_duel_order": {
        const sorted = state.combat.sortedAttackers;
        const from = sorted.indexOf(m.firstAgentId);
        if (from !== -1 && from > state.combat.index) {
          const [id] = sorted.splice(from, 1);
          sorted.splice(state.combat.index, 0, id);
        }
        break;
      }
      case "reveal_defender": {
        const d = state.agents.find((x) => x.agentId === m.defenderId);
        if (d) {
          d.revealed = true;
          events.push({
            type: "reveal",
            agentId: "recon",
            position: tileToPos(d.position),
            revealedEnemy: d.agentId,
          });
        }
        break;
      }
      case "stim_advantage":
      case "cancel_next_duel_for":
        // Consumed lazily by combat stepper; keep queued.
        remaining.push(m);
        break;
      case "force_defuse_attempt": {
        // Mark the spike as resolved with a best-effort defuse — actual logic
        // still runs through `runSpikeSubstep`, but we force the attackers to
        // go for defuse now by advancing combat.
        state.combat.side = "defender";
        state.combat.index = state.combat.sortedDefenders.length; // short-circuit
        break;
      }
      case "abort_retake":
        state.phase = "done";
        break;
    }
  }

  flushAbilityContext(state, ctx);
  state.pendingMutations = remaining;
  return events;
}

// ─── Ability context plumbing ───────────────────────────────────────────────

function buildAbilityContext(state: SimState, scenario: Scenario): AbilityContext {
  return {
    grid: scenario.grid,
    smokeTiles: new Set(state.smokeTiles),
    wallTiles: new Set(state.wallTiles),
    mollieTiles: new Set(state.mollieTiles),
    trapTiles: new Map(state.trapTiles),
    agents: state.agents,
  };
}

function flushAbilityContext(state: SimState, ctx: AbilityContext): void {
  state.smokeTiles = Array.from(ctx.smokeTiles);
  state.wallTiles = Array.from(ctx.wallTiles);
  state.mollieTiles = Array.from(ctx.mollieTiles);
  state.trapTiles = Array.from(ctx.trapTiles.entries());
}

// ─── Log plumbing ───────────────────────────────────────────────────────────

function pushEventsForCurrentPhase(
  state: SimState,
  segment: TurnLog[],
  events: GameEvent[]
): void {
  if (events.length === 0) return;
  const phaseKey = phaseToLogKey(state.phase);
  mergeIntoTurn(state.turns, phaseKey, events);
  mergeIntoTurn(segment, phaseKey, events);
}

function mergeIntoTurn(turns: TurnLog[], phase: TurnLog["phase"], events: GameEvent[]): void {
  const last = turns[turns.length - 1];
  if (last && last.phase === phase) {
    last.events.push(...events);
  } else {
    turns.push({ phase, events: [...events] });
  }
}

// ─── Spike + outcome ────────────────────────────────────────────────────────

function pickWatchingDefender(
  attacker: SimAgent,
  scenario: Scenario,
  smokeTiles: Set<string>,
  wallTiles: Set<string>
): { agentId: string } | null {
  for (const e of scenario.enemyAgents) {
    if (e.isHidden) continue;
    const eTile = posToTile(e.position);
    if (hasLineOfSight(scenario.grid, eTile, attacker.position, smokeTiles, wallTiles)) {
      return { agentId: e.id };
    }
  }
  return scenario.enemyAgents[0] ? { agentId: scenario.enemyAgents[0].id } : null;
}

function pickDefuserOnSpikeSite(
  agents: SimAgent[],
  grid: GridMap,
  spikeNorm: Position
): SimAgent | null {
  const onSite = agents.filter(
    (a) => a.alive && a.team === "attacker" && getTile(grid, a.position)?.type === "spike_zone"
  );
  if (onSite.length === 0) return null;
  const st = posToTile(spikeNorm);
  const manhattan = (a: SimAgent) =>
    Math.abs(a.position.col - st.col) + Math.abs(a.position.row - st.row);
  return [...onSite].sort((a, b) => manhattan(a) - manhattan(b))[0];
}

function resolveSpikePhase(
  agents: SimAgent[],
  aliveAttackers: SimAgent[],
  aliveDefenders: SimAgent[],
  grid: GridMap,
  smokeTiles: Set<string>,
  wallTiles: Set<string>,
  spikeTile: TileCoord,
  spikeSite: Position
): { events: GameEvent[]; spikeDefused: boolean; defuseMode: DefuseMode } {
  const events: GameEvent[] = [];

  if (aliveAttackers.length === 0) {
    events.push({ type: "spike_explosion", position: tileToPos(spikeTile) });
    return { events, spikeDefused: false, defuseMode: "none" };
  }

  if (aliveDefenders.length === 0) {
    const defuser = [...aliveAttackers].sort(
      (a, b) =>
        Math.abs(a.position.col - spikeTile.col) +
        Math.abs(a.position.row - spikeTile.row) -
        (Math.abs(b.position.col - spikeTile.col) + Math.abs(b.position.row - spikeTile.row))
    )[0];
    events.push({
      type: "defuse_start",
      agentId: defuser.agentId,
      position: tileToPos(defuser.position),
    });
    events.push({
      type: "defuse_complete",
      agentId: defuser.agentId,
      position: tileToPos(defuser.position),
    });
    return { events, spikeDefused: true, defuseMode: "wipe" };
  }

  const tapper = pickDefuserOnSpikeSite(agents, grid, spikeSite);
  if (tapper) {
    const contested = aliveDefenders.some((d) =>
      hasLineOfSight(grid, d.position, tapper.position, smokeTiles, wallTiles)
    );
    if (!contested) {
      events.push({
        type: "defuse_start",
        agentId: tapper.agentId,
        position: tileToPos(tapper.position),
      });
      events.push({
        type: "defuse_complete",
        agentId: tapper.agentId,
        position: tileToPos(tapper.position),
      });
      return { events, spikeDefused: true, defuseMode: "uncontested" };
    }
  }

  events.push({ type: "spike_explosion", position: tileToPos(spikeTile) });
  return { events, spikeDefused: false, defuseMode: "none" };
}

// ─── Finalisation ───────────────────────────────────────────────────────────

function finaliseDecisionGrades(state: SimState): void {
  const preSnapshots =
    ((state as SimState & { _preSnapshots?: Record<string, SimAgent[]> })._preSnapshots) || {};
  const decisions = state.decisionHistory;
  for (let i = 0; i < decisions.length; i++) {
    const entry = decisions[i];
    if (entry.gradeReason !== "pending") continue;
    const pre = preSnapshots[entry.decision.id] || cloneAgents(state.agents);
    const post = collectEventsAfterDecision(state, entry.decision.id, i, decisions);
    const graded = gradeDecision({
      decision: entry.decision,
      chosenId: entry.chosenId,
      timedOut: entry.timedOut,
      preSnapshot: pre,
      postSegmentEvents: post,
      stateAfter: state,
    });
    decisions[i] = graded;
  }
}

function collectEventsAfterDecision(
  state: SimState,
  decisionId: string,
  decisionIndex: number,
  decisions: DecisionRecord[]
): GameEvent[] {
  // Events are not tagged per decision; we approximate by collecting
  // everything after this decision's triggeredBy turnIndex up to either the
  // next decision's turnIndex or end.
  const fromTurn = findDecisionTurnIndex(state, decisionId);
  const nextDecision = decisions[decisionIndex + 1];
  const toTurn = nextDecision
    ? findDecisionTurnIndex(state, nextDecision.decision.id)
    : state.turns.length;
  const out: GameEvent[] = [];
  for (let i = fromTurn; i < toTurn; i++) {
    const turn = state.turns[i];
    if (!turn) continue;
    out.push(...turn.events);
  }
  return out;
}

function findDecisionTurnIndex(state: SimState, decisionId: string): number {
  const dp = state.decisionPoints.find((d) => d.id === decisionId);
  if (!dp) return 0;
  return Math.min(dp.triggeredBy.turnIndex, state.turns.length);
}

function cloneAgents(agents: SimAgent[]): SimAgent[] {
  return agents.map((a) => ({ ...a, position: { ...a.position } }));
}

// ─── Outcome + public wrapper ───────────────────────────────────────────────

export function buildFinalLog(state: SimState, scenario: Scenario): SimulationLog {
  const outcome = generateOutcome(state, scenario);
  return {
    turns: state.turns,
    finalState: {
      agents: state.agents,
      spikeDefused: state.turns.some((t) =>
        t.events.some((e) => e.type === "defuse_complete")
      ),
    },
    outcome,
    decisionPoints: state.decisionPoints,
    decisionHistory: state.decisionHistory,
  };
}

function generateOutcome(state: SimState, scenario: Scenario): Outcome {
  const spikeDefused = state.turns.some((t) =>
    t.events.some((e) => e.type === "defuse_complete")
  );
  const defuseEvent = findLastDefuseEvent(state);
  const defuseMode: DefuseMode = !spikeDefused
    ? "none"
    : state.agents.filter((a) => a.alive && a.team === "defender").length === 0
      ? "wipe"
      : "uncontested";

  const ruleResults: RuleResult[] = [];
  let totalEarned = 0;
  let totalMax = 0;

  const aliveAttackers = state.agents.filter((a) => a.alive && a.team === "attacker");
  const aliveDefenders = state.agents.filter((a) => a.alive && a.team === "defender");
  const killedDefenders = state.agents.filter((a) => !a.alive && a.team === "defender").length;
  const attackerDeaths = state.agents.filter((a) => !a.alive && a.team === "attacker").length;

  const rules = scenario.rules;

  const defuseRule = rules.find((r) => r.id === "spike_defused") || {
    id: "spike_defused",
    description: "Defuse the spike",
    category: "critical" as const,
    points: 40,
  };
  const defusePassed = spikeDefused;
  let defuseDetail = "Spike successfully defused";
  if (defusePassed) {
    if (defuseMode === "uncontested" && aliveDefenders.length > 0) {
      defuseDetail = "Spike defused — not contestable (defenders alive but no line to defuser)";
    } else if (defuseMode === "wipe") {
      defuseDetail = "Spike defused — site cleared";
    }
  } else {
    defuseDetail =
      aliveAttackers.length === 0
        ? "No attackers alive to defuse"
        : aliveDefenders.length > 0
          ? "Spike detonates — defuse still contested"
          : "Spike detonates";
  }
  ruleResults.push({
    ruleId: defuseRule.id,
    description: defuseRule.description,
    category: defuseRule.category,
    maxPoints: defuseRule.points,
    earnedPoints: defusePassed ? defuseRule.points : 0,
    passed: defusePassed,
    detail: defuseDetail,
  });
  totalEarned += defusePassed ? defuseRule.points : 0;
  totalMax += defuseRule.points;

  const casualtyRule = rules.find((r) => r.id === "minimize_casualties") || {
    id: "minimize_casualties",
    description: "Keep your team alive",
    category: "important" as const,
    points: 25,
  };
  const casualtyPassed = attackerDeaths === 0;
  const casualtyPartial = attackerDeaths === 1 ? 15 : 0;
  ruleResults.push({
    ruleId: casualtyRule.id,
    description: casualtyRule.description,
    category: casualtyRule.category,
    maxPoints: casualtyRule.points,
    earnedPoints: casualtyPassed ? casualtyRule.points : casualtyPartial,
    passed: casualtyPassed,
    detail: casualtyPassed
      ? "Full team survived"
      : attackerDeaths === 1
        ? "One agent lost"
        : `${attackerDeaths} agents lost`,
  });
  totalEarned += casualtyPassed ? casualtyRule.points : casualtyPartial;
  totalMax += casualtyRule.points;

  const clearRule = rules.find((r) => r.id === "clear_defenders") || {
    id: "clear_defenders",
    description: "Win gunfights (eliminate defenders)",
    category: "important" as const,
    points: 20,
  };
  const defenderTotal = scenario.enemyAgents.length + scenario.hiddenEnemies.length;
  const clearPassed = killedDefenders >= defenderTotal;
  const clearPartial = Math.floor((killedDefenders / defenderTotal) * clearRule.points);
  ruleResults.push({
    ruleId: clearRule.id,
    description: clearRule.description,
    category: clearRule.category,
    maxPoints: clearRule.points,
    earnedPoints: clearPassed ? clearRule.points : clearPartial,
    passed: clearPassed,
    detail: clearPassed
      ? "All defenders eliminated"
      : `${killedDefenders}/${defenderTotal} defenders eliminated`,
  });
  totalEarned += clearPassed ? clearRule.points : clearPartial;
  totalMax += clearRule.points;

  const utilRule = rules.find((r) => r.id === "utility_efficiency") || {
    id: "utility_efficiency",
    description: "Use utility effectively",
    category: "minor" as const,
    points: 15,
  };
  const totalAvailable = scenario.availableUtility.reduce((sum, u) => sum + u.charges, 0);
  const totalUsed = state.plan.utilityPlacements.length;
  const utilRatio = totalAvailable > 0 ? totalUsed / totalAvailable : 1;
  const utilPassed = utilRatio >= 0.5;
  const utilScore = Math.min(15, Math.round(utilRatio * 15));
  ruleResults.push({
    ruleId: utilRule.id,
    description: utilRule.description,
    category: utilRule.category,
    maxPoints: utilRule.points,
    earnedPoints: utilScore,
    passed: utilPassed,
    detail: `${totalUsed}/${totalAvailable} utility charges used`,
  });
  totalEarned += utilScore;
  totalMax += utilRule.points;

  // Decision rollup: add a "live calls" rule covering the decision grades.
  let decisionScore = 0;
  const decisionMax = Math.max(1, state.decisionHistory.length) * 10;
  for (const d of state.decisionHistory) {
    decisionScore += decisionScoreValue(d.grade, 10);
  }
  const decisionRuleMax = state.decisionHistory.length > 0 ? decisionMax : 0;
  if (state.decisionHistory.length > 0) {
    const passed = decisionScore >= decisionMax / 2;
    ruleResults.push({
      ruleId: "live_calls",
      description: "Live tactical calls",
      category: "important",
      maxPoints: decisionRuleMax,
      earnedPoints: decisionScore,
      passed,
      detail: `${state.decisionHistory.filter((d) => d.grade === "optimal").length} optimal · ${state.decisionHistory.filter((d) => d.grade === "acceptable").length} acceptable · ${state.decisionHistory.filter((d) => d.grade === "bad").length} bad`,
    });
    totalEarned += decisionScore;
    totalMax += decisionRuleMax;
  }

  const score = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const tier: OutcomeTier = score >= 80 ? "clean" : score >= 50 ? "messy" : "failed";

  const highlights = ruleResults.filter((r) => r.passed).map((r) => r.detail);
  const mistakes = ruleResults.filter((r) => !r.passed).map((r) => r.detail);

  let summary = "";
  if (tier === "clean") summary = "Clean retake — excellent game sense!";
  else if (tier === "messy")
    summary = spikeDefused
      ? "Messy but successful — spike defused"
      : "Messy retake — spike still contested";
  else summary = "Retake failed — spike detonated or team wiped";

  return {
    score,
    maxScore: totalMax,
    scoreBreakdown: ruleResults,
    tier,
    summary,
    highlights,
    mistakes,
    decisionGrades: state.decisionHistory,
    decisionScore,
    decisionMaxScore: decisionRuleMax,
  };
}

function findLastDefuseEvent(state: SimState): GameEvent | null {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const turn = state.turns[i];
    for (let j = turn.events.length - 1; j >= 0; j--) {
      const e = turn.events[j];
      if (e.type === "defuse_complete" || e.type === "spike_explosion") return e;
    }
  }
  return null;
}

// ─── Backwards-compat: run the whole sim taking default choices ─────────────

/**
 * Fully deterministic run that takes the default choice on every decision.
 * Kept for `POST /api/plans` preview + scripts that want a single-call sim.
 */
export function runSimulation(
  planInput: PlayerPlan,
  scenario: Scenario
): { log: SimulationLog; outcome: Outcome } {
  const state = initSimState(planInput, scenario);
  while (true) {
    const step = stepSimulation(
      state,
      scenario,
      state.pendingDecision
        ? { choiceId: defaultChoiceId(state.pendingDecision), timedOut: true }
        : undefined
    );
    if (step.finalised) break;
  }
  const log = buildFinalLog(state, scenario);
  return { log, outcome: log.outcome };
}

/**
 * Legacy entry-phase preview used by the old planning UI.
 * Produces setup + utility + movement only and a placeholder outcome.
 */
export function runPhase1Preview(
  planInput: PlayerPlan,
  scenario: Scenario
): { log: SimulationLog; attackerPositions: AgentPosition[] } {
  const state = initSimState(planInput, scenario);
  // Drive until phase === "combat" — that's the pre-contact snapshot.
  while (state.phase !== "combat" && state.phase !== "done") {
    stepSimulation(
      state,
      scenario,
      state.pendingDecision
        ? { choiceId: defaultChoiceId(state.pendingDecision), timedOut: true }
        : undefined
    );
  }

  const attackerPositions: AgentPosition[] = state.agents
    .filter((a) => a.team === "attacker")
    .map((a) => ({ agentId: a.agentId, position: tileToPos(a.position) }));

  const previewOutcome: Outcome = {
    score: 0,
    maxScore: 1,
    scoreBreakdown: [],
    tier: "failed",
    summary: "Entry preview",
    highlights: [],
    mistakes: [],
  };

  return {
    log: {
      turns: state.turns,
      finalState: {
        agents: state.agents,
        spikeDefused: false,
      },
      outcome: previewOutcome,
    },
    attackerPositions,
  };
}
