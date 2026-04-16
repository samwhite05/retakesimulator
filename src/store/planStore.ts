import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  decodeUtf8JsonFromQueryParam,
  encodeUtf8JsonForQueryParam,
} from "@/lib/urlUtf8Payload";
import {
  PlayerPlan,
  UtilityItem,
  MovementPath,
  AgentPosition,
  Position,
} from "@/types";
import { normalizePlayerPlan } from "@/lib/normalizePlan";

/**
 * Legacy two-wave type still exported so older modules (animation, results,
 * grid helpers) keep compiling. The planning flow is now single-stage; this
 * alias is effectively unused in the UI.
 */
export type MovementPlanWave = 1 | 2;

interface PlanSnapshot {
  agentPositions: AgentPosition[];
  utilityPlacements: UtilityItem[];
  movementPaths: MovementPath[];
}

const HISTORY_LIMIT = 40;

interface PlanState extends PlanSnapshot {
  scenarioId: string | null;

  selectedAbilityKey: string | null;
  selectedAgentId: string | null;
  /**
   * "move"   — draw or extend the current agent's single path
   * "hold"   — next tap on the path adds/removes a hold waypoint
   * "ability"— next tap places the selected ability
   * "place"  — next tap places the selected agent on the map
   */
  mode: "none" | "ability" | "move" | "hold" | "place";

  past: PlanSnapshot[];
  future: PlanSnapshot[];

