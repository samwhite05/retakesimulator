/**
 * Map grid definitions — tile-based tactical layouts for each map.
 * 
 * Each map defines a 16x16 grid where:
 * - Tiles are walkable, walls, chokepoints, cover, or exposed
 * - Chokepoints are narrow passages (doors, windows)
 * - Cover tiles are behind walls/boxes
 * - Exposed tiles are open areas
 * 
 * COORDINATE SYSTEM:
 * - Grid is 16x16 tiles
 * - (0,0) = top-left of minimap
 * - (15,15) = bottom-right
 * - Tile (col, row) maps to normalized position via tileGrid.ts
 */

import type { GridMap, TileDef } from "./tileGrid";

// ========================================
// ASCENT — 16x16 Tactical Grid
// ========================================

export const ASCENT_GRID: GridMap = {
  mapId: "ascent",
  tiles: Array.from({ length: 16 }, () =>
    Array.from({ length: 16 }, (_, col) => ({ col, row: 0, type: "walkable" as TileDef["type"] }))
  ).map((row, rowIdx) =>
    row.map((tile) => ({ ...tile, row: rowIdx }))
  ),
};

// Build the grid with actual terrain
function buildAscentGrid(): TileDef[][] {
  const tiles: TileDef[][] = Array.from({ length: 16 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) => ({
      col,
      row,
      type: "walkable" as TileDef["type"],
    }))
  );

  // ===== WALLS =====
  // B Site walls (right side of map)
  for (let r = 2; r <= 7; r++) {
    tiles[r][11].type = "wall"; // B Market wall
    tiles[r][12].type = "wall";
  }
  for (let c = 11; c <= 14; c++) {
    tiles[7][c].type = "wall"; // B site back wall
  }
  tiles[5][10].type = "wall"; // B door
  tiles[6][10].type = "wall";

  // Tree area
  tiles[6][13].type = "wall";
  tiles[7][13].type = "wall";
  tiles[8][13].type = "wall";

  // B Main corridor
  tiles[5][14].type = "wall";
  tiles[6][14].type = "wall";
  tiles[7][14].type = "wall";
  tiles[8][14].type = "wall";

  // A Site walls (left side)
  for (let r = 2; r <= 7; r++) {
    tiles[r][3].type = "wall"; // A Tower wall
    tiles[r][4].type = "wall";
  }
  for (let c = 2; c <= 5; c++) {
    tiles[7][c].type = "wall"; // A site back wall
  }
  tiles[5][5].type = "wall"; // A door
  tiles[6][5].type = "wall";

  // A Main corridor
  tiles[5][1].type = "wall";
  tiles[6][1].type = "wall";
  tiles[7][1].type = "wall";
  tiles[8][1].type = "wall";

  // Mid walls
  for (let c = 6; c <= 9; c++) {
    tiles[9][c].type = "wall"; // Mid back wall
  }
  tiles[8][6].type = "wall";
  tiles[8][7].type = "wall";
  tiles[8][8].type = "wall";
  tiles[8][9].type = "wall";

  // CT Spawn walls
  for (let c = 5; c <= 10; c++) {
    tiles[13][c].type = "wall";
  }
  tiles[12][5].type = "wall";
  tiles[12][10].type = "wall";

  // T Spawn walls (top)
  for (let c = 5; c <= 10; c++) {
    tiles[1][c].type = "wall";
  }

  // ===== CHOKEPOINTS =====
  // B Market door
  tiles[5][10].type = "chokepoint";
  tiles[6][10].type = "chokepoint";

  // A Door
  tiles[5][5].type = "chokepoint";
  tiles[6][5].type = "chokepoint";

  // Mid doors
  tiles[8][7].type = "chokepoint";
  tiles[9][7].type = "chokepoint";

  // B Main entrance
  tiles[9][14].type = "chokepoint";

  // A Main entrance
  tiles[9][1].type = "chokepoint";

  // ===== COVER POSITIONS =====
  // B Site cover (boxes, structures)
  tiles[5][12].type = "cover";
  tiles[6][12].type = "cover";
  tiles[5][11].type = "cover";
  tiles[4][12].type = "cover";

  // A Site cover
  tiles[5][3].type = "cover";
  tiles[6][3].type = "cover";
  tiles[5][4].type = "cover";
  tiles[4][3].type = "cover";

  // Mid cover
  tiles[10][7].type = "cover";
  tiles[10][8].type = "cover";

  // CT Spawn cover
  tiles[12][7].type = "cover";
  tiles[12][8].type = "cover";

  // ===== EXPOSED AREAS =====
  // B Site open area
  tiles[4][13].type = "exposed";
  tiles[5][13].type = "exposed";

  // A Site open area
  tiles[4][2].type = "exposed";
  tiles[5][2].type = "exposed";

  // Mid open
  tiles[10][6].type = "exposed";
  tiles[11][7].type = "exposed";

  // ===== HIGH GROUND =====
  // B Market stairs
  tiles[4][10].type = "high_ground";
  tiles[3][10].type = "high_ground";

  // A Tower
  tiles[3][4].type = "high_ground";
  tiles[4][4].type = "high_ground";

  // ===== SPIKE ZONES =====
  // B Site plant area
  tiles[5][12].type = "spike_zone";
  tiles[5][13].type = "spike_zone";
  tiles[6][12].type = "spike_zone";
  tiles[6][13].type = "spike_zone";

  // A Site plant area
  tiles[5][3].type = "spike_zone";
  tiles[5][2].type = "spike_zone";
  tiles[6][3].type = "spike_zone";
  tiles[6][2].type = "spike_zone";

  return tiles;
}

