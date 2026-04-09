import type {
  PlayerPlan,
  Scenario,
  Outcome,
  Rule,
  RuleResult,
  AnimationEvent,
} from "../../../shared/types";
import { checkUtilityLOS } from "./lineOfSight";

/**
 * Evaluates a player's plan against the scenario's rules.
 * Returns a scored Outcome with rule-by-rule breakdown.
 */
export async function evaluatePlan(plan: PlayerPlan, scenario: Scenario): Promise<Outcome> {
  const ruleResults: RuleResult[] = [];
  let totalEarned = 0;
  let totalMax = 0;

  for (const rule of scenario.rules) {
    const result = await evaluateRule(rule, plan);
    ruleResults.push(result);
    totalEarned += result.earnedPoints;
    totalMax += rule.points;
  }

  // Normalize to 0-100 scale
  const score = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  // Determine tier
  const tier: Outcome["tier"] =
    score >= 80 ? "clean" : score >= 50 ? "messy" : "failed";

  // Generate feedback text
  const highlights: string[] = [];
  const mistakes: string[] = [];

  for (const result of ruleResults) {
    if (result.passed) {
      highlights.push(result.detail);
    } else {
      mistakes.push(result.detail);
    }
  }

  const summary = generateSummary(tier, highlights.length, mistakes.length);

  return {
    score,
    maxScore: totalMax,
    scoreBreakdown: ruleResults,
    tier,
    events: [], // Filled in by animationGenerator
    summary,
    highlights,
    mistakes,
  };
}

/**
 * Evaluates a single rule against the player's plan.
 */
async function evaluateRule(rule: Rule, plan: PlayerPlan): Promise<RuleResult> {
  const check = rule.check;
  let passed = false;
  let detail = "";

  switch (check.type) {
    case "utility_placed": {
      // Check if the required utility type is placed in the target area
      const matchingUtility = plan.utilityPlacements.filter(
        (u) =>
          check.requiredUtility?.includes(u.type) &&
          distance(u.position, check.targetArea.center) <= check.targetArea.radius
      );
      passed = matchingUtility.length > 0;
      detail = passed
        ? `${matchingUtility[0].type} placed in target zone — ${rule.description}`
        : `No ${check.requiredUtility?.join(" or ")} placed in target zone — ${rule.description}`;
      break;
    }

    case "angle_cleared": {
      // Check if an agent is positioned to clear the angle, or utility covers it
      const hasCoverage =
        plan.movementArrows.some(
          (a) => distance(a.path[a.path.length - 1], check.targetArea.center) <= check.targetArea.radius
        ) ||
        plan.utilityPlacements.some(
          (u) => distance(u.position, check.targetArea.center) <= check.targetArea.radius
        );
      passed = hasCoverage;
      detail = passed
        ? `Angle covered — ${rule.description}`
        : `Angle not covered — ${rule.description}`;
      break;
    }

    case "path_overlaps": {
      // Check if a movement arrow overlaps the target area
      const overlappingArrow = plan.movementArrows.some((arrow) =>
        arrow.path.some((p) => distance(p, check.targetArea.center) <= check.targetArea.radius)
      );
      passed = overlappingArrow;
      detail = passed
        ? `Movement path covers target — ${rule.description}`
        : `No movement path through target area — ${rule.description}`;
      break;
    }

    case "proximity": {
      // Check if minimum agents are within the target area
      const agentsInArea = plan.agentPositions.filter(
        (a) =>
          (!check.requiredAgent || check.requiredAgent.includes(a.agentId)) &&
          distance(a.position, check.targetArea.center) <= check.targetArea.radius
      );
      passed = agentsInArea.length >= (check.minAgents || 1);
      detail = passed
        ? `${agentsInArea.length} agent(s) in position — ${rule.description}`
        : `Insufficient agents in position (${agentsInArea.length}/${check.minAgents}) — ${rule.description}`;
      break;
    }

    case "coverage": {
      // Check if utility + agents together cover the area
      const hasUtility = plan.utilityPlacements.some(
        (u) =>
          check.requiredUtility?.includes(u.type) &&
          distance(u.position, check.targetArea.center) <= check.targetArea.radius * 1.5
      );
      const hasAgent = plan.agentPositions.some(
        (a) => distance(a.position, check.targetArea.center) <= check.targetArea.radius
      );
      passed = hasUtility || hasAgent;
      detail = passed
        ? `Area is covered — ${rule.description}`
        : `Area left uncovered — ${rule.description}`;
      break;
    }

    case "utility_placed_with_los": {
      // Check if utility is placed AND has valid line of sight from agent
      const matchingUtility = plan.utilityPlacements.filter(
        (u) =>
          check.requiredUtility?.includes(u.type) &&
          distance(u.position, check.targetArea.center) <= check.targetArea.radius
      );

      if (matchingUtility.length === 0) {
        passed = false;
        detail = `No ${check.requiredUtility?.join(" or ")} placed in target zone — ${rule.description}`;
        break;
      }

      // Find the agent that placed this utility
      const agentId = check.lineOfSight?.fromAgent || matchingUtility[0].agentId;
      const agentPos = plan.agentPositions.find((a) => a.agentId === agentId);

      if (!agentPos) {
        passed = false;
        detail = `No agent position found for ${agentId} — cannot verify line of sight`;
        break;
      }

      // Check LOS for each matching utility placement
      let anyValidLOS = false;
      let losDetail = "";

      for (const util of matchingUtility) {
        const target = check.lineOfSight?.toAreaCenter
          ? check.targetArea.center
          : util.position;

        const losResult = await checkUtilityLOS(
          "ascent", // TODO: derive from scenario.map
          agentPos.position,
          target,
          util.type
        );

        if (losResult.hasLOS) {
          anyValidLOS = true;
          break;
        } else {
          losDetail = losResult.detail;
        }
      }

      passed = anyValidLOS;
      detail = passed
        ? `${matchingUtility[0].type} placed with clear line of sight — ${rule.description}`
        : `${matchingUtility[0].type} path blocked by wall — ${rule.description}. ${losDetail}`;
      break;
    }
  }

  const earnedPoints = passed ? rule.points : 0;

  return {
    ruleId: rule.id,
    description: rule.description,
    category: rule.category,
    maxPoints: rule.points,
    earnedPoints,
    passed,
    detail,
  };
}

/**
 * Simple Euclidean distance between two positions (0-1 normalized).
 */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/**
 * Generates a human-readable summary based on tier and results.
 */
function generateSummary(
  tier: Outcome["tier"],
  highlights: number,
  mistakes: number
): string {
  switch (tier) {
    case "clean":
      return "Clean retake — excellent game sense!";
    case "messy":
      return "Messy but successful — you got the spike defused";
    case "failed":
      return "Retake failed — too many angles left unchecked";
  }
}