  initPlan: (scenarioId: string, defaultAgents: AgentPosition[]) => void;
  selectAbility: (agentId: string, type: string) => void;
  clearSelection: () => void;
  placeUtility: (
    type: string,
    agentId: string,
    position: Position,
    target?: Position,
    path?: Position[]
  ) => void;
  removeUtility: (id: string) => void;
  startMoveMode: (agentId: string) => void;
  startHoldMode: (agentId: string) => void;
  startPlaceMode: (agentId: string) => void;
  setMovePath: (agentId: string, path: Position[]) => void;
  /** Toggle a hold waypoint at the given index along the agent's path. */
  toggleHoldAtIndex: (agentId: string, pathIndex: number) => void;
  clearMovePath: (agentId: string) => void;
  updateAgentPosition: (agentId: string, position: Position) => void;
  handleDropAgent: (
    agentId: string,
    position: Position,
    valid: boolean
  ) => void;
  clearPlan: () => void;
  getPlan: () => Omit<PlayerPlan, "createdAt">;
  setFromEncoded: (encoded: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function snapshotOf(state: PlanSnapshot): PlanSnapshot {
  return {
    agentPositions: state.agentPositions.map((a) => ({ ...a })),
    utilityPlacements: state.utilityPlacements.map((u) => ({ ...u })),
    movementPaths: state.movementPaths.map((p) => ({
      agentId: p.agentId,
      path: [...p.path],
      holds: p.holds ? [...p.holds] : undefined,
    })),
  };
}

function pushHistory<T extends PlanSnapshot & { past: PlanSnapshot[]; future: PlanSnapshot[] }>(
  state: T
): { past: PlanSnapshot[]; future: PlanSnapshot[] } {
  const next = [...state.past, snapshotOf(state)];
  if (next.length > HISTORY_LIMIT) next.shift();
  return { past: next, future: [] };
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      scenarioId: null,
      agentPositions: [],
      utilityPlacements: [],
      movementPaths: [],
      selectedAbilityKey: null,
      selectedAgentId: null,
      mode: "none",
      past: [],
      future: [],

      initPlan: (scenarioId, defaultAgents) =>
        set({
          scenarioId,
          agentPositions: defaultAgents,
          utilityPlacements: [],
          movementPaths: [],
          selectedAbilityKey: null,
          selectedAgentId: null,
          mode: "none",
          past: [],
          future: [],
        }),

      selectAbility: (agentId, type) =>
        set({
          selectedAbilityKey: `${type}:${agentId}`,
          selectedAgentId: null,
          mode: "ability",
        }),

      clearSelection: () =>
        set({
          selectedAbilityKey: null,
          selectedAgentId: null,
          mode: "none",
        }),

      placeUtility: (type, agentId, position, target, path) =>
        set((state) => ({
          ...pushHistory(state),
          utilityPlacements: [
            ...state.utilityPlacements,
            {
              id: `util-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: type as UtilityItem["type"],
              agentId,
              position,
              target,
              path,
            },
          ],
        })),

      removeUtility: (id) =>
        set((state) => ({
          ...pushHistory(state),
          utilityPlacements: state.utilityPlacements.filter((u) => u.id !== id),
        })),

      startMoveMode: (agentId) =>
        set({
          selectedAgentId: agentId,
          selectedAbilityKey: null,
          mode: "move",
        }),

      startHoldMode: (agentId) =>
        set({
          selectedAgentId: agentId,
          selectedAbilityKey: null,
          mode: "hold",
        }),

      startPlaceMode: (agentId) =>
        set((state) => {
          const exists = state.agentPositions.some((a) => a.agentId === agentId);
          return {
            ...(exists ? pushHistory(state) : {}),
            selectedAgentId: agentId,
            selectedAbilityKey: null,
            mode: "place",
            movementPaths: exists
              ? state.movementPaths.filter((p) => p.agentId !== agentId)
              : state.movementPaths,
          };
        }),

      setMovePath: (agentId, path) =>
        set((state) => {
          const existing = state.movementPaths.find((p) => p.agentId === agentId);
          const newPaths = existing
            ? state.movementPaths.map((p) => (p.agentId === agentId ? { agentId, path, holds: [] } : p))
            : [...state.movementPaths, { agentId, path, holds: [] }];
          return {
            ...pushHistory(state),
            movementPaths: newPaths,
          };
        }),

      toggleHoldAtIndex: (agentId, pathIndex) =>
        set((state) => {
          const existing = state.movementPaths.find((p) => p.agentId === agentId);
          if (!existing || pathIndex < 0 || pathIndex >= existing.path.length) return state;
          const holds = existing.holds ? [...existing.holds] : [];
          const idx = holds.indexOf(pathIndex);
          if (idx >= 0) holds.splice(idx, 1);
          else holds.push(pathIndex);
          holds.sort((a, b) => a - b);
          return {
            ...pushHistory(state),
            movementPaths: state.movementPaths.map((p) =>
              p.agentId === agentId ? { ...p, holds } : p
            ),
          };
        }),

      clearMovePath: (agentId) =>
        set((state) => ({
          ...pushHistory(state),
          movementPaths: state.movementPaths.filter((p) => p.agentId !== agentId),
        })),

      updateAgentPosition: (agentId, position) =>
        set((state) => ({
          ...pushHistory(state),
          agentPositions: state.agentPositions.map((a) =>
            a.agentId === agentId ? { agentId, position } : a
          ),
        })),

      handleDropAgent: (agentId, position, valid) =>
        set((state) => {
          if (!valid) return { selectedAgentId: null, mode: "none" as const };
          const exists = state.agentPositions.some((a) => a.agentId === agentId);
          if (exists) {
            return {
              ...pushHistory(state),
              agentPositions: state.agentPositions.map((a) =>
                a.agentId === agentId ? { agentId, position } : a
              ),
              movementPaths: state.movementPaths.filter((p) => p.agentId !== agentId),
              selectedAgentId: null,
              mode: "none" as const,
            };
          }
          return {
            ...pushHistory(state),
            agentPositions: [...state.agentPositions, { agentId, position }],
            selectedAgentId: null,
            mode: "none" as const,
          };
        }),

      clearPlan: () =>
        set((state) => ({
          ...pushHistory(state),
          utilityPlacements: [],
          movementPaths: [],
          selectedAbilityKey: null,
          selectedAgentId: null,
          mode: "none",
        })),

      getPlan: () => {
        const state = get();
        return {
          scenarioId: state.scenarioId || "",
          agentSelection: state.agentPositions.map((a) => a.agentId),
          agentPositions: state.agentPositions,
          utilityPlacements: state.utilityPlacements,
          movementPaths: state.movementPaths,
        };
      },

      setFromEncoded: (encoded) => {
        try {
          const data = decodeUtf8JsonFromQueryParam<Partial<PlayerPlan>>(encoded);
          const normalized = normalizePlayerPlan({
            scenarioId: data.scenarioId ?? "",
            agentSelection: (data.agentSelection ?? []) as string[],
            agentPositions: (data.agentPositions ?? []) as AgentPosition[],
            utilityPlacements: (data.utilityPlacements ?? []) as UtilityItem[],
            movementPaths: data.movementPaths as MovementPath[] | undefined,
            entryMovementPaths: data.entryMovementPaths as MovementPath[] | undefined,
            repositionMovementPaths: data.repositionMovementPaths as MovementPath[] | undefined,
            entryHold: data.entryHold,
            repositionHold: data.repositionHold,
            createdAt: data.createdAt ?? new Date().toISOString(),
          } as PlayerPlan);
          set({
            scenarioId: normalized.scenarioId || null,
            agentPositions: normalized.agentPositions,
            utilityPlacements: normalized.utilityPlacements,
            movementPaths: normalized.movementPaths,
            past: [],
            future: [],
          });
        } catch {
          // ignore invalid encoded data
        }
      },

      undo: () =>
        set((state) => {
          if (state.past.length === 0) return state;
          const prev = state.past[state.past.length - 1];
          const current = snapshotOf(state);
          return {
            ...prev,
            past: state.past.slice(0, -1),
            future: [current, ...state.future].slice(0, HISTORY_LIMIT),
            selectedAbilityKey: null,
            selectedAgentId: null,
            mode: "none",
          };
        }),

      redo: () =>
        set((state) => {
          if (state.future.length === 0) return state;
          const next = state.future[0];
          const current = snapshotOf(state);
          return {
            ...next,
            past: [...state.past, current].slice(-HISTORY_LIMIT),
            future: state.future.slice(1),
            selectedAbilityKey: null,
            selectedAgentId: null,
            mode: "none",
          };
        }),

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,
    }),
    {
      name: "retake-plan-draft-v4",
      partialize: (state) => ({
        scenarioId: state.scenarioId,
        agentPositions: state.agentPositions,
        utilityPlacements: state.utilityPlacements,
        movementPaths: state.movementPaths,
      }),
    }
  )
);

export function encodePlan(plan: Omit<PlayerPlan, "createdAt">): string {
  return encodeUtf8JsonForQueryParam(plan);
}
