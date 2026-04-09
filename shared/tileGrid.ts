/**
 * Tile-based tactical grid system for Retake Roulette.
 * 
 * Converts the continuous minimap into a discrete grid where:
 * - Agents move like chess pieces (limited range per role)
 * - Tiles have properties (walkable, wall, chokepoint, exposure zone)
 * - Utility covers tile patterns (circles, cones, rectangles)
 * - Movement costs vary by terrain
 */

import type { Position } from "./types";
import type { UtilityType } from "./types";

// ========================================
// Grid Configuration
// ========================================

export const GRID_COLS = 16;
export const GRID_ROWS = 16;

export type TileType =
  | "walkable"      // Normal movement
  | "wall"          // Cannot enter
  | "chokepoint"    // Narrow passage — costs extra to move through
  | "cover"         // Behind cover — safe from enemy fire
  | "exposed"       // Open area — high risk
  | "high_ground"   // Elevated position — advantage
  | "spike_zone"    // Spike plantable area;

export interface TileDef {
  col: number;
  row: number;
  type: TileType;
  coverDirection?: "n" | "s" | "e" | "w"; // Which direction cover faces
}

export interface GridMap {
  mapId: string;
  tiles: TileDef[][]; // [row][col]
}

// ========================================
// Agent Movement Rules (Chess-like)
// ========================================

export type MovementType = "standard" | "dash" | "teleport";

export interface AgentMovementRules {
  maxMoves: number;        // How many tiles per turn
  movementType: MovementType;
  canDiagonal: boolean;    // Like bishop (true) or rook (false)
  specialAbility?: string; // e.g., "Jett dash ignores walls"
}

// Role-based movement profiles
export const ROLE_MOVEMENT: Record<string, AgentMovementRules> = {
  duelist: {
    maxMoves: 4,
    movementType: "dash",
    canDiagonal: true,
    specialAbility: "Can dash through one tile of exposed area",
  },
  initiator: {
    maxMoves: 3,
    movementType: "standard",
    canDiagonal: true,
  },
  controller: {
    maxMoves: 3,
    movementType: "standard",
    canDiagonal: false, // Controllers move like rooks (orthogonal only)
  },
  sentinel: {
    maxMoves: 2,
    movementType: "standard",
    canDiagonal: true,
    specialAbility: "Can hold position for bonus defense",
  },
};

// ========================================
// Utility Coverage Shapes
// ========================================

export type CoverageShape = "circle" | "cone" | "rectangle" | "line";

export interface CoverageDef {
  shape: CoverageShape;
  size: number;         // Radius for circles, length for lines/rectangles
  direction?: number;   // Angle in degrees (0-360) for cones
  width?: number;       // For rectangles
  opacity: number;      // 0-1 transparency
}

// Each utility type has a defined coverage pattern
export const UTILITY_COVERAGE: Record<UtilityType, CoverageDef> = {
  // Large area denial
  smoke: { shape: "circle", size: 3, opacity: 0.4 },        // 3-tile radius
  wall: { shape: "rectangle", size: 5, width: 1, opacity: 0.5 }, // 5 tiles long, 1 wide

  // Directional effects
  flash: { shape: "cone", size: 4, direction: 0, opacity: 0.3 }, // 4-tile cone
  concussion: { shape: "circle", size: 2, opacity: 0.3 },    // 2-tile radius

  // Ground denial
  mollie: { shape: "circle", size: 2, opacity: 0.5 },        // 2-tile radius
  nanoswarm: { shape: "circle", size: 1.5, opacity: 0.4 },   // 1.5-tile radius

  // Information
  dart: { shape: "circle", size: 3, opacity: 0.25 },         // 3-tile reveal
  sensor: { shape: "circle", size: 2, opacity: 0.2 },        // 2-tile detection
  alarm: { shape: "circle", size: 1, opacity: 0.3 },         // 1-tile trigger

  // Line effects
  tripwire: { shape: "line", size: 2, opacity: 0.4 },        // 2-tile line
  trap: { shape: "circle", size: 1, opacity: 0.4 },          // 1-tile trap

  // Special
  dash: { shape: "line", size: 3, opacity: 0.15 },           // 3-tile dash path
  heal: { shape: "circle", size: 1, opacity: 0.3 },          // 1-tile heal zone
  revive: { shape: "circle", size: 1, opacity: 0.3 },        // 1-tile revive
  decoy: { shape: "circle", size: 1, opacity: 0.2 },         // 1-tile decoy
  gravity_well: { shape: "circle", size: 2, opacity: 0.35 }, // 2-tile pull
  turret: { shape: "circle", size: 3, opacity: 0.2 },        // 3-tile detection

  // Agent-specific variations
  // These override the base type when needed
};

// Agent-specific smoke sizes (Brimstone > Omen > Astra etc.)
export const SMOKE_SIZES: Record<string, number> = {
  brimstone: 3.5,  // Largest smokes
  omen: 3,         // Standard
  astra: 3.2,      // Slightly larger
  viper: 3,        // Standard but line-shaped (Toxic Screen)
  harbor: 2.5,     // Smaller but lingers
  clove: 2.8,      // Medium
};

