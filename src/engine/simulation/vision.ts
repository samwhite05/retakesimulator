import { GridMap, TileCoord, SimAgent } from "@/types";
import { getTile, tileKey, getLineTiles, isImpassableTerrain } from "./grid";

export function hasLineOfSight(
  grid: GridMap,
  from: TileCoord,
  to: TileCoord,
  smokeTiles: Set<string>,
  wallTiles: Set<string>
): boolean {
  const line = getLineTiles(from, to);
  for (const tile of line) {
    const t = getTile(grid, tile);
    if (!t) return false;
    if (isImpassableTerrain(t.type)) return false;
    if (wallTiles.has(tileKey(tile))) return false;
    // Smoke blocks LOS but not if the tile is the destination (being inside smoke)
    if (smokeTiles.has(tileKey(tile)) && (tile.col !== to.col || tile.row !== to.row)) {
      return false;
    }
  }
  return true;
}

export function getVisibleTiles(
  grid: GridMap,
  from: TileCoord,
  smokeTiles: Set<string>,
  wallTiles: Set<string>,
  maxRange = 32
): TileCoord[] {
  const visible: TileCoord[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const target = { col, row };
      const dist = Math.abs(from.col - col) + Math.abs(from.row - row);
      if (dist > maxRange) continue;
      if (hasLineOfSight(grid, from, target, smokeTiles, wallTiles)) {
        visible.push(target);
      }
    }
  }
  return visible;
}

export function canSeeAgent(
  grid: GridMap,
  observer: SimAgent,
  target: SimAgent,
  smokeTiles: Set<string>,
  wallTiles: Set<string>
): boolean {
  if (!target.alive) return false;
  if (target.revealed) return true; // Darts/reveals bypass LOS
  return hasLineOfSight(grid, observer.position, target.position, smokeTiles, wallTiles);
}

export function getAgentsInVision(
  grid: GridMap,
  observer: SimAgent,
  agents: SimAgent[],
  smokeTiles: Set<string>,
  wallTiles: Set<string>
): SimAgent[] {
  return agents.filter((a) => a.agentId !== observer.agentId && a.alive && canSeeAgent(grid, observer, a, smokeTiles, wallTiles));
}
