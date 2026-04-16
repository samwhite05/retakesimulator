import { Position, TileCoord, GridMap, TileType, AgentRole } from "@/types";
import { GRID_COLS, GRID_ROWS, TILE_COST, ROLE_MOVEMENT } from "@/lib/constants";

/** Permanent map boundary: geometry wall or off-map transparent (void). */
export function isImpassableTerrain(type: TileType): boolean {
  return type === "wall" || type === "void";
}

export function posToTile(pos: Position): TileCoord {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(pos.x * GRID_COLS))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(pos.y * GRID_ROWS))),
  };
}

export function tileToPos(tile: TileCoord): Position {
  return {
    x: (tile.col + 0.5) / GRID_COLS,
    y: (tile.row + 0.5) / GRID_ROWS,
  };
}

export function tileKey(tile: TileCoord): string {
  return `${tile.col},${tile.row}`;
}

export function getTile(grid: GridMap, tile: TileCoord): { type: TileType; elevation?: number } | null {
  if (tile.row < 0 || tile.row >= grid.rows || tile.col < 0 || tile.col >= grid.cols) return null;
  return grid.tiles[tile.row]?.[tile.col] ?? null;
}

export function isWalkable(grid: GridMap, tile: TileCoord): boolean {
  const t = getTile(grid, tile);
  return t !== null && !isImpassableTerrain(t.type);
}

/** Stricter than isWalkable: agents cannot be placed on spike_zone tiles */
export function isPlaceable(grid: GridMap, tile: TileCoord): boolean {
  const t = getTile(grid, tile);
  return t !== null && !isImpassableTerrain(t.type) && t.type !== "spike_zone";
}

/** Agents cannot be placed too close to the spike site (retake must start off-site) */
export function isSpawnable(
  grid: GridMap,
  tile: TileCoord,
  spikeSite: Position,
  minDistance = 3.5,
  spawnZones?: { x: number; y: number; width: number; height: number }[]
): boolean {
  if (!isPlaceable(grid, tile)) return false;
  const spikeTile = posToTile(spikeSite);
  const dist = getEuclideanDistance(tile, spikeTile);
  if (dist < minDistance) return false;
  if (spawnZones && spawnZones.length > 0) {
    const tileLeft = tile.col / GRID_COLS;
    const tileRight = (tile.col + 1) / GRID_COLS;
    const tileTop = tile.row / GRID_ROWS;
    const tileBottom = (tile.row + 1) / GRID_ROWS;
    const inside = spawnZones.some(
      (z) =>
        tileRight >= z.x &&
        tileLeft <= z.x + z.width &&
        tileBottom >= z.y &&
        tileTop <= z.y + z.height
    );
    if (!inside) return false;
  }
  return true;
}

/** True if a straight grid line between tiles stays on walkable cells. */
function linePathIsWalkable(grid: GridMap, a: TileCoord, b: TileCoord): boolean {
  for (const t of getLineTiles(a, b)) {
    const tile = getTile(grid, t);
    if (!tile || isImpassableTerrain(tile.type)) return false;
  }
  return true;
}

/** Movement budget: dash utility extends range for that agent when planning movement. */
export function getMovementBudget(
  agentId: string,
  role: AgentRole,
  utilityPlacements: { agentId: string; type: string }[]
): number {
  const rm = ROLE_MOVEMENT[role];
  const dashed = utilityPlacements.some((u) => u.agentId === agentId && u.type === "dash");
  if (dashed && rm.dashRange != null) return rm.dashRange;
  return rm.range;
}

/**
 * Post-utility reposition: walk-only, slightly reduced compared to entry.
 * A modest 75% of base keeps the re-site meaningful (you can't re-cross
 * the whole map) while still letting you reach the spike from anywhere
 * close to the site.
 */
export const WAVE2_MOVEMENT_FACTOR = 0.75;

export function getMovementBudgetForWave(
  agentId: string,
  role: AgentRole,
  utilityPlacements: { agentId: string; type: string }[],
  wave: 1 | 2
): number {
  if (wave === 1) return getMovementBudget(agentId, role, utilityPlacements);
  const base = ROLE_MOVEMENT[role].range;
  return Math.max(1, Math.floor(base * WAVE2_MOVEMENT_FACTOR));
}

