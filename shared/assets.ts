/**
 * Asset Registry — maps agent IDs and ability names to actual asset file names.
 * 
 * Agent icons: `assets/agents/{AgentName}_icon.webp`
 * Ability icons: `assets/utility/{AbilityName}.webp`
 * 
 * All paths are relative to the frontend `public/` directory.
 */

// ========================================
// Agent icon mapping (file name → agent ID)
// ========================================

export const AGENT_ICONS: Record<string, string> = {
  // Duelists
  jett: "Jett_icon.webp",
  raze: "Raze_icon.webp",
  phoenix: "Phoenix_icon.webp",
  reyna: "Reyna_icon.webp",
  yoru: "Yoru_icon.webp",
  neon: "Neon_icon.webp",
  iso: "Iso_icon.webp",
  miks: "Miks_icon.webp",

  // Initiators
  sova: "Sova_icon.webp",
  breach: "Breach_icon.webp",
  skye: "Skye_icon.webp",
  kayo: "KAYO_icon.webp",
  fade: "Fade_icon.webp",
  gekko: "Gekko_icon.webp",
  tejo: "Tejo_icon.webp",

  // Controllers
  omen: "Omen_icon.webp",
  brimstone: "Brimstone_icon.webp",
  viper: "Viper_icon.webp",
  astra: "Astra_icon.webp",
  harbor: "Harbor_icon.webp",
  clove: "Clove_icon.webp",

  // Sentinels
  sage: "Sage_icon.webp",
  cypher: "Cypher_icon.webp",
  killjoy: "Killjoy_icon.webp",
  chamber: "Chamber_icon.webp",
  deadlock: "Deadlock_icon.webp",
  vyse: "Vyse_icon.webp",
};

// ========================================
// Ability icon mapping (ability name → file name)
// These match the ability `name` field in agentAbilities.ts
// ========================================

export const ABILITY_ICONS: Record<string, string> = {
  // Jett
  "Updraft": "Updraft.webp",
  "Tailwind": "Tailwind.webp",
  "Cloudburst": "Cloudburst.webp",
  "Blade Storm": "Blade_Storm.webp",

  // Raze
  "Blast Pack": "Blast_Pack.webp",
  "Paint Shells": "Paint_Shells.webp",
  "Boom Bot": "Boom_Bot.webp",
  "Showstopper": "Showstopper.webp",

  // Phoenix
  "Blaze": "Blaze.webp",
  "Curveball": "Curveball.webp",
  "Hot Hands": "Hot_Hands.webp",
  "Run It Back": "Run_it_Back.webp",

  // Reyna
  "Leer": "Leer.webp",
  "Devour": "Devour.webp",
  "Dismiss": "Dismiss.webp",
  "Empress": "Empress.webp",

  // Yoru
  "Fakeout": "Fakeout.webp",
  "Blindside": "Blindside.webp",
  "Gatecrash": "Gatecrash.webp",
  "Dimensional Drift": "Dimensional_Drift.webp",

  // Neon
  "High Gear": "High_Gear.webp",
  "Relay Bolt": "Relay_Bolt.webp",
  "Fast Lane": "Fast_Lane.webp",
  "Overdrive": "Overdrive.webp",

  // Iso
  "Undercut": "Undercut.webp",
  "Double Tap": "Double_Tap.webp",
  "Contingency": "Contingency.webp",
  "Kill Contract": "Kill_Contract.webp",

  // Sova
  "Recon Bolt": "Recon_Bolt.webp",
  "Shock Bolt": "Shock_Bolt.webp",
  "Owl Drone": "Owl_Drone.webp",
  "Hunter's Fury": "Hunter%27s_Fury.webp",

  // Breach
  "Aftershock": "Aftershock.webp",
  "Fault Line": "Fault_Line.webp",
  "Flashpoint": "Flashpoint.webp",
  "Rolling Thunder": "Rolling_Thunder.webp",

  // Skye
  "Trailblazer": "Trailblazer.webp",
  "Guiding Light": "Guiding_Light.webp",
  "Regrowth": "Regrowth.webp",
  "Seekers": "Seekers.webp",

  // KAY/O
  "Flash/Drive": "FLASH-drive.webp",
  "FRAG/ment": "FRAG-ment.webp",
  "ZERO/POINT": "ZERO-point.webp",
  "NULL/cmd": "NULL-cmd.webp",

  // Fade
  "Seize": "Seize.webp",
  "Haunt": "Haunt.webp",
  "Prowler": "Prowler.webp",
  "Nightfall": "Nightfall.webp",

  // Gekko
  "Dizzy": "Dizzy.webp",
  "Wingman": "Wingman.webp",
  "Mosh Pit": "Mosh_Pit.webp",
  "Thrash": "Thrash.webp",

  // Omen
  "Dark Cover": "Dark_Cover.webp",
  "Paranoia": "Paranoia.webp",
  "Shrouded Step": "Shrouded_Step.webp",
  "From the Shadows": "From_the_Shadows.webp",

  // Brimstone
  "Sky Smoke": "Sky_Smoke.webp",
  "Stim Beacon": "Stim_Beacon.webp",
  "Incendiary": "Incendiary.webp",
  "Orbital Strike": "Orbital_Strike.webp",

  // Viper
  "Snake Bite": "Snake_Bite.webp",
  "Poison Cloud": "Poison_Cloud.webp",
  "Toxic Screen": "Toxic_Screen.webp",
  "Viper's Pit": "Vipers_Pit.webp",

  // Astra
  "Gravity Well": "Gravity_Well.webp",
  "Nebula": "Nebula_-_Dissipate.webp",
  "Nova Pulse": "Nova_Pulse.webp",
  "Cosmic Divide": "Cosmic_Divide.webp",

  // Harbor
  "Cascade": "Cascade.webp",
  "High Tide": "High_Tide.webp",
  "Cove": "Cove.webp",
  "Reckoning": "Reckoning.webp",

  // Clove
  "Pick-Me-Up": "Pick-me-up.webp",
  "Ruse": "Ruse.webp",
  "Meddle": "Meddle.webp",
  "Not Dead Yet": "Not_Dead_Yet.webp",

  // Sage
  "Slow Orb": "Slow_Orb.webp",
  "Barrier Orb": "Barrier_Orb.webp",
  "Healing Orb": "Healing_Orb.webp",
  "Resurrection": "Resurrection.webp",

  // Cypher
  "Spycam": "Spycam.webp",
  "Cyber Cage": "Cyber_Cage.webp",
  "Trapwire": "Trapwire.webp",
  "Neural Theft": "Neural_Theft.webp",

  // Killjoy
  "Alarmbot": "Alarmbot.webp",
  "Turret": "Turret.webp",
  "Nanoswarm": "Nanoswarm.webp",
  "Lockdown": "Lockdown.webp",

  // Chamber
  "Rendezvous": "Rendezvous.webp",
  "Trademark": "Trademark.webp",
  "Headhunter": "Headhunter.webp",
  "Tour de Force": "Tour_De_Force.webp",

  // Deadlock
  "Barrier Mesh": "Barrier_Mesh.webp",
  "Sonic Sensor": "Sonic_Sensor.webp",
  "GravNet": "GravNet.webp",
  "Annihilation": "Annihilation.webp",

  // Vyse
  "Arc Rose": "Arc_Rose.webp",
  "Shear": "Shear.webp",
  "Razorvine": "Razorvine.webp",
  "Steel Garden": "Steel_Garden.webp",
};

