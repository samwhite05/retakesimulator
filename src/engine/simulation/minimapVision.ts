import type { Position } from "@/types";
import type { EnemyVisionFan, VisionConeOptions } from "./visionCone";
import { GRID_COLS } from "@/lib/constants";
import { isOutlineWallPixel, isOutsideMapPixel } from "@/lib/mapFootprint";

/**
 * Pixel-accurate vision cones driven by the minimap's painted wall outlines.
 *
 * Riot's tactical minimaps use a consistent palette: mid-grey = walkable
 * floor, bright white = walls / non-playable interior, olive/tan = plant
 * sites, transparent = outside the map.  These outlines were drawn from the
 * actual level geometry, so they are a much better source of truth than our
 * coarse 48×48 grid for determining what a defender can see.
 *
 * We turn the minimap into a binary wall bitmap once per map load, then cast
 * rays directly against it with Amanatides-Woo DDA. A pixel counts as a
 * blocker if either:
 *   1. It's a bright neutral stroke (interior wall outline), or
 *   2. It's outside the painted map footprint (transparent / letterbox).
 * Sites and floors stay open. Smokes are applied as a grid overlay so placed
 * utility still occludes.
 */

export interface WallBitmap {
  width: number;
  height: number;
  /** 1 byte per pixel, 1 = opaque wall, 0 = open / walkable. */
  data: Uint8Array;
}

/**
 * Classify minimap pixels. A pixel blocks vision when it's either a white
 * wall stroke or a void pixel (outside the map footprint).
 */
export function buildWallBitmapFromImageData(imgData: ImageData): WallBitmap {
  const { width, height, data } = imgData;
  const out = new Uint8Array(width * height);
  // Semi-transparent pixels are produced by the canvas resize at the map
  // boundary (alpha ramps from 0 → 255). Treat anything less than fully
  // opaque as wall so rays can't slip through the hairline edge band.
  const ALPHA_SOLID = 220;
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = data[o + 3];
    if (
      a < ALPHA_SOLID ||
      isOutsideMapPixel(r, g, b, a) ||
      isOutlineWallPixel(r, g, b, a)
    ) {
      out[i] = 1;
    }
  }

  // 1-pixel dilation seals hairline strokes without closing narrow doorways.
  return dilate1(out, width, height);
}

function dilate1(src: Uint8Array, w: number, h: number): WallBitmap {
  const dst = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i]) {
        dst[i] = 1;
        continue;
      }
      const l = x > 0 ? src[i - 1] : 0;
      const r = x < w - 1 ? src[i + 1] : 0;
      const u = y > 0 ? src[i - w] : 0;
      const d = y < h - 1 ? src[i + w] : 0;
      dst[i] = l | r | u | d;
    }
  }
  return { width: w, height: h, data: dst };
}

/**
 * Amanatides-Woo DDA raycast against the wall bitmap (with optional smoke grid).
 * Returns the first-hit position in normalized map coords (0..1, 0..1).
 */
function castRayOnBitmap(
  bitmap: WallBitmap,
  smokeTiles: Set<string> | null,
  ox: number,
  oy: number,
  angle: number,
  tMaxNorm: number
): Position {
  const W = bitmap.width;
  const H = bitmap.height;
  const rx = ox * W;
  const ry = oy * H;
  let x = Math.floor(rx);
  let y = Math.floor(ry);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;

  let tMaxX: number;
  let tDeltaX: number;
  if (Math.abs(dx) < 1e-12) {
    tMaxX = Infinity;
    tDeltaX = Infinity;
  } else {
    tDeltaX = 1 / (Math.abs(dx) * W);
    tMaxX = dx > 0 ? (x + 1 - rx) / (dx * W) : (x - rx) / (dx * W);
  }
  let tMaxY: number;
  let tDeltaY: number;
  if (Math.abs(dy) < 1e-12) {
    tMaxY = Infinity;
    tDeltaY = Infinity;
  } else {
    tDeltaY = 1 / (Math.abs(dy) * H);
    tMaxY = dy > 0 ? (y + 1 - ry) / (dy * H) : (y - ry) / (dy * H);
  }

  const isBlocked = (px: number, py: number): boolean => {
    if (px < 0 || px >= W || py < 0 || py >= H) return true;
    if (bitmap.data[py * W + px] === 1) return true;
    if (smokeTiles && smokeTiles.size > 0) {
      const tc = Math.floor((px / W) * GRID_COLS);
      const tr = Math.floor((py / H) * GRID_COLS);
      if (smokeTiles.has(`${tc},${tr}`)) return true;
    }
    return false;
  };

  // Grace band: only engaged when the defender's tile center itself samples
  // to a wall pixel (rare, happens when the eye sits right on a dilated wall
  // edge). Without a condition here, every ray would skip the first few
  // pixels and let walls adjacent to the defender leak vision through — the
  // "rays clipping through walls" bug. With the condition, normal defenders
  // get strict wall blocking while wall-embedded eyes still produce a cone.
  // IMPORTANT: only check the raw wall bitmap here — NOT smokes. If the
  // defender is standing *inside* a smoke, we explicitly want their cone to
  // collapse rather than be given a grace band to escape through.
  const eyePx = Math.max(0, Math.min(W - 1, Math.floor(ox * W)));
  const eyePy = Math.max(0, Math.min(H - 1, Math.floor(oy * H)));
  const eyeInsideWall = bitmap.data[eyePy * W + eyePx] === 1;
  const tGrace = eyeInsideWall ? 4 / Math.min(W, H) : 0;

  while (true) {
    if (tMaxX < tMaxY - 1e-12) {
      x += stepX;
      if (tMaxX > tMaxNorm) break;
      if (tMaxX >= tGrace && isBlocked(x, y)) {
        return { x: ox + dx * tMaxX, y: oy + dy * tMaxX };
      }
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxX - 1e-12) {
      y += stepY;
      if (tMaxY > tMaxNorm) break;
      if (tMaxY >= tGrace && isBlocked(x, y)) {
        return { x: ox + dx * tMaxY, y: oy + dy * tMaxY };
      }
      tMaxY += tDeltaY;
    } else {
      const t = tMaxX;
      if (t > tMaxNorm) break;
      const nx = x + stepX;
      const ny = y + stepY;
      if (t >= tGrace && (isBlocked(nx, y) || isBlocked(x, ny) || isBlocked(nx, ny))) {
        return { x: ox + dx * t, y: oy + dy * t };
      }
      x = nx;
      y = ny;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    }
  }

  return { x: ox + dx * tMaxNorm, y: oy + dy * tMaxNorm };
}

