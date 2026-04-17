export type Position = { x: number; y: number };
export type TileCoord = { col: number; row: number };

export type AgentRole = "duelist" | "initiator" | "controller" | "sentinel";

export type UtilityType =
  | "smoke"
  | "flash"
  | "mollie"
  | "dart"
  | "dash"
  | "updraft"
  | "concussion"
  | "decoy"
  | "gravity_well"
  | "nanoswarm"
  | "tripwire"
  | "trap"
  | "heal"
  | "revive"
  | "wall"
  | "turret"
  | "sensor"
  | "alarm";

export type TileType =
  | "walkable"
  | "wall"
  /** Outside the minimap footprint (transparent); impassable, no grid overlay */
  | "void"
  | "chokepoint"
  | "cover"
  | "exposed"
  | "high_ground"
  | "spike_zone";

export interface AbilityDef {
  slot: "C" | "Q" | "E" | "X";
  name: string;
  type: UtilityType;
  charges: number;
  isUltimate: boolean;
}

export interface AgentDef {
  id: string;
  displayName: string;
  role: AgentRole;
  abilities: AbilityDef[];
}

export interface EnemyDef {
  id: string;
  agentId: string;
  position: Position;
  /** If set, minimap vision wedge faces this point; otherwise uses scenario spike site. */
  lookAt?: Position;
  weapon?: "vandal" | "phantom" | "sheriff" | "operator";
  isHidden?: boolean;
  offAngle?: boolean;
}

export interface FriendlyAgentDef {
  id: string;
  agentId: string;
  position: Position;
}

export interface UtilityItem {
  id: string;
  type: UtilityType;
  agentId: string;
  position: Position;
  target?: Position;
  path?: Position[];
}

export interface AgentPosition {
  agentId: string;
  position: Position;
}

export interface MovementPath {
  agentId: string;
  path: Position[]; // tile centers in order
  /** Indices in `path` where the agent pauses and holds an angle before continuing. */
  holds?: number[];
}

/** Full squad shown in planning; eliminated agents are display-only (greyed). */
export interface PlanningRosterEntry {
  agentId: string;
  eliminated: boolean;
}

export interface PlayerPlan {
  scenarioId: string;
  agentSelection: string[];
  agentPositions: AgentPosition[];
  utilityPlacements: UtilityItem[];
  /**
   * Canonical single-path-per-agent model. `holds` on each path mark where the
   * agent pauses to hold an angle before continuing. Empty path = stay put.
   */
  movementPaths?: MovementPath[];
  /** @deprecated Legacy two-wave field; read for backward compat by `normalizePlayerPlan`. */
  entryMovementPaths?: MovementPath[];
  /** @deprecated Legacy two-wave field; read for backward compat. Merged into `movementPaths`. */
  repositionMovementPaths?: MovementPath[];
  /** @deprecated Legacy wave-1 hold map. */
  entryHold?: Partial<Record<string, boolean>>;
  /** @deprecated Legacy wave-2 hold map; migrated into `holds` on `movementPaths`. */
  repositionHold?: Partial<Record<string, boolean>>;
  createdAt: string;
}

export interface AreaDef {
  center: Position;
  radius: number;
  label?: string;
}

export type RuleCategory = "critical" | "important" | "minor";

export interface Rule {
  id: string;
  description: string;
  category: RuleCategory;
  points: number;
}

export interface RuleResult {
  ruleId: string;
  description: string;
  category: RuleCategory;
  maxPoints: number;
  earnedPoints: number;
  passed: boolean;
  detail: string;
}

export interface TileDef {
  type: TileType;
  elevation?: number;
}

export interface GridMap {
  mapId: string;
  cols: number;
  rows: number;
  tiles: TileDef[][]; // tiles[row][col]
}

export interface Scenario {
  id: string;
  name: string;
  map: string;
  minimapImage: string;
  spikeSite: Position;
  friendlyAgents: FriendlyAgentDef[];
  enemyAgents: EnemyDef[];
  hiddenEnemies: EnemyDef[];
  availableAgents: string[];
  availableUtility: { type: UtilityType; agentId: string; charges: number }[];
  rules: Rule[];
  grid: GridMap;
  releaseDate?: string;
  /**
   * When true, `resolveScenarioGrid` uses `grid` from this scenario as-is (no minimap scan).
   * Set after authoring in `/scenario-editor` and pasting the exported grid into source.
   */
  authoritativeGrid?: boolean;
  /** Called server-side after the base grid is generated from the minimap image */
  applyGridOverrides?: (tiles: { type: TileType }[][]) => void;
  /** Camera focus for stylish site zoom (center in normalized coords, zoom >= 1) */
  camera?: {
    center: Position;
    zoom: number;
  };
  /** Plantable bombsite bounds in normalized coordinates */
  plantableArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Restrict agent placement to these normalized zones (union). If omitted, placement is only restricted by isSpawnable distance. */
  spawnZones?: { x: number; y: number; width: number; height: number }[];
  /** Full roster strip in planning; non-eliminated ids should match `availableAgents`. */
  planningRoster?: PlanningRosterEntry[];
}

export type OutcomeTier = "clean" | "messy" | "failed";

