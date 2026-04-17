import path from "path";
import sharp from "sharp";
import type { GridMap, Scenario, TileType } from "@/types";
import { generateGridFromMinimap } from "@/lib/gridgen";
import { isOutlineWallPixel, isOutsideMapPixel } from "@/lib/mapFootprint";

export function deepCloneGridMap(grid: GridMap): GridMap {
  return {
    mapId: grid.mapId,
    cols: grid.cols,
    rows: grid.rows,
    tiles: grid.tiles.map((row) => row.map((t) => ({ ...t }))),
  };
}

/**
 * Authored grids are hand-tuned for spike_zone / cover / exposed tags but often miss
 * thin walls that are clearly painted on the minimap (e.g. site barricades, site-to-
 * catwalk dividers). Re-reading the minimap at full resolution lets us promote
 * currently-walkable tiles to `wall` when most of their pixel area is wall paint.
 * Spike / cover / exposed / chokepoint tiles are preserved.
 */
const WALL_PROMOTION_MIN_RATIO = 0.22;
const WALL_PROMOTION_PROTECTED: ReadonlySet<TileType> = new Set([
  "spike_zone",
  "cover",
  "exposed",
  "high_ground",
  "chokepoint",
]);

async function augmentGridWithPixelWalls(
  grid: GridMap,
  imageAbsPath: string
): Promise<GridMap> {
  const { data, info } = await sharp(imageAbsPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const imgW = info.width;
  const imgH = info.height;
  const pixels = new Uint8Array(data);
  const { rows, cols } = grid;

  const tiles = grid.tiles.map((row) => row.map((t) => ({ ...t })));

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor((row / rows) * imgH);
    const y1 = Math.floor(((row + 1) / rows) * imgH);
    for (let col = 0; col < cols; col++) {
      const tile = tiles[row][col];
      if (tile.type === "wall" || tile.type === "void") continue;
      if (WALL_PROMOTION_PROTECTED.has(tile.type)) continue;

      const x0 = Math.floor((col / cols) * imgW);
      const x1 = Math.floor(((col + 1) / cols) * imgW);
      let total = 0;
      let wall = 0;
      let outside = 0;
      for (let y = y0; y < y1; y++) {
        const rowOff = y * imgW * 4;
        for (let x = x0; x < x1; x++) {
          const i = rowOff + x * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          total++;
          if (isOutsideMapPixel(r, g, b, a)) {
            outside++;
            continue;
          }
          if (isOutlineWallPixel(r, g, b, a)) wall++;
        }
      }
      if (total === 0) continue;
      const outsideRatio = outside / total;
      const wallRatio = wall / total;
      if (outsideRatio > 0.92) {
        tiles[row][col] = { ...tile, type: "void" };
        continue;
      }
      if (wallRatio >= WALL_PROMOTION_MIN_RATIO) {
        tiles[row][col] = { ...tile, type: "wall" };
      }
    }
  }

  return { ...grid, tiles };
}

/**
 * Builds the tactical grid for a scenario: either the committed author grid or minimap-derived.
 * Even authoritative grids are augmented with pixel-level walls from the minimap so we
 * never let pathfinding or vision cones slip through a wall that's clearly painted
 * on the source art.
 * Does not mutate the passed scenario.
 */
export async function resolveScenarioGrid(scenario: Scenario): Promise<GridMap> {
  const imagePath = path.join(process.cwd(), "public", scenario.minimapImage);

  if (scenario.authoritativeGrid) {
    const base = deepCloneGridMap(scenario.grid);
    try {
      return await augmentGridWithPixelWalls(base, imagePath);
    } catch {
      // If pixel read fails, fall back to the raw authored grid.
      return base;
    }
  }

  const grid = await generateGridFromMinimap(imagePath, scenario.map);
  const tiles = grid.tiles.map((row) => row.map((t) => ({ ...t })));
  scenario.applyGridOverrides?.(tiles);
  return { ...grid, tiles };
}