export const ASCENT_GRID_DEFINED: GridMap = {
  mapId: "ascent",
  tiles: buildAscentGrid(),
};

// ========================================
// HAVEN — 16x16 Tactical Grid
// ========================================

function buildHavenGrid(): TileDef[][] {
  const tiles: TileDef[][] = Array.from({ length: 16 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) => ({
      col,
      row,
      type: "walkable" as TileDef["type"],
    }))
  );

  // Haven has 3 sites, so walls are more spread out

  // C Site walls (right-top)
  for (let r = 2; r <= 6; r++) {
    tiles[r][12].type = "wall";
  }
  tiles[6][11].type = "wall";
  tiles[6][12].type = "wall";
  tiles[6][13].type = "wall";

  // B Site walls (right-bottom)
  for (let r = 9; r <= 13; r++) {
    tiles[r][12].type = "wall";
  }
  tiles[9][11].type = "wall";
  tiles[9][12].type = "wall";
  tiles[9][13].type = "wall";

  // A Site walls (left)
  for (let r = 3; r <= 7; r++) {
    tiles[r][3].type = "wall";
  }
  tiles[7][2].type = "wall";
  tiles[7][3].type = "wall";
  tiles[7][4].type = "wall";

  // Mid walls
  for (let r = 7; r <= 9; r++) {
    tiles[r][7].type = "wall";
    tiles[r][8].type = "wall";
  }

  // ===== CHOKEPOINTS =====
  // C Garage
  tiles[5][11].type = "chokepoint";
  tiles[6][11].type = "chokepoint";

  // B Garage
  tiles[10][11].type = "chokepoint";
  tiles[11][11].type = "chokepoint";

  // A Main
  tiles[6][4].type = "chokepoint";
  tiles[7][4].type = "chokepoint";

  // ===== COVER =====
  tiles[5][12].type = "cover"; // C site
  tiles[10][12].type = "cover"; // B site
  tiles[5][3].type = "cover"; // A site
  tiles[8][7].type = "cover"; // Mid

  // ===== EXPOSED =====
  tiles[4][12].type = "exposed";
  tiles[9][12].type = "exposed";
  tiles[4][3].type = "exposed";

  return tiles;
}

export const HAVEN_GRID_DEFINED: GridMap = {
  mapId: "haven",
  tiles: buildHavenGrid(),
};

// ========================================
// Grid Registry
// ========================================

export const ALL_GRIDS: Record<string, GridMap> = {
  ascent: ASCENT_GRID_DEFINED,
  haven: HAVEN_GRID_DEFINED,
};

/**
 * Get the grid for a map, or a default empty grid
 */
export function getGrid(mapId: string): GridMap {
  return ALL_GRIDS[mapId] || ASCENT_GRID_DEFINED;
}

/**
 * Check if a position is on a wall tile
 */
export function isWall(mapId: string, pos: { col: number; row: number }): boolean {
  const grid = getGrid(mapId);
  return grid.tiles[pos.row]?.[pos.col]?.type === "wall";
}

/**
 * Check if a position is a chokepoint
 */
export function isChokepoint(mapId: string, pos: { col: number; row: number }): boolean {
  const grid = getGrid(mapId);
  return grid.tiles[pos.row]?.[pos.col]?.type === "chokepoint";
}

/**
 * Get movement range tiles for an agent from a starting position
 */
export function getMovementRange(
  mapId: string,
  startCol: number,
  startRow: number,
  maxMoves: number,
  canDiagonal: boolean
): { col: number; row: number }[] {
  const grid = getGrid(mapId);
  const reachable: { col: number; row: number }[] = [];
  const visited = new Set<string>();
  const queue: { col: number; row: number; cost: number }[] = [
    { col: startCol, row: startRow, cost: 0 },
  ];

  const key = (c: number, r: number) => `${c},${r}`;
  visited.add(key(startCol, startRow));

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.cost > 0) {
      reachable.push({ col: current.col, row: current.row });
    }

    if (current.cost >= maxMoves) continue;

    const directions = canDiagonal
      ? [
          { dc: 0, dr: -1 },
          { dc: 0, dr: 1 },
          { dc: -1, dr: 0 },
          { dc: 1, dr: 0 },
          { dc: -1, dr: -1 },
          { dc: -1, dr: 1 },
          { dc: 1, dr: -1 },
          { dc: 1, dr: 1 },
        ]
      : [
          { dc: 0, dr: -1 },
          { dc: 0, dr: 1 },
          { dc: -1, dr: 0 },
          { dc: 1, dr: 0 },
        ];

    for (const dir of directions) {
      const nc = current.col + dir.dc;
      const nr = current.row + dir.dr;

      if (nc < 0 || nc >= 16 || nr < 0 || nr >= 16) continue;
      if (visited.has(key(nc, nr))) continue;

      const tile = grid.tiles[nr]?.[nc];
      if (tile?.type === "wall") continue;

      const moveCost = tile?.type === "chokepoint" ? 2 : tile?.type === "exposed" ? 1.5 : 1;
      const newCost = current.cost + moveCost;

      if (newCost <= maxMoves) {
        visited.add(key(nc, nr));
        queue.push({ col: nc, row: nr, cost: newCost });
      }
    }
  }

  return reachable;
}