export function getNeighbors(
  tile: TileCoord,
  allowDiagonal: boolean,
  grid?: GridMap
): TileCoord[] {
  const dirs: TileCoord[] = [
    { col: tile.col + 1, row: tile.row },
    { col: tile.col - 1, row: tile.row },
    { col: tile.col, row: tile.row + 1 },
    { col: tile.col, row: tile.row - 1 },
  ];
  if (allowDiagonal) {
    const diagonals: {
      tile: TileCoord;
      adj1: TileCoord;
      adj2: TileCoord;
    }[] = [
      {
        tile: { col: tile.col + 1, row: tile.row + 1 },
        adj1: { col: tile.col + 1, row: tile.row },
        adj2: { col: tile.col, row: tile.row + 1 },
      },
      {
        tile: { col: tile.col - 1, row: tile.row - 1 },
        adj1: { col: tile.col - 1, row: tile.row },
        adj2: { col: tile.col, row: tile.row - 1 },
      },
      {
        tile: { col: tile.col + 1, row: tile.row - 1 },
        adj1: { col: tile.col + 1, row: tile.row },
        adj2: { col: tile.col, row: tile.row - 1 },
      },
      {
        tile: { col: tile.col - 1, row: tile.row + 1 },
        adj1: { col: tile.col - 1, row: tile.row },
        adj2: { col: tile.col, row: tile.row + 1 },
      },
    ];
    for (const { tile: d, adj1, adj2 } of diagonals) {
      if (grid) {
        // Prevent corner cutting: both adjacent cardinal tiles must be walkable
        const t1 = getTile(grid, adj1);
        const t2 = getTile(grid, adj2);
        if (t1 && t2 && !isImpassableTerrain(t1.type) && !isImpassableTerrain(t2.type)) {
          dirs.push(d);
        }
      } else {
        dirs.push(d);
      }
    }
  }

  return dirs;
}

export interface ReachableTilesOptions {
  /** When true (default), attackers cannot enter spike site tiles while planning movement. */
  omitSpikeZone?: boolean;
  /** Override movement budget (defaults to role range from ROLE_MOVEMENT). */
  maxCost?: number;
}

export function getReachableTiles(
  grid: GridMap,
  start: TileCoord,
  role: AgentRole,
  blockedTiles?: Set<string>,
  options?: ReachableTilesOptions
): TileCoord[] {
  const omitSpikeZone = options?.omitSpikeZone !== false;
  const maxCost = options?.maxCost ?? ROLE_MOVEMENT[role].range;
  const { diagonal } = ROLE_MOVEMENT[role];

  const canEnter = (tile: TileCoord): boolean => {
    if (blockedTiles?.has(tileKey(tile))) return false;
    const t = getTile(grid, tile);
    if (!t || isImpassableTerrain(t.type)) return false;
    if (omitSpikeZone && t.type === "spike_zone") return false;
    return true;
  };

  if (!canEnter(start)) return [];

  // Weighted tiles (chokepoint cost 2, etc.) require Dijkstra — a plain FIFO queue is not correct.
  const open = new PriorityQueue<{ tile: TileCoord; cost: number }>();
  const best = new Map<string, number>();

  const startKey = tileKey(start);
  best.set(startKey, 0);
  open.push({ tile: start, cost: 0 }, 0);

  while (open.length > 0) {
    const cur = open.pop()!.item;
    const ck = tileKey(cur.tile);
    const cost = cur.cost;
    if (cost !== best.get(ck)) continue;

    for (const neighbor of getNeighbors(cur.tile, diagonal, grid)) {
      if (!canEnter(neighbor)) continue;
      // Diagonals must not cut across blocked corners (e.g. spike band or mis-tagged walls).
      const dc = Math.abs(neighbor.col - cur.tile.col);
      const dr = Math.abs(neighbor.row - cur.tile.row);
      if (dc === 1 && dr === 1) {
        const c1 = { col: cur.tile.col, row: neighbor.row };
        const c2 = { col: neighbor.col, row: cur.tile.row };
        if (!canEnter(c1) || !canEnter(c2)) continue;
      }
      const neighborTile = getTile(grid, neighbor)!;
      const step = TILE_COST[neighborTile.type];
      if (!isFinite(step)) continue;
      const nextCost = cost + step;
      if (nextCost > maxCost) continue;
      const nk = tileKey(neighbor);
      if (best.has(nk) && best.get(nk)! <= nextCost) continue;
      best.set(nk, nextCost);
      open.push({ tile: neighbor, cost: nextCost }, nextCost);
    }
  }

  const out: TileCoord[] = [];
  for (const [k, c] of best) {
    if (c <= 0 || c > maxCost) continue;
    const [col, row] = k.split(",").map(Number);
    out.push({ col, row });
  }
  return out;
}

