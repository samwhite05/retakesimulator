import { Scenario } from "@/types";
import type { EffectivePlayerPlan } from "@/lib/normalizePlan";

function hasPath(
  agentId: string,
  paths: { agentId: string; path: { x: number; y: number }[] }[]
): boolean {
  const mp = paths.find((p) => p.agentId === agentId);
  return Boolean(mp && mp.path.length >= 2);
}

/**
 * Unified planning is submittable when every agent on the roster is placed,
 * has a movement path drawn (single continuous path from spawn to final
 * destination), and at least one utility is drafted.
 */
export function isFinalExecuteSubmittable(
  scenario: Scenario,
  plan: EffectivePlayerPlan
): boolean {
  if (plan.agentPositions.length !== scenario.availableAgents.length) return false;
  if (plan.utilityPlacements.length === 0) return false;
  for (const agentId of scenario.availableAgents) {
    if (!plan.agentPositions.some((a) => a.agentId === agentId)) return false;
    if (!hasPath(agentId, plan.movementPaths)) return false;
  }
  return true;
}

export function isServerPlanRunnable(scenario: Scenario, plan: EffectivePlayerPlan): boolean {
  if (plan.agentPositions.length !== scenario.availableAgents.length) return false;
  if (plan.utilityPlacements.length === 0) return false;
  for (const agentId of scenario.availableAgents) {
    if (!hasPath(agentId, plan.movementPaths)) return false;
  }
  return true;
}

/**
 * @deprecated Planning is single-stage. Kept as an alias of
 * `isFinalExecuteSubmittable` so legacy imports keep compiling.
 */
export const isPhase1Previewable = isFinalExecuteSubmittable;
