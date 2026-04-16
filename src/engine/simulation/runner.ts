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
  MovementPath,
} from "@/types";
import { posToTile, tileToPos, getTile, findPath } from "./grid";
import { getAgentDef } from "@/lib/constants";
import { resolveUtility, checkMollieDamage, checkTraps, AbilityContext } from "./abilities";
import { resolveCombat } from "./combat";
import { canSeeAgent, hasLineOfSight } from "./vision";
import { normalizePlayerPlan } from "@/lib/normalizePlan";
import { computePathExposure } from "./exposure";

type DefuseMode = "wipe" | "uncontested" | "none";

/**
 * The sim resolves a single drawn path per agent. Exposure is computed along
 * the path (with known defenders' vision cones and placed smokes) and used to
 * weight engagement outcomes: a covered path lets the attacker arrive safely,
 * a wildly exposed path loses trades at the defender's angle.
 */

const HIGH_EXPOSURE = 0.55;
const MED_EXPOSURE = 0.25;

export function runSimulation(planInput: PlayerPlan, scenario: Scenario): { log: SimulationLog; outcome: Outcome } {
  const plan = normalizePlayerPlan(planInput);

  const smokeTiles = new Set<string>();
  const wallTiles = new Set<string>();
  const mollieTiles = new Set<string>();
  const trapTiles = new Map<string, string>();

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

  const turns: TurnLog[] = [];

  const setupEvents: GameEvent[] = [];
  for (const agent of agents) {
    setupEvents.push({
      type: "agent_spawn",
      agentId: agent.agentId,
      position: tileToPos(agent.position),
    });
  }
  turns.push({ phase: "setup", events: setupEvents });

  const abilityCtx: AbilityContext = { grid: scenario.grid, smokeTiles, wallTiles, mollieTiles, trapTiles, agents };

  const utilityEvents: GameEvent[] = [];
  for (const util of plan.utilityPlacements) {
    const evts = resolveUtility(util, abilityCtx);
    utilityEvents.push(...evts);
  }
  turns.push({ phase: "utility", events: utilityEvents });

  const movementEvents = runMovement(plan.movementPaths, agents, scenario, plan.utilityPlacements, abilityCtx);
  turns.push({ phase: "movement", events: movementEvents });

  const combatEvents: GameEvent[] = [];
  const attackers = agents.filter((a) => a.alive && a.team === "attacker");
  const defenders = agents.filter((a) => a.alive && a.team === "defender");

  const rolePriority: Record<string, number> = { initiator: 0, duelist: 1, controller: 2, sentinel: 3 };
  const sortedAttackers = [...attackers].sort((a, b) => (rolePriority[a.role] || 2) - (rolePriority[b.role] || 2));

  const engagedDefenders = new Set<string>();

  for (const attacker of sortedAttackers) {
    const visibleDefenders = defenders.filter(
      (d) => !engagedDefenders.has(d.agentId) && canSeeAgent(scenario.grid, attacker, d, smokeTiles, wallTiles)
    );

    if (visibleDefenders.length > 0) {
      const target = visibleDefenders.sort(
        (a, b) =>
          Math.abs(a.position.col - attacker.position.col) + Math.abs(a.position.row - attacker.position.row) -
          (Math.abs(b.position.col - attacker.position.col) + Math.abs(b.position.row - attacker.position.row))
      )[0];

      engagedDefenders.add(target.agentId);
      const result = resolveCombat(attacker, target, { grid: scenario.grid, smokeTiles, wallTiles });
      combatEvents.push(...result.events);
    }
  }

  for (const defender of defenders) {
    if (!defender.alive || engagedDefenders.has(defender.agentId)) continue;
    const visibleAttackers = agents.filter(
      (a) => a.alive && a.team === "attacker" && canSeeAgent(scenario.grid, defender, a, smokeTiles, wallTiles)
    );
    if (visibleAttackers.length > 0) {
      const target = visibleAttackers[0];
      const result = resolveCombat(defender, target, { grid: scenario.grid, smokeTiles, wallTiles });
      combatEvents.push(...result.events);
    }
  }

  turns.push({ phase: "combat", events: combatEvents });

  const spikeTile = posToTile(scenario.spikeSite);
  const aliveAttackers = agents.filter((a) => a.alive && a.team === "attacker");
  const aliveDefenders = agents.filter((a) => a.alive && a.team === "defender");

  const { events: spikeEvents, spikeDefused, defuseMode } = resolveSpikePhase(
    agents,
    aliveAttackers,
    aliveDefenders,
    scenario.grid,
    smokeTiles,
    wallTiles,
    spikeTile,
    scenario.spikeSite
  );

  turns.push({ phase: "spike", events: spikeEvents });

  const outcome = generateOutcome(plan, scenario, agents, spikeDefused, defuseMode);

  const log: SimulationLog = {
    turns,
    finalState: {
      agents,
      spikeDefused,
    },
    outcome,
  };

  return { log, outcome };
}

