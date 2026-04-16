import { AgentRole, TileType, UtilityType } from "@/types";

export const GRID_COLS = 48;
export const GRID_ROWS = 48;

/**
 * Movement budgets are tuned so that every role can cross the map to the
 * spike in a single entry wave, then still have enough fuel to re-site or
 * rotate post-plant. Values are in "tile-costs" (see TILE_COST): diagonal
 * moves cost 1, chokepoint tiles cost 1.25, everything else costs 1.
 */
export const ROLE_MOVEMENT: Record<
  AgentRole,
  { range: number; diagonal: boolean; dashRange?: number }
> = {
  duelist: { range: 26, diagonal: true, dashRange: 36 },
  initiator: { range: 22, diagonal: true },
  controller: { range: 20, diagonal: true },
  sentinel: { range: 18, diagonal: true },
};

/**
 * Tile traversal costs. Chokepoints are softened from 2.0 → 1.25 so that
 * "some tiles I can reach, some I can't" never feels arbitrary. Spike-zone
 * tiles are freely walkable — the retake has to end on them.
 */
export const TILE_COST: Record<TileType, number> = {
  walkable: 1,
  wall: Infinity,
  void: Infinity,
  chokepoint: 1.25,
  cover: 1,
  exposed: 1,
  high_ground: 1,
  spike_zone: 1,
};

export const METERS_PER_TILE = 1.375;

// Tile scale: ~1 tile = 1.375 meters (based on 48x48 Ascent map proportions)
export const UTILITY_RADIUS: Record<UtilityType, number> = {
  smoke: 1.5,
  flash: 1.5,
  mollie: 1.45,
  dart: 11.0,
  dash: 0,
  updraft: 0,
  concussion: 2.0,
  decoy: 0,
  gravity_well: 2.5,
  nanoswarm: 1.64,
  tripwire: 0,
  trap: 1.5,
  heal: 0,
  revive: 0,
  wall: 0,
  turret: 2,
  sensor: 2.5,
  alarm: 2,
};

export interface UtilityRenderSpec {
  shape: "circle" | "capsule" | "cone" | "wall" | "fastlane" | "tripwire" | "none";
  radiusMeters?: number;
  widthMeters?: number;
  lengthMeters?: number;
  gapMeters?: number;
}

/** Returns accurate visual shape + dimensions for a specific agent+ability combo */
export function getUtilityRenderSpec(agentId: string, type: UtilityType): UtilityRenderSpec {
  switch (type) {
    case "smoke":
      return { shape: "circle", radiusMeters: agentId === "jett" ? 3.35 : 4.1 };
    case "flash":
      if (agentId === "omen") return { shape: "capsule", widthMeters: 8.6, lengthMeters: 25 };        // Paranoia
      if (agentId === "breach") return { shape: "capsule", widthMeters: 6, lengthMeters: 12 };       // Flashpoint
      return { shape: "circle", radiusMeters: 4.0 };
    case "mollie":
      if (agentId === "sova") return { shape: "circle", radiusMeters: 4.0 };                         // Shock Bolt
      if (agentId === "killjoy") return { shape: "circle", radiusMeters: 4.5 };                      // Nanoswarm
      if (agentId === "breach") return { shape: "capsule", widthMeters: 6, lengthMeters: 10 };       // Aftershock
      return { shape: "circle", radiusMeters: 4.0 };
    case "dart":
      return { shape: "circle", radiusMeters: agentId === "sova" ? 30 : 10 };
    case "concussion":
      if (agentId === "breach") return { shape: "capsule", widthMeters: 7.5, lengthMeters: 55 };     // Fault Line
      return { shape: "circle", radiusMeters: 5.5 };
    case "wall":
      if (agentId === "phoenix") return { shape: "wall", widthMeters: 1.0, lengthMeters: 21 };       // Blaze
      if (agentId === "sage") return { shape: "wall", widthMeters: 1.0, lengthMeters: 12 };          // Barrier
      if (agentId === "viper") return { shape: "wall", widthMeters: 1.0, lengthMeters: 50 };         // Toxic Screen
      if (agentId === "neon") return { shape: "fastlane", widthMeters: 0.8, lengthMeters: 18, gapMeters: 3.5 };
      if (agentId === "harbor") return { shape: "wall", widthMeters: 1.0, lengthMeters: 25 };        // High Tide
      return { shape: "wall", widthMeters: 1.0, lengthMeters: 15 };
    case "trap":
      return { shape: "circle", radiusMeters: 1.5 };
    case "tripwire":
      return { shape: "tripwire", widthMeters: 0.2 };
    case "sensor":
      return { shape: "circle", radiusMeters: 2.5 };
    case "alarm":
      return { shape: "circle", radiusMeters: 2.0 };
    case "gravity_well":
      return { shape: "circle", radiusMeters: 3.0 };
    case "dash":
    case "updraft":
    case "heal":
    case "revive":
    case "decoy":
      return { shape: "none" };
    default:
      return { shape: "circle", radiusMeters: 3.0 };
  }
}

