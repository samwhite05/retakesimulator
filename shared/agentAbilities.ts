/**
 * Agent ability definitions — matches actual Valorant data.
 * Each agent has exactly 4 abilities (C, Q, E, X).
 * Only non-ultimate abilities (C, Q, E) are usable in scenarios.
 */

import type { UtilityType } from "./types";

export type AbilitySlot = "C" | "Q" | "E" | "X";
// UtilityType is imported from types.ts — it includes all ability types

export interface AbilityDef {
  slot: AbilitySlot;
  name: string;
  type: UtilityType;
  charges: number;       // How many uses per round
  isUltimate: boolean;   // X abilities excluded from scenarios
}

export interface AgentAbilities {
  id: string;
  displayName: string;
  role: "duelist" | "initiator" | "controller" | "sentinel";
  abilities: AbilityDef[];
}

/**
 * Full agent roster with correct abilities (as of Episode 8).
 * Only 22 active agents included.
 */
export const ALL_AGENTS: AgentAbilities[] = [
  // ===== DUELISTS =====
  {
    id: "jett",
    displayName: "Jett",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Updraft", type: "dash", charges: 2, isUltimate: false },
      { slot: "Q", name: "Tailwind", type: "dash", charges: 1, isUltimate: false },
      { slot: "E", name: "Cloudburst", type: "smoke", charges: 2, isUltimate: false },
      { slot: "X", name: "Blade Storm", type: "dash", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "raze",
    displayName: "Raze",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Blast Pack", type: "concussion", charges: 2, isUltimate: false },
      { slot: "Q", name: "Paint Shells", type: "mollie", charges: 2, isUltimate: false },
      { slot: "E", name: "Boom Bot", type: "decoy", charges: 1, isUltimate: false },
      { slot: "X", name: "Showstopper", type: "mollie", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "phoenix",
    displayName: "Phoenix",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Blaze", type: "mollie", charges: 2, isUltimate: false },
      { slot: "Q", name: "Curveball", type: "flash", charges: 2, isUltimate: false },
      { slot: "E", name: "Hot Hands", type: "mollie", charges: 2, isUltimate: false },
      { slot: "X", name: "Run It Back", type: "revive", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "reyna",
    displayName: "Reyna",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Leer", type: "decoy", charges: 1, isUltimate: false },
      { slot: "Q", name: "Devour", type: "heal", charges: 1, isUltimate: false },
      { slot: "E", name: "Dismiss", type: "dash", charges: 1, isUltimate: false },
      { slot: "X", name: "Empress", type: "flash", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "yoru",
    displayName: "Yoru",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Fakeout", type: "decoy", charges: 1, isUltimate: false },
      { slot: "Q", name: "Blindside", type: "flash", charges: 2, isUltimate: false },
      { slot: "E", name: "Gatecrash", type: "dash", charges: 1, isUltimate: false },
      { slot: "X", name: "Dimensional Drift", type: "dash", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "neon",
    displayName: "Neon",
    role: "duelist",
    abilities: [
      { slot: "C", name: "High Gear", type: "dash", charges: 2, isUltimate: false },
      { slot: "Q", name: "Relay Bolt", type: "concussion", charges: 1, isUltimate: false },
      { slot: "E", name: "Fast Lane", type: "wall", charges: 2, isUltimate: false },
      { slot: "X", name: "Overdrive", type: "dash", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "iso",
    displayName: "Iso",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Undercut", type: "concussion", charges: 1, isUltimate: false },
      { slot: "Q", name: "Double Tap", type: "wall", charges: 1, isUltimate: false },
      { slot: "E", name: "Contingency", type: "wall", charges: 1, isUltimate: false },
      { slot: "X", name: "Kill Contract", type: "wall", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "waylay",
    displayName: "Waylay",
    role: "duelist",
    abilities: [
      { slot: "C", name: "Shiver", type: "concussion", charges: 1, isUltimate: false },
      { slot: "Q", name: "Riptide", type: "concussion", charges: 2, isUltimate: false },
      { slot: "E", name: "Tsunami", type: "wall", charges: 1, isUltimate: false },
      { slot: "X", name: "Tidal Surge", type: "dash", charges: 1, isUltimate: true },
    ],
  },

  // ===== INITIATORS =====
  {
    id: "sova",
    displayName: "Sova",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Recon Bolt", type: "dart", charges: 2, isUltimate: false },
      { slot: "Q", name: "Shock Bolt", type: "concussion", charges: 2, isUltimate: false },
      { slot: "E", name: "Owl Drone", type: "sensor", charges: 1, isUltimate: false },
      { slot: "X", name: "Hunter's Fury", type: "dart", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "breach",
    displayName: "Breach",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Aftershock", type: "mollie", charges: 2, isUltimate: false },
      { slot: "Q", name: "Fault Line", type: "concussion", charges: 1, isUltimate: false },
      { slot: "E", name: "Flashpoint", type: "flash", charges: 2, isUltimate: false },
      { slot: "X", name: "Rolling Thunder", type: "concussion", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "skye",
    displayName: "Skye",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Trailblazer", type: "dart", charges: 1, isUltimate: false },
      { slot: "Q", name: "Guiding Light", type: "flash", charges: 2, isUltimate: false },
      { slot: "E", name: "Regrowth", type: "heal", charges: 1, isUltimate: false },
      { slot: "X", name: "Seekers", type: "dart", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "kayo",
    displayName: "KAY/O",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Flash/Drive", type: "flash", charges: 2, isUltimate: false },
      { slot: "Q", name: "FRAG/ment", type: "mollie", charges: 1, isUltimate: false },
      { slot: "E", name: "ZERO/POINT", type: "sensor", charges: 1, isUltimate: false },
      { slot: "X", name: "NULL/cmd", type: "concussion", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "fade",
    displayName: "Fade",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Seize", type: "gravity_well", charges: 1, isUltimate: false },
      { slot: "Q", name: "Haunt", type: "sensor", charges: 2, isUltimate: false },
      { slot: "E", name: "Prowler", type: "dart", charges: 1, isUltimate: false },
      { slot: "X", name: "Nightfall", type: "sensor", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "gabrielle",
    displayName: "Gekko",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Dizzy", type: "flash", charges: 2, isUltimate: false },
      { slot: "Q", name: "Wingman", type: "dart", charges: 1, isUltimate: false },
      { slot: "E", name: "Mosh Pit", type: "mollie", charges: 1, isUltimate: false },
      { slot: "X", name: "Thrash", type: "concussion", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "tejo",
    displayName: "Tejo",
    role: "initiator",
    abilities: [
      { slot: "C", name: "Recon Arrow", type: "dart", charges: 1, isUltimate: false },
      { slot: "Q", name: "Stealth Drone", type: "sensor", charges: 1, isUltimate: false },
      { slot: "E", name: "Guided Salvo", type: "mollie", charges: 1, isUltimate: false },
      { slot: "X", name: "Special Delivery", type: "mollie", charges: 1, isUltimate: true },
    ],
  },

  // ===== CONTROLLERS =====
  {
    id: "omen",
    displayName: "Omen",
    role: "controller",
    abilities: [
      { slot: "C", name: "Dark Cover", type: "smoke", charges: 2, isUltimate: false },
      { slot: "Q", name: "Paranoia", type: "flash", charges: 1, isUltimate: false },
      { slot: "E", name: "Shrouded Step", type: "dash", charges: 2, isUltimate: false },
      { slot: "X", name: "From the Shadows", type: "dash", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "brimstone",
    displayName: "Brimstone",
    role: "controller",
    abilities: [
      { slot: "C", name: "Sky Smoke", type: "smoke", charges: 3, isUltimate: false },
      { slot: "Q", name: "Stim Beacon", type: "dash", charges: 1, isUltimate: false },
      { slot: "E", name: "Incendiary", type: "mollie", charges: 2, isUltimate: false },
      { slot: "X", name: "Orbital Strike", type: "mollie", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "viper",
    displayName: "Viper",
    role: "controller",
    abilities: [
      { slot: "C", name: "Snake Bite", type: "mollie", charges: 2, isUltimate: false },
      { slot: "Q", name: "Poison Cloud", type: "smoke", charges: 1, isUltimate: false },
      { slot: "E", name: "Toxic Screen", type: "wall", charges: 1, isUltimate: false },
      { slot: "X", name: "Viper's Pit", type: "smoke", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "astra",
    displayName: "Astra",
    role: "controller",
    abilities: [
      { slot: "C", name: "Gravity Well", type: "gravity_well", charges: 2, isUltimate: false },
      { slot: "Q", name: "Nebula", type: "smoke", charges: 2, isUltimate: false },
      { slot: "E", name: "Nova Pulse", type: "concussion", charges: 1, isUltimate: false },
      { slot: "X", name: "Cosmic Divide", type: "wall", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "harbor",
    displayName: "Harbor",
    role: "controller",
    abilities: [
      { slot: "C", name: "Cascade", type: "wall", charges: 2, isUltimate: false },
      { slot: "Q", name: "High Tide", type: "wall", charges: 1, isUltimate: false },
      { slot: "E", name: "Cove", type: "smoke", charges: 1, isUltimate: false },
      { slot: "X", name: "Reckoning", type: "gravity_well", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "clove",
    displayName: "Clove",
    role: "controller",
    abilities: [
      { slot: "C", name: "Pick-Me-Up", type: "heal", charges: 1, isUltimate: false },
      { slot: "Q", name: "Ruse", type: "smoke", charges: 2, isUltimate: false },
      { slot: "E", name: "Meddle", type: "smoke", charges: 1, isUltimate: false },
      { slot: "X", name: "Not Dead Yet", type: "revive", charges: 1, isUltimate: true },
    ],
  },

  // ===== SENTINELS =====
  {
    id: "sage",
    displayName: "Sage",
    role: "sentinel",
    abilities: [
      { slot: "C", name: "Slow Orb", type: "gravity_well", charges: 1, isUltimate: false },
      { slot: "Q", name: "Barrier Orb", type: "wall", charges: 1, isUltimate: false },
      { slot: "E", name: "Healing Orb", type: "heal", charges: 2, isUltimate: false },
      { slot: "X", name: "Resurrection", type: "revive", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "cypher",
    displayName: "Cypher",
    role: "sentinel",
    abilities: [
      { slot: "C", name: "Spycam", type: "sensor", charges: 1, isUltimate: false },
      { slot: "Q", name: "Cyber Cage", type: "smoke", charges: 2, isUltimate: false },
      { slot: "E", name: "Trapwire", type: "trap", charges: 3, isUltimate: false },
      { slot: "X", name: "Neural Theft", type: "sensor", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "killjoy",
    displayName: "Killjoy",
    role: "sentinel",
    abilities: [
      { slot: "C", name: "Alarmbot", type: "alarm", charges: 1, isUltimate: false },
      { slot: "Q", name: "Turret", type: "turret", charges: 1, isUltimate: false },
      { slot: "E", name: "Nanoswarm", type: "nanoswarm", charges: 2, isUltimate: false },
      { slot: "X", name: "Lockdown", type: "sensor", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "chamber",
    displayName: "Chamber",
    role: "sentinel",
    abilities: [
      { slot: "C", name: "Rendezvous", type: "dash", charges: 1, isUltimate: false },
      { slot: "Q", name: "Trademark", type: "trap", charges: 2, isUltimate: false },
      { slot: "E", name: "Headhunter", type: "concussion", charges: 1, isUltimate: false },
      { slot: "X", name: "Tour de Force", type: "concussion", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "deadlock",
    displayName: "Deadlock",
    role: "sentinel",
    abilities: [
      { slot: "C", name: "Barrier Mesh", type: "wall", charges: 1, isUltimate: false },
      { slot: "Q", name: "Sonic Sensor", type: "sensor", charges: 1, isUltimate: false },
      { slot: "E", name: "GravNet", type: "gravity_well", charges: 1, isUltimate: false },
      { slot: "X", name: "Annihilation", type: "gravity_well", charges: 1, isUltimate: true },
    ],
  },
  {
    id: "vyse",
    displayName: "Vyse",
    role: "sentinel",
    abilities: [
      { slot: "C", name: "Arc Rose", type: "flash", charges: 2, isUltimate: false },
      { slot: "Q", name: "Shear", type: "wall", charges: 2, isUltimate: false },
      { slot: "E", name: "Razorvine", type: "mollie", charges: 1, isUltimate: false },
      { slot: "X", name: "Steel Garden", type: "gravity_well", charges: 1, isUltimate: true },
    ],
  },
];

/**
 * Get non-ultimate (usable) abilities for an agent.
 * Filters out X slot abilities.
 */
export function getAgentUtility(agentId: string): Array<{
  type: UtilityType;
  agentId: string;
  charges: number;
  name: string;
  slot: AbilitySlot;
}> {
  const agent = ALL_AGENTS.find((a) => a.id === agentId);
  if (!agent) return [];

  return agent.abilities
    .filter((a) => !a.isUltimate)
    .map((a) => ({
      type: a.type,
      agentId: agent.id,
      charges: a.charges,
      name: a.name,
      slot: a.slot,
    }));
}

/**
 * Get all non-ultimate abilities across multiple agents.
 */
export function getCompUtility(agentIds: string[]) {
  return agentIds.flatMap((id) => getAgentUtility(id));
}