// ========================================
// Helper functions
// ========================================

/**
 * Get the public URL for an agent icon.
 * Uses the display name from the file (e.g., "KAYO_icon.webp" not "kayo_icon.webp")
 */
export function getAgentIconUrl(agentId: string): string {
  const fileName = AGENT_ICONS[agentId];
  if (!fileName) {
    console.warn(`[Assets] No icon found for agent: ${agentId}`);
    return "";
  }
  return `/assets/agents/${fileName}`;
}

/**
 * Get the agent display name from the file name (for building URLs).
 */
export function getAgentDisplayName(agentId: string): string {
  const fileName = AGENT_ICONS[agentId];
  if (!fileName) return agentId;
  // e.g., "KAYO_icon.webp" → "KAYO"
  return fileName.replace("_icon.webp", "");
}

/**
 * Get the public URL for an ability icon by ability name.
 */
export function getAbilityIconUrl(abilityName: string): string {
  const fileName = ABILITY_ICONS[abilityName];
  if (!fileName) {
    console.warn(`[Assets] No icon found for ability: ${abilityName}`);
    return "";
  }
  return `/assets/utility/${fileName}`;
}

/**
 * Get all ability icon URLs for a specific agent.
 */
export function getAgentAbilityIcons(agentId: string): Record<string, string> {
  // Import dynamically to avoid circular deps
  const { ALL_AGENTS } = require("./agentAbilities");
  const agent = ALL_AGENTS.find((a: any) => a.id === agentId);
  if (!agent) return {};

  const icons: Record<string, string> = {};
  for (const ability of agent.abilities) {
    icons[ability.name] = getAbilityIconUrl(ability.name);
  }
  return icons;
}

/**
 * List all agent IDs that have icons available.
 */
export function getAvailableAgentIds(): string[] {
  return Object.keys(AGENT_ICONS);
}

/**
 * Check if an ability icon exists.
 */
export function hasAbilityIcon(abilityName: string): boolean {
  return abilityName in ABILITY_ICONS;
}

/**
 * Check if an agent icon exists.
 */
export function hasAgentIcon(agentId: string): boolean {
  return agentId in AGENT_ICONS;
}