/** Legacy helper – returns an approximate radius in tiles for circular abilities */
export function getUtilityVisualRadius(agentId: string, type: UtilityType): number {
  const spec = getUtilityRenderSpec(agentId, type);
  if (spec.shape === "circle" && spec.radiusMeters) return spec.radiusMeters / METERS_PER_TILE;
  if (spec.widthMeters) return spec.widthMeters / METERS_PER_TILE;
  return 1.5;
}

/**
 * Tone family for each utility — drives planning-map glyph colors, feed icons,
 * and cinematic FX palettes. Loosely mapped to how Valorant telegraphs each
 * ability on the minimap (violet = vision-denial, amber = light/flash,
 * red = damage, teal = info/recon/heal, iron = barriers).
 */
export type UtilityTone = "violet" | "amber" | "red" | "teal" | "iron";

export function getUtilityTone(type: UtilityType): UtilityTone {
  switch (type) {
    case "smoke":
    case "gravity_well":
    case "decoy":
      return "violet";
    case "flash":
    case "concussion":
      return "amber";
    case "mollie":
    case "nanoswarm":
      return "red";
    case "dart":
    case "sensor":
    case "heal":
    case "revive":
    case "trap":
    case "tripwire":
    case "alarm":
    case "turret":
      return "teal";
    case "wall":
    case "updraft":
    case "dash":
    default:
      return "iron";
  }
}

/** Approximate in-sim lifetime (seconds) for duration-based utility. */
export const UTILITY_DURATION_SEC: Record<UtilityType, number> = {
  smoke: 15,
  flash: 1.75,
  mollie: 7,
  nanoswarm: 5,
  concussion: 3.25,
  dart: 3,
  wall: 20,
  trap: 45,
  tripwire: 45,
  alarm: 45,
  turret: 45,
  sensor: 10,
  gravity_well: 2.75,
  heal: 0,
  revive: 0,
  decoy: 6,
  dash: 0,
  updraft: 0,
};

/**
 * Fallback ability name for a util type when the placing agent isn't in the
 * roster. Keeps labels legible even for sparse scenarios.
 */
const UTILITY_GENERIC_NAME: Record<UtilityType, string> = {
  smoke: "Smoke",
  flash: "Flash",
  mollie: "Incendiary",
  nanoswarm: "Nanoswarm",
  concussion: "Concussion",
  dart: "Recon",
  wall: "Wall",
  trap: "Trap",
  tripwire: "Tripwire",
  alarm: "Alarmbot",
  turret: "Turret",
  sensor: "Sensor",
  gravity_well: "Gravity Well",
  heal: "Heal",
  revive: "Revive",
  decoy: "Decoy",
  dash: "Dash",
  updraft: "Updraft",
};

/**
 * Returns the Valorant ability name + its role-coded tone + duration for a
 * given agent + utility type placement. Used by the utility bay, planning
 * glyphs, feed, and cinematic captions so everything shares one source of
 * truth. Falls back to a sensible generic name when we don't have per-agent
 * metadata.
 */
export function getAbilityDisplayInfo(
  agentId: string,
  type: UtilityType
): { name: string; slot: "C" | "Q" | "E" | "X" | null; tone: UtilityTone; durationSec: number } {
  const def = getAgentDef(agentId);
  const ability = def?.abilities.find((a) => a.type === type);
  return {
    name: ability?.name ?? UTILITY_GENERIC_NAME[type],
    slot: ability?.slot ?? null,
    tone: getUtilityTone(type),
    durationSec: UTILITY_DURATION_SEC[type] ?? 0,
  };
}

export const WEAPON_DAMAGE: Record<string, { min: number; max: number }> = {
  vandal: { min: 40, max: 65 },
  phantom: { min: 35, max: 55 },
  sheriff: { min: 45, max: 70 },
  operator: { min: 100, max: 150 },
};

