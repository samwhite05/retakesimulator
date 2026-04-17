import {
  DecisionGrade,
  DecisionPoint,
  DecisionRecord,
  GameEvent,
  SimAgent,
} from "@/types";
import type { SimState } from "../simState";

/**
 * Grade a decision retrospectively by inspecting what happened *after* the
 * choice was applied. The heuristics are intentionally simple so they're
 * easy to tune per-kind as we watch real runs.
 *
 * A decision is graded by comparing:
 *  - pre-choice agent snapshot: SimAgent[] at the moment the decision fired
 *  - post-segment events: everything emitted between this decision and the
 *    next decision (or end of run)
 *
 * Output is one of `optimal | acceptable | bad` with a short reason string
 * shown on the results screen.
 */

export interface GradingInput {
  decision: DecisionPoint;
  chosenId: string;
  timedOut: boolean;
  preSnapshot: SimAgent[];
  postSegmentEvents: GameEvent[];
  stateAfter: SimState;
}

function countKillsByTeam(
  events: GameEvent[],
  victimTeam: "attacker" | "defender",
  pre: SimAgent[]
): number {
  const teamSet = new Set(pre.filter((a) => a.team === victimTeam).map((a) => a.agentId));
  return events.filter((e) => e.type === "kill" && teamSet.has(e.victim)).length;
}

function gradeFirstContact(input: GradingInput): { grade: DecisionGrade; reason: string } {
  const defenderKills = countKillsByTeam(input.postSegmentEvents, "defender", input.preSnapshot);
  const attackerKills = countKillsByTeam(input.postSegmentEvents, "attacker", input.preSnapshot);
  if (input.chosenId === "commit_push") {
    if (defenderKills >= 1 && attackerKills === 0) return { grade: "optimal", reason: "Won the opening duel clean" };
    if (defenderKills >= 1 && attackerKills <= 1) return { grade: "acceptable", reason: "Traded into a defender" };
    return { grade: "bad", reason: "Pushed into an over-extended angle" };
  }
  if (input.chosenId === "hold_flood") {
    if (attackerKills === 0) return { grade: "optimal", reason: "Smoke denied the angle — no trade" };
    return { grade: "acceptable", reason: "Flooded but still lost body" };
  }
  if (input.chosenId === "fall_back") {
    if (attackerKills === 0) return { grade: "acceptable", reason: "Reset safely, lost tempo" };
    return { grade: "bad", reason: "Reset into another angle, still lost body" };
  }
  return { grade: "acceptable", reason: "Played the read" };
}

function gradeAllyDown(input: GradingInput): { grade: DecisionGrade; reason: string } {
  const defenderKills = countKillsByTeam(input.postSegmentEvents, "defender", input.preSnapshot);
  const attackerKills = countKillsByTeam(input.postSegmentEvents, "attacker", input.preSnapshot);
  if (input.chosenId === "press_advantage") {
    if (defenderKills >= attackerKills) return { grade: "optimal", reason: "Trade clicked — punished the re-peek" };
    return { grade: "bad", reason: "Avenged into another body" };
  }
  if (input.chosenId === "reset_crossfire") {
    if (attackerKills <= 1) return { grade: "acceptable", reason: "Held the trade, set up crossfires" };
    return { grade: "bad", reason: "Passive play let defenders trade again" };
  }
  return { grade: "acceptable", reason: "Managed the loss" };
}

function gradeReconInfo(input: GradingInput): { grade: DecisionGrade; reason: string } {
  const defenderKills = countKillsByTeam(input.postSegmentEvents, "defender", input.preSnapshot);
  if (input.chosenId === "collapse_on_ping") {
    if (defenderKills >= 1) return { grade: "optimal", reason: "Info → kill — textbook collapse" };
    return { grade: "acceptable", reason: "Collapse didn't connect, didn't lose body" };
  }
  if (input.chosenId === "bank_info") {
    if (defenderKills >= 1) return { grade: "acceptable", reason: "Late capitalization on info" };
    return { grade: "bad", reason: "Info went stale — defender rotated off" };
  }
  return { grade: "acceptable", reason: "Played with info" };
}

function gradeSpikeThreshold(input: GradingInput): { grade: DecisionGrade; reason: string } {
  const spikeDefused = input.stateAfter.agents.length > 0 && (() => {
    // Look for a defuse_complete in the post-segment events.
    return input.postSegmentEvents.some((e) => e.type === "defuse_complete");
  })();
  const detonated = input.postSegmentEvents.some((e) => e.type === "spike_explosion");
  if (input.chosenId === "tap_defuse") {
    if (spikeDefused) return { grade: "optimal", reason: "Tap-defuse got the win" };
    if (detonated) return { grade: "bad", reason: "Tap-defuse contested — spike popped" };
    return { grade: "acceptable", reason: "Tap attempted, outcome unclear" };
  }
  if (input.chosenId === "clear_first") {
    if (spikeDefused) return { grade: "optimal", reason: "Cleared site first, then defused" };
    if (detonated) return { grade: "bad", reason: "Over-cleared — timer burned" };
    return { grade: "acceptable", reason: "Played clean, still tight on clock" };
  }
  if (input.chosenId === "fake_defuse") {
    if (spikeDefused) return { grade: "optimal", reason: "Fake → trade → defuse" };
    return { grade: "acceptable", reason: "Fake didn't bite" };
  }
  return { grade: "acceptable", reason: "Spike endgame" };
}

function gradeLowHpDuel(input: GradingInput): { grade: DecisionGrade; reason: string } {
  const attackerId = input.decision.triggeredBy.agentId;
  if (!attackerId) return { grade: "acceptable", reason: "Duel resolved" };
  const died = input.postSegmentEvents.some(
    (e) => e.type === "kill" && e.victim === attackerId
  );
  if (input.chosenId === "trade_in") {
    if (died) return { grade: "bad", reason: "Low-HP peek cost a body" };
    return { grade: "optimal", reason: "Trade-peek survived — high risk paid off" };
  }
  if (input.chosenId === "swap_out") {
    if (died) return { grade: "bad", reason: "Swap arrived late, peek got traded" };
    return { grade: "optimal", reason: "Protected the body, swap peeker took the duel" };
  }
  return { grade: "acceptable", reason: "Duel played out" };
}

export function gradeDecision(input: GradingInput): DecisionRecord {
  let result: { grade: DecisionGrade; reason: string };
  switch (input.decision.kind) {
    case "first_contact":
      result = gradeFirstContact(input);
      break;
    case "ally_down":
      result = gradeAllyDown(input);
      break;
    case "recon_info":
      result = gradeReconInfo(input);
      break;
    case "spike_threshold":
      result = gradeSpikeThreshold(input);
      break;
    case "low_hp_duel":
      result = gradeLowHpDuel(input);
      break;
    default:
      result = { grade: "acceptable", reason: "Decision resolved" };
  }

  // Timed-out decisions cannot earn an "optimal" grade — the player didn't
  // actually make the call. Floor them at "acceptable" or worse.
  if (input.timedOut && result.grade === "optimal") {
    result = { grade: "acceptable", reason: `${result.reason} (timed out)` };
  }

  return {
    decision: input.decision,
    chosenId: input.chosenId,
    timedOut: input.timedOut,
    grade: result.grade,
    gradeReason: result.reason,
  };
}

/** Point weighting used when rolling decision grades into the score. */
export function decisionScoreValue(grade: DecisionGrade, maxPerDecision = 10): number {
  if (grade === "optimal") return maxPerDecision;
  if (grade === "acceptable") return Math.round(maxPerDecision / 2);
  return 0;
}