export interface Outcome {
  score: number;
  maxScore: number;
  scoreBreakdown: RuleResult[];
  tier: OutcomeTier;
  summary: string;
  highlights: string[];
  mistakes: string[];
  /** Grades for every decision surfaced during the interactive run. */
  decisionGrades?: DecisionRecord[];
  /** Rollup bonus earned from decisions (optimal = full, acceptable = half, bad = 0). */
  decisionScore?: number;
  /** Max rollup possible if every decision were optimal. */
  decisionMaxScore?: number;
}

export type SimulationPhase =
  | "setup"
  | "utility"
  | "movement"
  | "movement_entry"
  | "movement_reposition"
  | "combat"
  | "spike";

export interface SimAgent {
  agentId: string;
  team: "attacker" | "defender";
  hp: number;
  maxHp: number;
  position: TileCoord;
  role: AgentRole;
  weapon: "vandal" | "phantom" | "sheriff" | "operator";
  alive: boolean;
  blinded: boolean;
  stunned: boolean;
  revealed: boolean;
  offAngle?: boolean;
}

export type GameEvent =
  | { type: "agent_spawn"; agentId: string; position: Position }
  | { type: "smoke_expand"; agentId: string; position: Position; radius: number }
  | { type: "flash_travel"; agentId: string; path: Position[] }
  | { type: "flash_detonate"; position: Position; angle: number; agentId: string }
  | { type: "mollie_erupt"; agentId: string; position: Position; radius: number }
  | { type: "dart_fire"; agentId: string; path: Position[] }
  | { type: "reveal"; agentId: string; position: Position; revealedEnemy: string }
  | { type: "wall_raise"; agentId: string; tiles: Position[] }
  | { type: "heal"; agentId: string; target: string; amount: number }
  | { type: "trap_trigger"; agentId: string; victim: string; position: Position }
  | { type: "agent_move"; agentId: string; path: Position[]; speed: "walk" | "dash" }
  | { type: "duel"; attacker: string; defender: string; winner: string; damage: number }
  | { type: "kill"; victim: string; position: Position; killer: string }
  | { type: "defuse_start"; agentId: string; position: Position }
  | { type: "defuse_complete"; agentId: string; position: Position }
  | { type: "spike_explosion"; position: Position };

export interface TurnLog {
  phase: SimulationPhase;
  events: GameEvent[];
}

export interface SimulationLog {
  turns: TurnLog[];
  finalState: {
    agents: SimAgent[];
    spikeDefused: boolean;
  };
  outcome: Outcome;
  /** Every decision point surfaced during the run, in order. */
  decisionPoints?: DecisionPoint[];
  /** Every decision the player actually made, graded. */
  decisionHistory?: DecisionRecord[];
}

/**
 * Canonical list of emergent decision kinds. The engine's detector set maps
 * 1:1 onto these identifiers; the client uses the kind to pick overlay
 * copy/tone.
 */
export type DecisionKindId =
  | "first_contact"
  | "ally_down"
  | "utility_window"
  | "spike_threshold"
  | "recon_info"
  | "low_hp_duel";

export interface DecisionChoice {
  id: string;
  label: string;
  rationale: string;
  /** Chosen automatically if the decision timer elapses. */
  isDefault?: boolean;
}

export interface DecisionPoint {
  id: string;
  kind: DecisionKindId;
  triggeredBy: {
    turnIndex: number;
    agentId?: string;
    tile?: TileCoord;
  };
  /** Headline shown above the choices on the cinematic overlay. */
  headline: string;
  /** Flavour sub-line shown under the headline. */
  subline?: string;
  timerMs: number;
  choices: DecisionChoice[];
}

export type DecisionGrade = "optimal" | "acceptable" | "bad";

export interface DecisionRecord {
  decision: DecisionPoint;
  chosenId: string;
  timedOut: boolean;
  grade: DecisionGrade;
  gradeReason: string;
}

export interface SubmitPlanRequest {
  plan: PlayerPlan;
}

/**
 * Response from `POST /api/plans`. The plan is stored and the planId is
 * handed back — the caller then kicks off an interactive run via
 * `POST /api/runs`.
 */
export interface SubmitPlanResponse {
  planId: string;
}

/**
 * Payload consumed by the post-run results screen. Produced client-side
 * once the interactive run finalises.
 */
export interface FinalRunPayload {
  outcome: Outcome;
  log: SimulationLog;
  rank?: number;
  total?: number;
}

/** Sent by the client to start a new interactive run against the stored plan. */
export interface StartRunRequest {
  planId: string;
}

/**
 * Returned by `POST /api/runs` (start) and `POST /api/runs/:id/decide`
 * (continue). Either the run paused on a new decision or finalised.
 */
export interface RunStepResponse {
  runId: string;
  /** Events rendered since the last step. */
  segment: TurnLog[];
  /** Populated when the run paused on an emergent decision. */
  pendingDecision?: DecisionPoint;
  /** Populated when the run finalised (no more decisions). */
  outcome?: Outcome;
  finalLog?: SimulationLog;
  rank?: number;
  total?: number;
}

export interface DecideRunRequest {
  choiceId: string;
  timedOut?: boolean;
}

export interface ScenarioResponse {
  scenario: Scenario;
  playsRemaining: number;
  hasAdAvailable: boolean;
  nextResetAt: string;
}

export interface CommunityPlan {
  id: string;
  score: number;
  tier: OutcomeTier;
  planData: PlayerPlan;
  createdAt: string;
}
