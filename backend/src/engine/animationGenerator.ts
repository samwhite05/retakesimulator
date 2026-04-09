import type {
  PlayerPlan,
  Outcome,
  AnimationEvent,
  RuleResult,
} from "@shared/types";

/**
 * Generates a unique animation event timeline from a player's plan and its evaluated outcome.
 * The animation is built from the player's ACTUAL inputs — positions, paths, utility placements.
 * No two plans produce the same animation.
 */
export function generateAnimation(
  plan: PlayerPlan,
  outcome: Outcome
): AnimationEvent[] {
  const events: AnimationEvent[] = [];
  let timeline = 0; // ms from start

  // ---- Phase 1: Agent Spawn (0-500ms) ----
  for (let i = 0; i < plan.agentPositions.length; i++) {
    events.push({
      id: `spawn-${i}`,
      type: "agent_spawn",
      actor: plan.agentPositions[i].agentId,
      position: plan.agentPositions[i].position,
      delay: i * 150,
      duration: 300,
    });
  }

  timeline = 600;

  // ---- Phase 2: Utility Deploy (600-2000ms) ----
  for (let i = 0; i < plan.utilityPlacements.length; i++) {
    const u = plan.utilityPlacements[i];
    const baseDelay = timeline + i * 200;

    switch (u.type) {
      case "smoke":
        events.push({
          id: `smoke-${i}`,
          type: "smoke_expand",
          actor: u.agentId,
          position: u.position,
          delay: baseDelay,
          duration: 800,
        });
        break;

      case "flash":
        events.push(
          {
            id: `flash-launch-${i}`,
            type: "flash_detonate",
            actor: u.agentId,
            position: u.position,
            target: u.target ? u.agentId : undefined,
            path: u.path,
            delay: baseDelay,
            duration: 400,
          },
          {
            id: `flash-detonate-${i}`,
            type: "flash_detonate",
            actor: "flash",
            position: u.target || u.position,
            delay: baseDelay + 300,
            duration: 600,
          }
        );
        break;

      case "mollie":
        events.push({
          id: `mollie-${i}`,
          type: "mollie_erupt",
          actor: u.agentId,
          position: u.position,
          delay: baseDelay + 200,
          duration: 1000,
        });
        break;

      case "dart":
        events.push(
          {
            id: `dart-fire-${i}`,
            type: "dart_fire",
            actor: u.agentId,
            position: u.position,
            path: u.path || [u.position],
            delay: baseDelay,
            duration: 600,
          },
          {
            id: `dart-reveal-${i}`,
            type: "reveal",
            actor: "dart",
            position: u.target || u.position,
            delay: baseDelay + 500,
            duration: 800,
          }
        );
        break;
    }
  }

  timeline = 2200;

  // ---- Phase 3: Agent Movement (2200-4000ms) ----
  for (let i = 0; i < plan.movementArrows.length; i++) {
    const arrow = plan.movementArrows[i];
    events.push({
      id: `dash-${i}`,
      type: "dash",
      actor: arrow.agentId,
      position: arrow.path[0],
      path: arrow.path,
      delay: timeline + i * 100,
      duration: 1200,
    });
  }

  timeline = 3500;

  // ---- Phase 4: Resolution Events (based on rule results) ----
  // Generate consequences for failed rules
  const failedRules = outcome.scoreBreakdown.filter((r) => !r.passed);
  const passedRules = outcome.scoreBreakdown.filter((r) => r.passed);

  for (let i = 0; i < failedRules.length; i++) {
    const rule = failedRules[i];
    events.push(
      ...generateFailureEvents(rule, plan, outcome, timeline + i * 500)
    );
  }

  // Generate success events for passed rules
  for (let i = 0; i < passedRules.length; i++) {
    const rule = passedRules[i];
    events.push(
      ...generateSuccessEvents(rule, plan, outcome, timeline + i * 400)
    );
  }

  timeline += Math.max(failedRules.length * 500, passedRules.length * 400) + 500;

  // ---- Phase 5: Deaths (based on tier) ----
  if (outcome.tier === "messy" || outcome.tier === "failed") {
    const deathsToAssign = outcome.tier === "messy" ? 1 : 2;
    const availableAgents = [...plan.agentPositions];

    for (let i = 0; i < Math.min(deathsToAssign, availableAgents.length); i++) {
      const victim = availableAgents[i];
      events.push({
        id: `death-${i}`,
        type: "kill",
        actor: "hidden_enemy",
        position: victim.position,
        target: victim.agentId,
        delay: timeline + i * 300,
        duration: 500,
      });
    }
  }

  timeline += 800;

  // ---- Phase 6: Spike Resolution ----
  if (outcome.tier === "clean" || outcome.tier === "messy") {
    events.push({
      id: "defuse-start",
      type: "defuse_start",
      actor: "survivor",
      position: plan.agentPositions[plan.agentPositions.length - 1]?.position || { x: 0.5, y: 0.5 },
      delay: timeline,
      duration: 2000,
    });
    events.push({
      id: "defuse-complete",
      type: "defuse_complete",
      actor: "survivor",
      position: plan.agentPositions[plan.agentPositions.length - 1]?.position || { x: 0.5, y: 0.5 },
      delay: timeline + 2000,
      duration: 500,
    });
  } else {
    // Failed — spike explodes
    events.push({
      id: "spike-explode",
      type: "spike_explosion",
      actor: "spike",
      position: { x: 0.5, y: 0.5 }, // TODO: use actual spike position
      delay: timeline,
      duration: 1000,
    });
  }

  // Sort by delay for proper playback order
  return events.sort((a, b) => a.delay - b.delay);
}

/**
 * Generates animation events for a failed rule (consequences).
 */
function generateFailureEvents(
  rule: RuleResult,
  plan: PlayerPlan,
  outcome: Outcome,
  baseDelay: number
): AnimationEvent[] {
  // Generic failure event — the specifics come from which rule failed
  return [
    {
      id: `fail-${rule.ruleId}`,
      type: "reveal",
      actor: "enemy",
      position: { x: 0.5, y: 0.5 }, // TODO: derive from rule's target area
      delay: baseDelay,
      duration: 600,
      metadata: { ruleId: rule.ruleId, reason: rule.detail },
    },
  ];
}

/**
 * Generates animation events for a passed rule (successes).
 */
function generateSuccessEvents(
  rule: RuleResult,
  plan: PlayerPlan,
  outcome: Outcome,
  baseDelay: number
): AnimationEvent[] {
  return [
    {
      id: `success-${rule.ruleId}`,
      type: "reveal",
      actor: "system",
      position: { x: 0.5, y: 0.5 },
      delay: baseDelay,
      duration: 400,
      metadata: { ruleId: rule.ruleId, detail: rule.detail },
    },
  ];
}
