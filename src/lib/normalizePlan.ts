import { MovementPath, PlayerPlan } from "@/types";

/**
 * Canonical plan shape used by the simulation engine and validation.
 *
 * The product now uses a single continuous path per agent with optional
 * `holds` (indices into `path`) where the agent pauses to hold an angle
 * before continuing. Legacy URLs (two-wave model or bare `movementPaths`)
 * are migrated here.
 */
export type EffectivePlayerPlan = Omit<
  PlayerPlan,
  "entryMovementPaths" | "repositionMovementPaths" | "entryHold" | "repositionHold" | "movementPaths"
> & {
  movementPaths: MovementPath[];
};

function clonePath(p: MovementPath): MovementPath {
  return {
    agentId: p.agentId,
    path: [...p.path],
    holds: p.holds ? [...p.holds] : undefined,
  };
}

/**
 * Merge a wave-1 entry path and a wave-2 reposition path into a single
 * continuous path with a hold waypoint at the junction. If the last tile of
 * the entry path equals the first tile of the reposition path we dedupe it.
 */
function mergeWaves(
  entry: MovementPath | undefined,
  reposition: MovementPath | undefined,
  repositionHeld: boolean
): MovementPath | null {
  if (!entry && !reposition) return null;
  if (entry && !reposition) {
    return {
      agentId: entry.agentId,
      path: [...entry.path],
      holds: repositionHeld && entry.path.length >= 1 ? [entry.path.length - 1] : entry.holds,
    };
  }
  if (!entry && reposition) {
    return clonePath(reposition);
  }

  const e = entry!;
  const r = reposition!;
  const junction = e.path.length;
  const rPath = r.path.length > 0
    ? (() => {
        const last = e.path[e.path.length - 1];
        const first = r.path[0];
        if (last && first && Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6) {
          return r.path.slice(1);
        }
        return r.path;
      })()
    : [];
  const combined = [...e.path, ...rPath];
  const holds = combined.length > 0 ? [Math.min(junction - 1, combined.length - 1)] : [];
  return {
    agentId: e.agentId,
    path: combined,
    holds: holds.filter((i) => i >= 0),
  };
}

/**
 * Produces the canonical single-path-per-agent plan shape.
 */
export function normalizePlayerPlan(plan: PlayerPlan): EffectivePlayerPlan {
  if (plan.movementPaths && plan.movementPaths.length > 0) {
    const { entryMovementPaths: _e, repositionMovementPaths: _r, entryHold: _eh, repositionHold: _rh, movementPaths, ...rest } = plan;
    void _e; void _r; void _eh; void _rh;
    return {
      ...rest,
      movementPaths: movementPaths.map(clonePath),
    };
  }

  const entries = plan.entryMovementPaths ?? [];
  const repositions = plan.repositionMovementPaths ?? [];
  const repositionHold = (plan.repositionHold ?? {}) as Record<string, boolean>;

  const agentIds = new Set<string>([
    ...entries.map((p) => p.agentId),
    ...repositions.map((p) => p.agentId),
  ]);

  const movementPaths: MovementPath[] = [];
  for (const id of agentIds) {
    const e = entries.find((p) => p.agentId === id);
    const r = repositions.find((p) => p.agentId === id);
    const merged = mergeWaves(e, r, Boolean(repositionHold[id]));
    if (merged && merged.path.length > 0) movementPaths.push(merged);
  }

  const { entryMovementPaths: _e, repositionMovementPaths: _r, entryHold: _eh, repositionHold: _rh, movementPaths: _mp, ...rest } = plan;
  void _e; void _r; void _eh; void _rh; void _mp;

  return {
    ...rest,
    movementPaths,
  };
}