// ========================================
// Tile Conversion Utilities
// ========================================

/**
 * Convert normalized position (0-1) to grid coordinates
 */
export function posToTile(pos: Position, cols = GRID_COLS, rows = GRID_ROWS): { col: number; row: number } {
  return {
    col: Math.floor(pos.x * cols),
    row: Math.floor(pos.y * rows),
  };
}

/**
 * Convert grid coordinates to normalized center position
 */
export function tileToPos(col: number, row: number, cols = GRID_COLS, rows = GRID_ROWS): Position {
  return {
    x: (col + 0.5) / cols,
    y: (row + 0.5) / rows,
  };
}

/**
 * Get all tiles within a coverage shape
 */
export function getCoverageTiles(
  shape: CoverageDef,
  centerCol: number,
  centerRow: number,
  directionCol?: number, // For directional utility (where it's facing)
  cols = GRID_COLS,
  rows = GRID_ROWS
): { col: number; row: number }[] {
  const tiles: { col: number; row: number }[] = [];

  switch (shape.shape) {
    case "circle": {
      const radius = shape.size;
      for (let dr = -Math.ceil(radius); dr <= Math.ceil(radius); dr++) {
        for (let dc = -Math.ceil(radius); dc <= Math.ceil(radius); dc++) {
          const dist = Math.sqrt(dc * dc + dr * dr);
          if (dist <= radius) {
            const col = centerCol + dc;
            const row = centerRow + dr;
            if (col >= 0 && col < cols && row >= 0 && row < rows) {
              tiles.push({ col, row });
            }
          }
        }
      }
      break;
    }

    case "cone": {
      // Directional cone from center toward direction
      const dirX = directionCol !== undefined ? directionCol - centerCol : 1;
      const dirY = dirX >= 0 ? 0 : -1; // Simplified direction
      const length = shape.size;

      for (let d = 1; d <= length; d++) {
        const spread = Math.floor(d * 0.5); // Cone widens with distance
        for (let s = -spread; s <= spread; s++) {
          const col = centerCol + dirX * d + (dirX === 0 ? s : 0);
          const row = centerRow + dirY * d + (dirY === 0 ? s : 0);
          if (col >= 0 && col < cols && row >= 0 && row < rows) {
            tiles.push({ col, row });
          }
        }
      }
      break;
    }

    case "rectangle": {
      const length = shape.size;
      const width = shape.width || 1;
      for (let l = 0; l < length; l++) {
        for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
          const col = centerCol + l;
          const row = centerRow + w;
          if (col >= 0 && col < cols && row >= 0 && row < rows) {
            tiles.push({ col, row });
          }
        }
      }
      break;
    }

    case "line": {
      const length = shape.size;
      for (let l = 0; l <= length; l++) {
        const col = centerCol + l;
        const row = centerRow;
        if (col >= 0 && col < cols && row >= 0 && row < rows) {
          tiles.push({ col, row });
        }
      }
      break;
    }
  }

  return tiles;
}

/**
 * Calculate movement cost for a path
 */
export function calculateMovementCost(
  path: { col: number; row: number }[],
  grid: GridMap
): number {
  let cost = 0;
  for (const tile of path) {
    const tileDef = grid.tiles[tile.row]?.[tile.col];
    if (!tileDef) continue;

    switch (tileDef.type) {
      case "walkable":
        cost += 1;
        break;
      case "chokepoint":
        cost += 2; // Double cost to move through chokepoints
        break;
      case "exposed":
        cost += 1.5; // Extra risk cost
        break;
      case "cover":
        cost += 0.5; // Cheaper to move between cover
        break;
      case "wall":
        cost += 999; // Essentially impassable
        break;
      default:
        cost += 1;
    }
  }
  return cost;
}

/**
 * Check if a tile is covered by any utility
 */
export function isTileCovered(
  col: number,
  row: number,
  utilityCoverage: Array<{ tiles: { col: number; row: number }[] }>
): boolean {
  return utilityCoverage.some((coverage) =>
    coverage.tiles.some((t) => t.col === col && t.row === row)
  );
}

/**
 * Get exposure level for a tile based on surrounding tiles
 */
export function getExposureLevel(
  col: number,
  row: number,
  grid: GridMap
): "safe" | "contested" | "exposed" {
  const tile = grid.tiles[row]?.[col];
  if (!tile) return "exposed";

  if (tile.type === "cover") return "safe";
  if (tile.type === "exposed") return "exposed";
  if (tile.type === "chokepoint") return "contested";

  // Check adjacent tiles for exposure
  const adjacent = [
    { col: col - 1, row },
    { col: col + 1, row },
    { col, row: row - 1 },
    { col, row: row + 1 },
  ];

  let exposedCount = 0;
  let coverCount = 0;

  for (const adj of adjacent) {
    const adjTile = grid.tiles[adj.row]?.[adj.col];
    if (adjTile?.type === "exposed") exposedCount++;
    if (adjTile?.type === "cover") coverCount++;
  }

  if (coverCount >= 2) return "safe";
  if (exposedCount >= 2) return "exposed";
  return "contested";
}
