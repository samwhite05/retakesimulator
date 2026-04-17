/**
 * Shared minimap footprint logic (server gridgen + client grid chrome).
 * Void = per-pixel heuristics (`isOutsideMapPixel`): transparent, letterbox black, neutral dark matte,
 * and enclosed pockets of the same (no reliance on border flood-fill for interior ratio).
 */

export const ALPHA_VOID = 30;
/** Opaque pixels at or below this max(R,G,B) are treated as letterbox / matte. */
export const LETTERBOX_RGB_MAX = 36;
/**
 * Dark-but-not-black UI / gap pixels above LETTERBOX_RGB_MAX. Low chroma avoids eating tinted
 * playspace; max is capped so normal minimap floor (lighter grays) stays playable.
 */
export const DARK_MATTE_RGB_MAX = 62;
export const DARK_MATTE_CHROMA_MAX = 18;

export function isOutsideMapPixel(r: number, g: number, b: number, a: number): boolean {
  if (a <= ALPHA_VOID) return true;
  const max = Math.max(r, g, b);
  if (max <= LETTERBOX_RGB_MAX) return true;
  const min = Math.min(r, g, b);
  if (max <= DARK_MATTE_RGB_MAX && max - min <= DARK_MATTE_CHROMA_MAX) return true;
  return false;
}

export function isOutlineWallPixel(r: number, g: number, b: number, a: number): boolean {
  if (a <= ALPHA_VOID) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  // Riot's wall strokes are near-white (R,G,B in the 230–255 band). We widen the
  // acceptable range slightly so antialiased wall edges — which drop to ~210 on
  // client-side canvas reads — still register as walls. The floor gray sits
  // around 140–170 so there is comfortable headroom.
  return max >= 210 && min >= 175 && chroma <= 48;
}

/**
 * Fraction of pixels in each tactical cell that read as map art (not void by `isOutsideMapPixel`).
 * Enclosed black/transparent pockets count as void here (unlike any border-only flood fill).
 */
export function buildCellInteriorFractions(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  cols: number,
  rows: number
): Float32Array {
  const out = new Float32Array(rows * cols);
  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor((row / rows) * height);
    const y1 = Math.floor(((row + 1) / rows) * height);
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col / cols) * width);
      const x1 = Math.floor(((col + 1) / cols) * width);
      let total = 0;
      let inside = 0;
      for (let y = y0; y < y1; y++) {
        const base = y * width;
        for (let x = x0; x < x1; x++) {
          total++;
          const i = (base + x) * 4;
          if (!isOutsideMapPixel(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3])) inside++;
        }
      }
      out[row * cols + col] = total > 0 ? inside / total : 0;
    }
  }
  return out;
}