export const AGENT_ROSTER: { id: string; displayName: string; role: AgentRole }[] = [
  // Duelists
  { id: "jett", displayName: "Jett", role: "duelist" },
  { id: "raze", displayName: "Raze", role: "duelist" },
  { id: "phoenix", displayName: "Phoenix", role: "duelist" },
  { id: "reyna", displayName: "Reyna", role: "duelist" },
  { id: "yoru", displayName: "Yoru", role: "duelist" },
  { id: "neon", displayName: "Neon", role: "duelist" },
  { id: "iso", displayName: "Iso", role: "duelist" },
  // Initiators
  { id: "sova", displayName: "Sova", role: "initiator" },
  { id: "breach", displayName: "Breach", role: "initiator" },
  { id: "skye", displayName: "Skye", role: "initiator" },
  { id: "kayo", displayName: "KAY/O", role: "initiator" },
  { id: "fade", displayName: "Fade", role: "initiator" },
  { id: "gekko", displayName: "Gekko", role: "initiator" },
  { id: "tejo", displayName: "Tejo", role: "initiator" },
  // Controllers
  { id: "omen", displayName: "Omen", role: "controller" },
  { id: "brimstone", displayName: "Brimstone", role: "controller" },
  { id: "viper", displayName: "Viper", role: "controller" },
  { id: "astra", displayName: "Astra", role: "controller" },
  { id: "harbor", displayName: "Harbor", role: "controller" },
  { id: "clove", displayName: "Clove", role: "controller" },
  // Sentinels
  { id: "sage", displayName: "Sage", role: "sentinel" },
  { id: "cypher", displayName: "Cypher", role: "sentinel" },
  { id: "killjoy", displayName: "Killjoy", role: "sentinel" },
  { id: "chamber", displayName: "Chamber", role: "sentinel" },
  { id: "deadlock", displayName: "Deadlock", role: "sentinel" },
  { id: "vyse", displayName: "Vyse", role: "sentinel" },
];

export function getAgentDef(agentId: string) {
  const base = AGENT_ROSTER.find((a) => a.id === agentId);
  if (!base) return null;
  return {
    ...base,
    abilities: getAbilitiesForAgent(agentId),
  };
}

