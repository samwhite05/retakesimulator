// ============================================================
// Shared TypeScript types for Retake Roulette
// Used by both frontend and backend
// ============================================================

// ---- Basic Geometry ----

export interface Position {
  x: number;  // 0-1 as percentage of minimap width
  y: number;  // 0-1 as percentage of minimap height
}

export interface LinePath {
  points: Position[];
  color?: string;
}

export interface Arrow {
  agentId: string;
  path: Position[];
}

// ---- Utility Definitions ----

export type UtilityType =
  | "smoke"
  | "flash"
  | "mollie"      // Incendiary/Molotov
  | "dart"        // Sova recon / Skye seeker
  | "dash"        // Jett updraft / neon dash
  | "concussion"
  | "decoy"
  | "gravity_well"
  | "nanoswarm"
  | "tripwire"
  | "trap"
  | "heal"        // Sage heal / Clove pick-me-up
  | "revive"      // Sage rez
  | "wall"        // Sage wall / Neon fast lane
  | "turret"      // Killjoy turret
  | "sensor"      // Cypher spycam / Fade haunt
  | "alarm";      // Killjoy alarmbot

export interface UtilityDef {
  type: UtilityType;
  agentId: string;  // Which agent owns this utility
  charges: number;  // How many uses (e.g., 2 smokes = 2 charges)
}

export interface UtilityItem {
  id: string;               // Unique ID for this placement
  type: UtilityType;
  agentId: string;
  position: Position;       // Where it's placed on minimap
  target?: Position;        // For darts/flashes — where it's aimed
  path?: Position[];        // For darts — the flight path
}

// ---- Agent Definitions ----

export interface AgentDef {
  id: string;           // e.g., "sova", "omen", "jett"
  displayName: string;  // e.g., "Sova"
  position: Position;   // Starting position on minimap
  role: "duelist" | "initiator" | "controller" | "sentinel";
}

export interface EnemyDef {
  id: string;
  position: Position;
  agent?: string;       // Known or suspected agent
  isHidden: boolean;    // True = off-angle, not shown to player initially
  weapon?: "vandal" | "phantom" | "operator" | "sheriff" | "guardian";
}

// ---- Rules & Evaluation ----

export type RuleCategory = "critical" | "important" | "minor";

export interface RuleResult {
  ruleId: string;
  description: string;
  category: RuleCategory;
  maxPoints: number;
  earnedPoints: number;
  passed: boolean;
  detail: string;  // Human-readable explanation
}

export interface Rule {
  id: string;
  description: string;
  category: RuleCategory;
  points: number;
  // Evaluation is done server-side — this is the serializable definition
  check: RuleCheck;
}

export interface RuleCheck {
  type: "utility_placed" | "angle_cleared" | "path_overlaps" | "proximity" | "coverage" | "utility_placed_with_los";
  targetArea: AreaDef;      // Region of the minimap to check
  requiredUtility?: UtilityType[];  // What utility types satisfy this
  requiredAgent?: string[];         // Which agents must be present
  minAgents?: number;               // Minimum agents in area
  lineOfSight?: LOSCheck;           // LOS requirement (for utility_placed_with_los)
}

export interface LOSCheck {
  fromAgent: string;        // Agent ID that the utility originates from
  toTarget: boolean;        // If true, checks LOS from agent to utility placement
  toAreaCenter?: boolean;   // If true, checks LOS from agent to target area center
  blockedBy?: "walls";      // What blocks LOS (currently only walls)
}

export interface AreaDef {
  center: Position;
  radius: number;    // Radius as % of minimap
  shape?: "circle" | "rectangle" | "polygon";
  points?: Position[];  // For polygon shapes
}

// ---- Scenario Definition ----

export interface Scenario {
  id: string;
  name: string;              // "Ascent B-Site | 3v2 Post-Plant"
  map: string;               // "ascent"
  minimapImage: string;      // URL/path to minimap image

  // The setup shown to player
  spikeSite: Position;
  friendlyAgents: AgentDef[];
  enemyAgents: EnemyDef[];     // Visible enemies
  hiddenEnemies: EnemyDef[];   // Off-angles (revealed during cinematic)

  // What the player can use
  availableAgents: string[];       // Agent IDs player can pick
  availableUtility: UtilityDef[];  // Utility pool

  // Evaluation
  rules: Rule[];

  // Animation event vocabulary
  events: ScenarioEvents;

  // Metadata
  releaseDate: string;       // ISO date — when this scenario goes live
  difficulty: number;        // 1-5, for display
  description: string;       // Briefing text
}

export interface ScenarioEvents {
  successEvents: AnimationEventTemplate[];  // Events for passed rules
  failureEvents: AnimationEventTemplate[];  // Events for failed rules
  deathEvents: DeathEventTemplate[];        // Who dies based on score tier
}

export interface AnimationEventTemplate {
  trigger: string;  // Rule ID or condition that triggers this
  type: AnimationEventType;
  actorAgent?: string;
  description: string;
}

export interface DeathEventTemplate {
  condition: "tier_clean" | "tier_messy" | "tier_failed";
  victimAgent: string;        // Which agent dies
  killerAgent?: string;       // Who killed them (or "hidden_enemy")
  location: Position;
  description: string;
}

// ---- Player Plan ----

export interface PlayerPlan {
  scenarioId: string;
  agentSelection: string[];         // Selected agent IDs
  agentPositions: AgentPosition[];  // Where agents start from
  utilityPlacements: UtilityItem[];
  movementArrows: Arrow[];
  createdAt: string;
}

export interface AgentPosition {
  agentId: string;
  position: Position;
}

// ---- Outcome (generated by rule engine) ----

export interface Outcome {
  score: number;
  maxScore: number;
  scoreBreakdown: RuleResult[];
  tier: "clean" | "messy" | "failed";

  // Animation events
  events: AnimationEvent[];

  // Feedback text
  summary: string;
  highlights: string[];
  mistakes: string[];
}

// ---- Animation System ----

export type AnimationEventType =
  | "utility_deploy"
  | "flash_detonate"
  | "mollie_erupt"
  | "smoke_expand"
  | "dart_fire"
  | "dash"
  | "reveal"
  | "kill"
  | "defuse_start"
  | "defuse_complete"
  | "spike_explosion"
  | "agent_spawn"
  | "agent_despawn";

export interface AnimationEvent {
  id: string;
  type: AnimationEventType;
  actor: string;            // Agent ID or utility type
  position: Position;
  target?: string;          // Target agent ID (for kills/flashes)
  path?: Position[];        // Movement path (for dashes, darts)
  delay: number;            // ms from animation start
  duration: number;         // ms this event plays for
  metadata?: Record<string, unknown>;
}

// ---- Community & Voting ----

export interface CommunityPlan {
  id: string;
  scenarioId: string;
  userHash: string;
  plan: PlayerPlan;
  score: number;
  tier: "clean" | "messy" | "failed";
  outcome: Outcome;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

// ---- Play Tracking ----

export interface PlayRecord {
  userHash: string;
  date: string;           // YYYY-MM-DD
  count: number;          // Plays used today
  adGranted: boolean;     // Whether ad was watched for extra play
  adWatched: boolean;
  adRevenue?: number;     // Revenue from ad (for analytics)
}

// ---- API Response Types ----

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ScenarioResponse {
  scenario: Scenario;
  playsRemaining: number;
  hasAdAvailable: boolean;
}

export interface SubmitPlanRequest {
  plan: PlayerPlan;
}

export interface SubmitPlanResponse {
  outcome: Outcome;
  communityRank?: number;
  totalSubmissions: number;
}