/** Snap a desired tile to the nearest tile reachable under the movement budget (cyan highlight set). */
export function snapToReachableMoveTarget(
  grid: GridMap,
  start: TileCoord,
  desired: TileCoord,
  role: AgentRole,
  blockedTiles?: Set<string>,
  opts?: { maxCost?: number }
): TileCoord {
  const reachable = getReachableTiles(grid, start, role, blockedTiles, {
    omitSpikeZone: true,
    maxCost: opts?.maxCost,
  });
  if (reachable.length === 0) return desired;
  const dk = tileKey(desired);
  if (reachable.some((t) => tileKey(t) === dk)) return desired;
  let best = reachable[0];
  let bestD = Infinity;
  for (const t of reachable) {
    const d = (t.col - desired.col) ** 2 + (t.row - desired.row) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

class PriorityQueue<T> {
  private heap: { item: T; priority: number }[] = [];

  push(item: T, priority: number) {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { item: T; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return top;
  }

  get length() {
    return this.heap.length;
  }

  private bubbleUp(index: number) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (element.priority >= parent.priority) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = element;
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const element = this.heap[index];
    while (true) {
      let swap = null;
      const leftChildIdx = 2 * index + 1;
      const rightChildIdx = 2 * index + 2;
      if (leftChildIdx < length) {
        if (this.heap[leftChildIdx].priority < element.priority) {
          swap = leftChildIdx;
        }
      }
      if (rightChildIdx < length) {
        if (
          this.heap[rightChildIdx].priority <
          (swap === null ? element.priority : this.heap[swap].priority)
        ) {
          swap = rightChildIdx;
        }
      }
      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      index = swap;
    }
    this.heap[index] = element;
  }
}

function pathHeuristic(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export interface FindPathOptions {
  /** Max movement budget (same units as TILE_COST sums in getReachableTiles). */
  maxCost?: number;
}

/**
 * Shortest path under a movement budget using the same tile costs as getReachableTiles.
 * Spike site tiles are not traversable unless the goal tile is on the spike site (defuse).
 */
export function findPath(
  grid: GridMap,
  start: TileCoord,
  end: TileCoord,
  role: AgentRole,
  blockedTiles?: Set<string>,
  options?: FindPathOptions
): TileCoord[] | null {
  if (start.col === end.col && start.row === end.row) return [start];

  const { diagonal, range } = ROLE_MOVEMENT[role];
  const maxCost = options?.maxCost ?? range;

  const canStep = (tile: TileCoord): boolean => {
    if (blockedTiles?.has(tileKey(tile))) return false;
    const t = getTile(grid, tile);
    if (!t || isImpassableTerrain(t.type)) return false;
    return true;
  };

  if (!canStep(start) || !canStep(end)) return null;

  const open = new PriorityQueue<{ tile: TileCoord; g: number }>();
  const bestG = new Map<string, number>();
  const parent = new Map<string, string>();

  const startKey = tileKey(start);
  bestG.set(startKey, 0);
  parent.set(startKey, startKey);
  open.push({ tile: start, g: 0 }, pathHeuristic(start, end));

  while (open.length > 0) {
    const cur = open.pop()!.item;
    const ck = tileKey(cur.tile);
    const g = cur.g;
    if (g !== bestG.get(ck)) continue;

    if (cur.tile.col === end.col && cur.tile.row === end.row) {
      const path: TileCoord[] = [];
      let k = ck;
      while (k !== startKey) {
        const [c, r] = k.split(",").map(Number);
        path.unshift({ col: c, row: r });
        const pk = parent.get(k);
        if (!pk) return null;
        k = pk;
      }
      path.unshift(start);
      return path;
    }

    for (const nb of getNeighbors(cur.tile, diagonal, grid)) {
      if (!canStep(nb)) continue;
      const ddc = Math.abs(nb.col - cur.tile.col);
      const ddr = Math.abs(nb.row - cur.tile.row);
      if (ddc === 1 && ddr === 1) {
        const c1 = { col: cur.tile.col, row: nb.row };
        const c2 = { col: nb.col, row: cur.tile.row };
        if (!canStep(c1) || !canStep(c2)) continue;
      }
      const nt = getTile(grid, nb)!;
      const step = TILE_COST[nt.type];
      if (!isFinite(step)) continue;
      const ng = g + step;
      if (ng > maxCost) continue;
      const nk = tileKey(nb);
      if (bestG.has(nk) && bestG.get(nk)! <= ng) continue;
      bestG.set(nk, ng);
      parent.set(nk, ck);
      open.push({ tile: nb, g: ng }, ng + pathHeuristic(nb, end));
    }
  }

  return null;
}

export function simplifyPath(grid: GridMap, path: TileCoord[]): TileCoord[] {
  if (path.length <= 2) return path;

  const simplified: TileCoord[] = [path[0]];
  let current = 0;

  while (current < path.length - 1) {
    let farthest = current + 1;
    for (let i = current + 2; i < path.length; i++) {
      if (linePathIsWalkable(grid, path[current], path[i])) {
        farthest = i;
      } else {
        break;
      }
    }
    simplified.push(path[farthest]);
    current = farthest;
  }

  return simplified;
}

export function getDistance(a: TileCoord, b: TileCoord): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return Math.max(dx, dy);
}

export function getEuclideanDistance(a: TileCoord, b: TileCoord): number {
  const dx = a.col - b.col;
  const dy = a.row - b.row;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTilesInRadius(center: TileCoord, radius: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  const rSq = radius * radius;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const dx = col - center.col;
      const dy = row - center.row;
      if (dx * dx + dy * dy <= rSq) {
        tiles.push({ col, row });
      }
    }
  }
  return tiles;
}

export function getLineTiles(start: TileCoord, end: TileCoord): TileCoord[] {
  const tiles: TileCoord[] = [];
  let x0 = start.col;
  let y0 = start.row;
  const x1 = end.col;
  const y1 = end.row;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    tiles.push({ col: x0, row: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return tiles;
}