function getAbilitiesForAgent(agentId: string) {
  const defs: Record<string, { slot: "C" | "Q" | "E" | "X"; name: string; type: UtilityType; charges: number }[]> = {
    jett: [
      { slot: "Q", name: "Updraft", type: "updraft", charges: 1 },
      { slot: "E", name: "Tailwind", type: "dash", charges: 1 },
      { slot: "C", name: "Cloudburst", type: "smoke", charges: 2 },
    ],
    raze: [
      { slot: "Q", name: "Blast Pack", type: "dash", charges: 2 },
      { slot: "E", name: "Paint Shells", type: "mollie", charges: 1 },
      { slot: "C", name: "Boom Bot", type: "sensor", charges: 1 },
    ],
    phoenix: [
      { slot: "Q", name: "Curveball", type: "flash", charges: 2 },
      { slot: "E", name: "Hot Hands", type: "mollie", charges: 1 },
      { slot: "C", name: "Blaze", type: "wall", charges: 1 },
    ],
    reyna: [
      { slot: "Q", name: "Devour", type: "heal", charges: 2 },
      { slot: "E", name: "Dismiss", type: "dash", charges: 2 },
      { slot: "C", name: "Leer", type: "flash", charges: 2 },
    ],
    yoru: [
      { slot: "Q", name: "Blindside", type: "flash", charges: 2 },
      { slot: "E", name: "Gatecrash", type: "dash", charges: 1 },
      { slot: "C", name: "Fakeout", type: "decoy", charges: 1 },
    ],
    neon: [
      { slot: "Q", name: "Relay Bolt", type: "concussion", charges: 2 },
      { slot: "E", name: "High Gear", type: "dash", charges: 1 },
      { slot: "C", name: "Fast Lane", type: "wall", charges: 1 },
    ],
    iso: [
      { slot: "Q", name: "Undercut", type: "concussion", charges: 2 },
      { slot: "E", name: "Double Tap", type: "heal", charges: 1 },
      { slot: "C", name: "Contingency", type: "wall", charges: 1 },
    ],
    sova: [
      { slot: "Q", name: "Shock Bolt", type: "mollie", charges: 2 },
      { slot: "E", name: "Recon Bolt", type: "dart", charges: 1 },
      { slot: "C", name: "Owl Drone", type: "sensor", charges: 1 },
    ],
    breach: [
      { slot: "Q", name: "Flashpoint", type: "flash", charges: 2 },
      { slot: "E", name: "Fault Line", type: "concussion", charges: 1 },
      { slot: "C", name: "Aftershock", type: "mollie", charges: 1 },
    ],
    skye: [
      { slot: "Q", name: "Trailblazer", type: "sensor", charges: 1 },
      { slot: "E", name: "Guiding Light", type: "flash", charges: 2 },
      { slot: "C", name: "Regrowth", type: "heal", charges: 1 },
    ],
    kayo: [
      { slot: "Q", name: "Flash/Drive", type: "flash", charges: 2 },
      { slot: "E", name: "Zero/Point", type: "dart", charges: 1 },
      { slot: "C", name: "Frag/Ment", type: "mollie", charges: 1 },
    ],
    fade: [
      { slot: "Q", name: "Seize", type: "concussion", charges: 2 },
      { slot: "E", name: "Haunt", type: "dart", charges: 1 },
      { slot: "C", name: "Prowler", type: "sensor", charges: 2 },
    ],
    gekko: [
      { slot: "Q", name: "Wingman", type: "concussion", charges: 1 },
      { slot: "E", name: "Dazzler", type: "flash", charges: 2 },
      { slot: "C", name: "Mosh Pit", type: "mollie", charges: 1 },
    ],
    tejo: [
      { slot: "Q", name: "Stealth Drone", type: "sensor", charges: 2 },
      { slot: "E", name: "Guided Salvo", type: "mollie", charges: 1 },
      { slot: "C", name: "Special Delivery", type: "flash", charges: 1 },
    ],
    omen: [
      { slot: "Q", name: "Paranoia", type: "flash", charges: 2 },
      { slot: "E", name: "Dark Cover", type: "smoke", charges: 2 },
      { slot: "C", name: "Shrouded Step", type: "dash", charges: 2 },
    ],
    brimstone: [
      { slot: "Q", name: "Incendiary", type: "mollie", charges: 1 },
      { slot: "E", name: "Sky Smoke", type: "smoke", charges: 3 },
      { slot: "C", name: "Stim Beacon", type: "sensor", charges: 1 },
    ],
    viper: [
      { slot: "Q", name: "Poison Cloud", type: "smoke", charges: 1 },
      { slot: "E", name: "Toxic Screen", type: "wall", charges: 1 },
      { slot: "C", name: "Snake Bite", type: "mollie", charges: 2 },
    ],
    astra: [
      { slot: "Q", name: "Nova Pulse", type: "concussion", charges: 1 },
      { slot: "E", name: "Nebula", type: "smoke", charges: 2 },
      { slot: "C", name: "Gravity Well", type: "gravity_well", charges: 1 },
    ],
    harbor: [
      { slot: "Q", name: "High Tide", type: "wall", charges: 1 },
      { slot: "E", name: "Cove", type: "smoke", charges: 2 },
      { slot: "C", name: "Cascade", type: "concussion", charges: 1 },
    ],
    clove: [
      { slot: "Q", name: "Meddle", type: "concussion", charges: 1 },
      { slot: "E", name: "Pick-me-up", type: "heal", charges: 1 },
      { slot: "C", name: "Ruse", type: "smoke", charges: 2 },
    ],
    sage: [
      { slot: "Q", name: "Slow Orb", type: "concussion", charges: 2 },
      { slot: "E", name: "Healing Orb", type: "heal", charges: 1 },
      { slot: "C", name: "Barrier Orb", type: "wall", charges: 1 },
    ],
    cypher: [
      { slot: "Q", name: "Cyber Cage", type: "smoke", charges: 2 },
      { slot: "E", name: "Spycam", type: "sensor", charges: 1 },
      { slot: "C", name: "Trapwire", type: "trap", charges: 2 },
    ],
    killjoy: [
      { slot: "Q", name: "Alarmbot", type: "trap", charges: 1 },
      { slot: "E", name: "Turret", type: "turret", charges: 1 },
      { slot: "C", name: "Nanoswarm", type: "nanoswarm", charges: 2 },
    ],
    chamber: [
      { slot: "Q", name: "Headhunter", type: "sensor", charges: 8 },
      { slot: "E", name: "Rendezvous", type: "dash", charges: 1 },
      { slot: "C", name: "Trademark", type: "trap", charges: 1 },
    ],
    deadlock: [
      { slot: "Q", name: "Sonic Sensor", type: "trap", charges: 2 },
      { slot: "E", name: "Barrier Mesh", type: "wall", charges: 1 },
      { slot: "C", name: "GravNet", type: "concussion", charges: 1 },
    ],
    vyse: [
      { slot: "Q", name: "Shear", type: "wall", charges: 2 },
      { slot: "E", name: "Arc Rose", type: "flash", charges: 2 },
      { slot: "C", name: "Razorvine", type: "trap", charges: 1 },
    ],
  };

  return (defs[agentId] || []).map((a) => ({ ...a, isUltimate: false }));
}