function normalizeAngle(angle: number, center: number): number {
  let a = angle;
  while (a < center - Math.PI) a += 2 * Math.PI;
  while (a > center + Math.PI) a -= 2 * Math.PI;
  return a;
}

/**
 * Defender FOV wedge built from minimap pixel raycasting.
 * Drop-in replacement for `buildEnemyVisionPolygon`.
 */
export function buildVisionPolygonFromBitmap(
  bitmap: WallBitmap,
  smokeTiles: Set<string> | null,
  eye: Position,
  lookAt: Position,
  options?: VisionConeOptions
): EnemyVisionFan {
  const dx = lookAt.x - eye.x;
  const dy = lookAt.y - eye.y;
  let facing = Math.atan2(dy, dx);
  if (!Number.isFinite(facing) || (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6)) {
    facing = Math.PI / 2;
  }

  const halfDeg = options?.offAngle ? 68 : 42;
  const halfCone = (halfDeg * Math.PI) / 180;
  const coneLeftRaw = facing - halfCone;
  const coneRightRaw = facing + halfCone;
  const tMax = Math.SQRT2 * 1.02;

  // Uniform sampling — at ~0.4° per ray the per-pixel wall detail is preserved
  // for any reasonable render size. Dropping from 720 to 360 rays cuts cost
  // substantially while still rendering smoothly once Konva applies stroke
  // tension. Pixel DDA is cheap so this costs less than injecting every
  // corner as an explicit angle.
  const numRays = 360;
  const distances = new Float64Array(numRays + 1);
  const angles = new Float64Array(numRays + 1);
  for (let i = 0; i <= numRays; i++) {
    const a = coneLeftRaw + ((coneRightRaw - coneLeftRaw) * i) / numRays;
    angles[i] = a;
    const hit = castRayOnBitmap(bitmap, smokeTiles, eye.x, eye.y, a, tMax);
    distances[i] = Math.hypot(hit.x - eye.x, hit.y - eye.y);
  }

  // Conservative inward-only smoothing: a spike where distance[i] >> neighbors
  // signals a ray slipping past a wall corner. Pull it back to the neighbor
  // distance. We never push distances *out* (which would leak vision through
  // a wall). Small-scale jitter (within 8% of neighbors) is left alone so the
  // cone still respects real geometry edges.
  const smoothed = new Float64Array(numRays + 1);
  smoothed[0] = distances[0];
  smoothed[numRays] = distances[numRays];
  for (let i = 1; i < numRays; i++) {
    const prev = distances[i - 1];
    const cur = distances[i];
    const next = distances[i + 1];
    const neighborMax = Math.max(prev, next);
    const neighborMin = Math.min(prev, next);
    if (cur > neighborMax * 1.12 && cur - neighborMax > 0.02) {
      smoothed[i] = neighborMax;
    } else if (cur < neighborMin * 0.88 && neighborMin - cur > 0.02) {
      smoothed[i] = neighborMin * 0.88;
    } else {
      smoothed[i] = cur;
    }
  }

  const rim: Position[] = [];
  for (let i = 0; i <= numRays; i++) {
    const a = angles[i];
    const d = smoothed[i];
    rim.push({ x: eye.x + Math.cos(a) * d, y: eye.y + Math.sin(a) * d });
  }

  // Drop strictly duplicate consecutive rim hits to keep the Konva triangle
  // fan tidy (DDA can return the same boundary point from adjacent rays).
  const cleaned: Position[] = [rim[0]];
  for (let i = 1; i < rim.length; i++) {
    const p = rim[i];
    const q = cleaned[cleaned.length - 1];
    if (Math.hypot(p.x - q.x, p.y - q.y) > 1e-7) cleaned.push(p);
  }

  void normalizeAngle; // silence: kept here for API parity if we add vertex injection later
  return { eye, rim: cleaned };
}
