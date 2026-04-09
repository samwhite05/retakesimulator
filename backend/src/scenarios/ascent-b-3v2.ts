import type { Scenario } from "@shared/types";
import { getCompUtility } from "@shared/agentAbilities";
import { getRandomDefenderPositions, getSitePositions, type PositionDef } from "@shared/positionPools";

/**
 * Ascent B-Site — 3v2 Post-Plant Retake
 *
 * Setup: Spike planted at B default. Enemies holding post-plant positions.
 * Uses the position pool system for randomized, tactically valid enemy positions.
 *
 * HOW POSITIONS WORK:
 * - Position pools are defined in shared/positionPools.ts
 * - Each site has pools organized by role: anchor, postplant, lurker, offangle
 * - getRandomDefenderPositions() picks N random positions from the pool
 * - To add new positions: open the minimap, note pixel coords, convert to 0-1 normalized, add to pool
 *
 * CONVERTING PIXEL COORDS TO NORMALIZED:
 * - Minimap is 1024x1024 pixels
 * - normalized_x = pixel_x / 1024
 * - normalized_y = pixel_y / 1024
 * - Example: pixel (750, 380) → normalized (0.732, 0.371)
 */

// Get B-site position pool
const bSitePool = getSitePositions("ascent", "ascent-b")!;

// Randomly pick 2 defender positions from postplant + anchor pools
// This creates variety — each day could show different enemy positions
const defenderPositions = getRandomDefenderPositions(bSitePool, 2, ["postplant", "anchor"]);

// Pick 1 hidden enemy from lurker/offangle pool (the "gotcha" position)
const hiddenPositions = getRandomDefenderPositions(bSitePool, 1, ["lurker", "offangle"]);

// Get correct utility for the comp: Sova + Omen + Jett
const availableUtility = getCompUtility(["sova", "omen", "jett"]);

export const ascentB3v2: Scenario = {
  id: "ascent-b-3v2-001",
  name: "Ascent B-Site | 3v2 Post-Plant",
  map: "ascent",
  minimapImage: "/assets/minimaps/ascent.png",

  // Spike location — uses the plant zone center from the position pool
  spikeSite: bSitePool.plantZone.center,

  // Your team's starting positions (retake spawn — CT side)
  friendlyAgents: [
    {
      id: "sova",
      displayName: "Sova",
      position: { x: 0.62, y: 0.68 }, // CT spawn area
      role: "initiator",
    },
    {
      id: "omen",
      displayName: "Omen",
      position: { x: 0.58, y: 0.65 },
      role: "controller",
    },
    {
      id: "jett",
      displayName: "Jett",
      position: { x: 0.65, y: 0.72 },
      role: "duelist",
    },
  ],

  // Known enemy positions (shown to player) — randomly selected from pool
  enemyAgents: defenderPositions.map((pos: PositionDef, i: number) => ({
    id: `enemy-${i + 1}`,
    position: pos.position,
    agent: i === 0 ? "cypher" : "killjoy", // Known agents
    isHidden: false,
  })),

  // Hidden off-angles (not shown until cinematic reveals) — randomly selected
  hiddenEnemies: hiddenPositions.map((pos: PositionDef, i: number) => ({
    id: `enemy-hidden-${i + 1}`,
    position: pos.position,
    agent: "raze",
    isHidden: true,
  })),

  // Correct utility for Sova + Omen + Jett (no incorrect abilities)
  availableAgents: ["sova", "omen", "jett"],
  availableUtility,

  // Evaluation rules — updated to match the position pool
  rules: [
    {
      id: "clear-market",
      description: "Clear Market angle before pushing site",
      category: "critical",
      points: 40,
      check: {
        type: "angle_cleared",
        targetArea: {
          center: { x: 0.66, y: 0.30 }, // Market position from pool
          radius: 0.08,
        },
        requiredUtility: ["flash", "dart", "mollie"],
      },
    },
    {
      id: "block-b-main",
      description: "Block or check B Main flank",
      category: "critical",
      points: 35,
      check: {
        type: "coverage",
        targetArea: {
          center: { x: 0.88, y: 0.55 }, // B Main from pool
          radius: 0.10,
        },
        requiredUtility: ["smoke", "mollie", "dart"],
      },
    },
    {
      id: "tree-check",
      description: "Clear or pressure Tree position",
      category: "important",
      points: 25,
      check: {
        type: "angle_cleared",
        targetArea: {
          center: { x: 0.82, y: 0.44 }, // Tree from pool
          radius: 0.08,
        },
        requiredUtility: ["dart", "flash"],
      },
    },
    {
      id: "flash-entry",
      description: "Use flash before committing to site",
      category: "important",
      points: 20,
      check: {
        type: "utility_placed",
        targetArea: {
          center: bSitePool.plantZone.center,
          radius: 0.15,
        },
        requiredUtility: ["flash"],
      },
    },
    {
      id: "support-spacing",
      description: "Agents should not stack — maintain spread",
      category: "minor",
      points: 15,
      check: {
        type: "proximity",
        targetArea: {
          center: { x: 0.50, y: 0.55 },
          radius: 0.20,
        },
        minAgents: 2,
      },
    },
    {
      id: "site-pressure",
      description: "At least one agent pushes onto site",
      category: "minor",
      points: 15,
      check: {
        type: "path_overlaps",
        targetArea: {
          center: bSitePool.plantZone.center,
          radius: 0.06,
        },
      },
    },
  ],

  // Animation event vocabulary
  events: {
    successEvents: [
      { trigger: "clear-market", type: "reveal", actorAgent: "sova", description: "Market enemies revealed" },
      { trigger: "block-b-main", type: "smoke_expand", actorAgent: "omen", description: "B Main blocked" },
      { trigger: "tree-check", type: "reveal", actorAgent: "sova", description: "Tree position checked" },
    ],
    failureEvents: [
      { trigger: "clear-market", type: "kill", actorAgent: "cypher", description: "Market Cypher picks entry" },
      { trigger: "block-b-main", type: "kill", actorAgent: "raze", description: "B Main Raze flanks and kills" },
      { trigger: "tree-check", type: "kill", actorAgent: "killjoy", description: "Tree Killjoy gets free pick" },
    ],
    deathEvents: [
      { condition: "tier_messy", victimAgent: "jett", location: { x: 0.74, y: 0.38 }, description: "Jett traded on entry" },
      { condition: "tier_failed", victimAgent: "jett", location: { x: 0.74, y: 0.38 }, description: "Jett picked on entry" },
      { condition: "tier_failed", victimAgent: "omen", location: { x: 0.65, y: 0.40 }, description: "Omen caught rotating" },
    ],
  },

  // Metadata
  releaseDate: new Date().toISOString().split("T")[0],
  difficulty: 2,
  description:
    "Spike is planted on B site. Your intel shows enemies in post-plant positions. It's a 3v2 — but off-angles could be lurking. Plan your retake carefully.",
};
