import sharp from "sharp";
import { GRID_COLS, GRID_ROWS } from "@/lib/constants";
import { GridMap, TileType } from "@/types";
import { isOutsideMapPixel, isOutlineWallPixel } from "@/lib/mapFootprint";

/** Tactical cell is void if this little of the cell lies inside the flood-filled footprint. */
const TILE_INTERIOR_MIN_RATIO = 0.012;

/** A cell only becomes a wall if at least this ratio of its area is covered by white outline pixels. */
const WALL_COVERAGE_MIN_RATIO = 0.06;

/**
 * Builds a tactical grid from a minimap PNG:
 * - Void vs map art uses per-pixel heuristics (transparent, letterbox, dark matte); enclosed
 *   pockets are void even when not flood-connected to the border.
 * - Full-res pixels are bucketed into the 48×48 tactical grid spanning the entire image.
 * - Wall strokes use the same outline heuristic, but require a minimum coverage ratio so
 *   thin diagonal walls don’t unnecessarily block whole tiles.
 */
export async function generateGridFromMinimap(
  imagePath: string,
  mapId: string
): Promise<GridMap> {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const imgW = info.width;
  const imgH = info.height;
  const pixels = new Uint8Array(data);
  const cols = GRID_COLS;
  const rows = GRID_ROWS;

  interface CellStats {
    total: number;
    interior: number;
    wall: number;
  }

  const stats: CellStats[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ total: 0, interior: 0, wall: 0 }))
  );

  for (let y = 0; y < imgH; y++) {
    const row = Math.min(rows - 1, Math.floor((y / imgH) * rows));
    const rowOff = y * imgW * 4;
    for (let x = 0; x < imgW; x++) {
      const col = Math.min(cols - 1, Math.floor((x / imgW) * cols));
      const i = rowOff + x * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      const c = stats[row][col];
      c.total += 1;
      if (isOutsideMapPixel(r, g, b, a)) continue;
      c.interior += 1;
      if (isOutlineWallPixel(r, g, b, a)) {
        c.wall += 1;
      }
    }
  }

  const tiles: { type: TileType }[][] = [];
  for (let row = 0; row < rows; row++) {
    const tileRow: { type: TileType }[] = [];
    for (let col = 0; col < cols; col++) {
      const c = stats[row][col];
      const interiorRatio = c.total > 0 ? c.interior / c.total : 0;
      const wallRatio = c.total > 0 ? c.wall / c.total : 0;
      let type: TileType;
      if (interiorRatio < TILE_INTERIOR_MIN_RATIO) {
        type = "void";
      } else if (wallRatio >= WALL_COVERAGE_MIN_RATIO) {
        type = "wall";
      } else {
        type = "walkable";
      }
      tileRow.push({ type });
    }
    tiles.push(tileRow);
  }

  return {
    mapId,
    cols,
    rows,
    tiles,
  };
}