/** Client-side preview: setup + utility + movement only (no score). */
export function runPhase1Preview(
  planInput: PlayerPlan,
  scenario: Scenario
): { log: SimulationLog; attackerPositions: AgentPosition[] } {
  const plan = normalizePlayerPlan(planInput);

  const smokeTiles = new Set<string>();
  const wallTiles = new Set<string>();
  const mollieTiles = new Set<string>();
  const trapTiles = new Map<string, string>();

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

  const turns: TurnLog[] = [];

  const setupEvents: GameEvent[] = [];
  for (const agent of agents) {
    setupEvents.push({
      type: "agent_spawn",
      agentId: agent.agentId,
      position: tileToPos(agent.position),
    });
  }
  turns.push({ phase: "setup", events: setupEvents });

  const abilityCtx: AbilityContext = { grid: scenario.grid, smokeTiles, wallTiles, mollieTiles, trapTiles, agents };

  const utilityEvents: GameEvent[] = [];
  for (const util of plan.utilityPlacements) {
    const evts = resolveUtility(util, abilityCtx);
    utilityEvents.push(...evts);
  }
  turns.push({ phase: "utility", events: utilityEvents });

  const movementEvents = runMovement(plan.movementPaths, agents, scenario, plan.utilityPlacements, abilityCtx);
  turns.push({ phase: "movement", events: movementEvents });

  const snapshot = JSON.parse(JSON.stringify(agents)) as SimAgent[];
  const attackerPositions: AgentPosition[] = snapshot
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

  const log: SimulationLog = {
    turns,
    finalState: { agents: snapshot, spikeDefused: false },
    outcome: previewOutcome,
  };

  return { log, attackerPositions };
}

/**
 * Resolve a single continuous path per attacker. Exposure weighting: if a
 * path sits heavily inside a defender FOV without cover, the attacker takes
 * damage (or dies) en route — even if nobody's line-of-sight lines up in the
 * final combat phase. This is what makes "just run to the bomb" lose.
 */
function runMovement(
  paths: MovementPath[],
  agents: SimAgent[],
  scenario: Scenario,
  utilityPlacements: { agentId: string; type: string; position?: Position }[],
  abilityCtx: AbilityContext
): GameEvent[] {
  const events: GameEvent[] = [];

  const pathEntries = paths
    .map((mp) => {
      const agent = agents.find((a) => a.agentId === mp.agentId && a.alive);
      if (!agent) return null;
      const pathTiles = mp.path.map(posToTile);
      if (pathTiles.length < 2) return null;
      return { agent, pathTiles, rawPath: mp.path };
    })
    .filter(Boolean) as { agent: SimAgent; pathTiles: TileCoord[]; rawPath: Position[] }[];

  pathEntries.sort((a, b) => a.pathTiles.length - b.pathTiles.length);

  for (const { agent, pathTiles, rawPath } of pathEntries) {
    if (!agent.alive) continue;

    const def = getAgentDef(agent.agentId);
    const role = def?.role || "initiator";
    const isDash = utilityPlacements.some((u) => u.agentId === agent.agentId && u.type === "dash");

    const start = agent.position;
    const end = pathTiles[pathTiles.length - 1];
    const computedPath = findPath(scenario.grid, start, end, role, abilityCtx.wallTiles, { maxCost: 9999 });

    const finalPath = computedPath && computedPath.length > 1 ? computedPath : pathTiles;

    const exposureReport = computePathExposure(
      scenario,
      tileToPos(start),
      rawPath,
      utilityPlacements
        .filter((u) => u.type === "smoke" && !!u.position)
        .map((u) => ({ type: u.type as import("@/types").UtilityType, position: u.position as Position }))
    );

    if (exposureReport.averageExposure >= HIGH_EXPOSURE) {
      const defender = pickWatchingDefender(agent, scenario, abilityCtx.smokeTiles, abilityCtx.wallTiles);
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
        continue;
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

    events.push(...checkMollieDamage(agent, abilityCtx));
    events.push(...checkTraps(agent, abilityCtx));
  }

  return events;
}

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

function pickDefuserOnSpikeSite(agents: SimAgent[], grid: GridMap, spikeNorm: Position): SimAgent | null {
  const onSite = agents.filter(
    (a) => a.alive && a.team === "attacker" && getTile(grid, a.position)?.type === "spike_zone"
  );
  if (onSite.length === 0) return null;
  const st = posToTile(spikeNorm);
  const manhattan = (a: SimAgent) => Math.abs(a.position.col - st.col) + Math.abs(a.position.row - st.row);
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
        Math.abs(a.position.col - spikeTile.col) + Math.abs(a.position.row - spikeTile.row) -
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

function generateOutcome(
  plan: import("@/lib/normalizePlan").EffectivePlayerPlan,
  scenario: Scenario,
  agents: SimAgent[],
  spikeDefused: boolean,
  defuseMode: DefuseMode
): Outcome {
  const ruleResults: RuleResult[] = [];
  let totalEarned = 0;
  let totalMax = 0;

  const aliveAttackers = agents.filter((a) => a.alive && a.team === "attacker");
  const aliveDefenders = agents.filter((a) => a.alive && a.team === "defender");
  const killedDefenders = agents.filter((a) => !a.alive && a.team === "defender").length;
  const attackerDeaths = agents.filter((a) => !a.alive && a.team === "attacker").length;

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
    detail: clearPassed ? "All defenders eliminated" : `${killedDefenders}/${defenderTotal} defenders eliminated`,
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
  const totalUsed = plan.utilityPlacements.length;
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

  const score = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const tier: OutcomeTier = score >= 80 ? "clean" : score >= 50 ? "messy" : "failed";

  const highlights = ruleResults.filter((r) => r.passed).map((r) => r.detail);
  const mistakes = ruleResults.filter((r) => !r.passed).map((r) => r.detail);

  let summary = "";
  if (tier === "clean") summary = "Clean retake — excellent game sense!";
  else if (tier === "messy") summary = spikeDefused ? "Messy but successful — spike defused" : "Messy retake — spike still contested";
  else summary = "Retake failed — spike detonated or team wiped";

  return {
    score,
    maxScore: totalMax,
    scoreBreakdown: ruleResults,
    tier,
    summary,
    highlights,
    mistakes,
  };
}
