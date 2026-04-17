import type { GridMap, Position, UtilityItem } from "@/types";
import {
  GRID_COLS,
  GRID_ROWS,
  METERS_PER_TILE,
  UTILITY_RADIUS,
  getUtilityRenderSpec,
} from "@/lib/constants";
import {
  getLineTiles,
  getTile,
  getTilesInRadius,
  isImpassableTerrain,
  posToTile,
  tileKey,
} from "./grid";

/** Approximate smoke volume on the tactical grid from placed smokes (planning / preview). */
export function smokeTilesFromPlacements(utilityPlacements: UtilityItem[]): Set<string> {
  const out = new Set<string>();
  for (const u of utilityPlacements) {
    if (u.type !== "smoke") continue;
    const spec = getUtilityRenderSpec(u.agentId, u.type);
    const radiusM = spec.radiusMeters ?? UTILITY_RADIUS.smoke;
    const rTiles = Math.max(1, Math.ceil(radiusM / METERS_PER_TILE));
    const center = posToTile(u.position);
    for (const t of getTilesInRadius(center, rTiles)) {
      if (t.row >= 0 && t.row < GRID_ROWS && t.col >= 0 && t.col < GRID_COLS) {
        out.add(tileKey(t));
      }
    }
  }
  return out;
}

/**
 * Union of every utility placement that hard-blocks vision on the tactical
 * grid: smokes (circles at the correct per-agent radius) and placed walls
 * (rasterized as lines between the placement endpoints). Used by planning
 * exposure and the tactical map's cone renderer so LOS responds to *all*
 * occluders, not just smokes.
 */
export function visionBlockerTilesFromPlacements(
  utilityPlacements: UtilityItem[]
): Set<string> {
  const out = new Set<string>();
  for (const u of utilityPlacements) {
    if (u.type === "smoke") {
      const spec = getUtilityRenderSpec(u.agentId, u.type);
      const radiusM = spec.radiusMeters ?? UTILITY_RADIUS.smoke;
      const rTiles = Math.max(1, Math.ceil(radiusM / METERS_PER_TILE));
      const center = posToTile(u.position);
      for (const t of getTilesInRadius(center, rTiles)) {
        if (t.row >= 0 && t.row < GRID_ROWS && t.col >= 0 && t.col < GRID_COLS) {
          out.add(tileKey(t));
        }
      }
    } else if (u.type === "wall" && u.target) {
      const a = posToTile(u.target);
      const b = posToTile(u.position);
      for (const t of getLineTiles(a, b)) {
        if (t.row < 0 || t.row >= GRID_ROWS || t.col < 0 || t.col >= GRID_COLS) continue;
        out.add(tileKey(t));
        // Thicken by 1 tile perpendicular so a thin line still occludes
        // through the full wall width (~1.4m tiles give ~2.8m painted wall).
        for (const dr of [-1, 1]) {
          for (const dc of [-1, 1]) {
            const tc = t.col + dc;
            const tr = t.row + dr;
            if (tr >= 0 && tr < GRID_ROWS && tc >= 0 && tc < GRID_COLS) {
              out.add(tileKey({ col: tc, row: tr }));
            }
          }
        }
      }
    }
  }
  return out;
}

/**
 * Radius (in meters) at which a blinding/suppressing utility forces a defender
 * off their hold. Kept conservative so users have to actually target the
 * defender to break their angle.
 */
const SUPPRESSION_RADIUS_M: Partial<Record<UtilityItem["type"], number>> = {
  flash: 5.5,
  concussion: 6.5,
  mollie: 4.0,
  nanoswarm: 4.0,
};

/**
 * Returns true if a defender should be treated as "off-angle" due to an
 * attacker utility placement. Flashes blind, mollies burn them off the spot,
 * concussions slow/disorient — in all cases the defender is not holding a
 * usable sightline on the path.
 */
export function isDefenderSuppressedByUtility(
  defenderPos: Position,
  utilityPlacements: UtilityItem[]
): boolean {
  for (const u of utilityPlacements) {
    const radiusM = SUPPRESSION_RADIUS_M[u.type];
    if (radiusM == null) continue;
    // Consider both the placement center AND the target point (omen flash /
    // breach walls travel toward target, so either endpoint can catch the
    // defender).
    const points: Position[] = [u.position];
    if (u.target) points.push(u.target);
    for (const p of points) {
      const dx = (p.x - defenderPos.x) * GRID_COLS * METERS_PER_TILE;
      const dy = (p.y - defenderPos.y) * GRID_ROWS * METERS_PER_TILE;
      if (dx * dx + dy * dy <= radiusM * radiusM) return true;
    }
  }
  return false;
}

function occludes(grid: GridMap, smoke: Set<string>, col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
  const t = getTile(grid, { col, row });
  if (!t) return true;
  if (isImpassableTerrain(t.type)) return true;
  if (smoke.has(tileKey({ col, row }))) return true;
  return false;
}

export type OcclusionSeg = { kind: "v" | "h"; x0: number; y0: number; x1: number; y1: number };

/**
 * Axis-aligned one-way boundaries between occluding tiles (wall / void / smoke) and open tiles.
 * Reused for every defender cone in a frame — call once per grid+smoke snapshot.
 */
export function buildOcclusionSegments(grid: GridMap, smoke: Set<string>): OcclusionSeg[] {
  const segs: OcclusionSeg[] = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 1; c < GRID_COLS; c++) {
      const a = occludes(grid, smoke, c - 1, r);
      const b = occludes(grid, smoke, c, r);
      if (a === b) continue;
      const x = c / GRID_COLS;
      const y0 = r / GRID_ROWS;
      const y1 = (r + 1) / GRID_ROWS;
      segs.push({ kind: "v", x0: x, y0: y0, x1: x, y1: y1 });
    }
  }

  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 1; r < GRID_ROWS; r++) {
      const a = occludes(grid, smoke, c, r - 1);
      const b = occludes(grid, smoke, c, r);
      if (a === b) continue;
      const y = r / GRID_ROWS;
      const x0 = c / GRID_COLS;
      const x1 = (c + 1) / GRID_COLS;
      segs.push({ kind: "h", x0, y0: y, x1, y1: y });
    }
  }

  segs.push({ kind: "v", x0: 0, y0: 0, x1: 0, y1: 1 });
  segs.push({ kind: "v", x0: 1, y0: 0, x1: 1, y1: 1 });
  segs.push({ kind: "h", x0: 0, y0: 0, x1: 1, y1: 0 });
  segs.push({ kind: "h", x0: 0, y0: 1, x1: 1, y1: 1 });

  return segs;
}

function rayVertical(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  xv: number,
  y0: number,
  y1: number,
  tMax: number
): number | null {
  if (Math.abs(dx) < 1e-12) return null;
  const t = (xv - ox) / dx;
  if (t <= 1e-9 || t > tMax) return null;
  const yHit = oy + t * dy;
  const ymin = Math.min(y0, y1) - 1e-9;
  const ymax = Math.max(y0, y1) + 1e-9;
  if (yHit < ymin || yHit > ymax) return null;
  return t;
}

function rayHorizontal(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  yh: number,
  x0: number,
  x1: number,
  tMax: number
): number | null {
  if (Math.abs(dy) < 1e-12) return null;
  const t = (yh - oy) / dy;
  if (t <= 1e-9 || t > tMax) return null;
  const xHit = ox + t * dx;
  const xmin = Math.min(x0, x1) - 1e-9;
  const xmax = Math.max(x0, x1) + 1e-9;
  if (xHit < xmin || xHit > xmax) return null;
  return t;
}

function castRayToBoundary(
  ox: number,
  oy: number,
  ux: number,
  uy: number,
  tMax: number,
  segs: OcclusionSeg[]
): Position {
  let best = tMax;
  for (const s of segs) {
    let t: number | null = null;
    if (s.kind === "v") {
      t = rayVertical(ox, oy, ux, uy, s.x0, s.y0, s.y1, tMax);
    } else {
      t = rayHorizontal(ox, oy, ux, uy, s.y0, s.x0, s.x1, tMax);
    }
    if (t !== null && t < best) best = t;
  }
  return { x: ox + ux * best, y: oy + uy * best };
}

/** Drop only strictly duplicate consecutive rim hits (same ray endpoint), keep angular order. */
function dedupeConsecutiveIdentical(points: Position[], eps: number): Position[] {
  if (points.length === 0) return points;
  const out: Position[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const q = out[out.length - 1];
    if (Math.hypot(p.x - q.x, p.y - q.y) > eps) out.push(p);
  }
  return out;
}

export interface VisionConeOptions {
  offAngle?: boolean;
}

export interface EnemyVisionFan {
  eye: Position;
  /** Hit points along the wedge arc, ordered left → right in world angle (for triangle fan from eye). */
  rim: Position[];
}

function normalizeAngle(angle: number, center: number): number {
  let a = angle;
  while (a < center - Math.PI) a += 2 * Math.PI;
  while (a > center + Math.PI) a -= 2 * Math.PI;
  return a;
}

/** Fast DDA grid raycast: stops at first wall/void/smoke or map edge. */
function castRayOnGrid(
  grid: GridMap,
  smoke: Set<string>,
  ox: number,
  oy: number,
  angle: number,
  tMaxNorm: number
): Position {
  const N = GRID_COLS;
  const rx = ox * N;
  const ry = oy * N;
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
    tDeltaX = 1 / (Math.abs(dx) * N);
    tMaxX = dx > 0 ? (x + 1 - rx) / (dx * N) : (x - rx) / (dx * N);
  }

  let tMaxY: number;
  let tDeltaY: number;
  if (Math.abs(dy) < 1e-12) {
    tMaxY = Infinity;
    tDeltaY = Infinity;
  } else {
    tDeltaY = 1 / (Math.abs(dy) * N);
    tMaxY = dy > 0 ? (y + 1 - ry) / (dy * N) : (y - ry) / (dy * N);
  }

  while (true) {
    if (tMaxX < tMaxY - 1e-12) {
      x += stepX;
      if (tMaxX > tMaxNorm) break;
      if (occludes(grid, smoke, x, y)) {
        return { x: ox + dx * tMaxX, y: oy + dy * tMaxX };
      }
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxX - 1e-12) {
      y += stepY;
      if (tMaxY > tMaxNorm) break;
      if (occludes(grid, smoke, x, y)) {
        return { x: ox + dx * tMaxY, y: oy + dy * tMaxY };
      }
      tMaxY += tDeltaY;
    } else {
      const t = tMaxX;
      if (t > tMaxNorm) break;
      const nextX = x + stepX;
      const nextY = y + stepY;
      if (
        occludes(grid, smoke, nextX, y) ||
        occludes(grid, smoke, x, nextY) ||
        occludes(grid, smoke, nextX, nextY)
      ) {
        return { x: ox + dx * t, y: oy + dy * t };
      }
      x = nextX;
      y = nextY;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    }
  }

  return { x: ox + dx * tMaxNorm, y: oy + dy * tMaxNorm };
}

/**
 * Defender FOV wedge clipped by hard geometry (wall / void / smoke) + map bounds.
 * Renders as a clean triangle fan with no wall leakage.
 */
export function buildEnemyVisionPolygon(
  grid: GridMap,
  smoke: Set<string>,
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
  const coneLeft = normalizeAngle(coneLeftRaw, facing);
  const coneRight = normalizeAngle(coneRightRaw, facing);
  const tMax = Math.SQRT2 * 1.02;

  const angles: number[] = [];
  const angleEps = 1e-7;

  const addAngle = (raw: number) => {
    const a = normalizeAngle(raw, facing);
    if (coneLeft <= coneRight) {
      if (a >= coneLeft - angleEps && a <= coneRight + angleEps) angles.push(a);
    } else {
      if (a >= coneLeft - angleEps) angles.push(a);
      else if (a <= coneRight + angleEps) angles.push(a + 2 * Math.PI);
    }
  };

  // Uniform base samples (~1° spacing)
  const numBaseRays = 360;
  for (let i = 0; i <= numBaseRays; i++) {
    addAngle(coneLeftRaw + (coneRightRaw - coneLeftRaw) * (i / numBaseRays));
  }

  // Add every grid corner angle so walls never leak between rays
  const N = GRID_COLS;
  for (let c = 0; c <= N; c++) {
    for (let r = 0; r <= N; r++) {
      const cx = c / N;
      const cy = r / N;
      const dcx = cx - eye.x;
      const dcy = cy - eye.y;
      if (dcx * dcx + dcy * dcy < 1e-12) continue;
      addAngle(Math.atan2(dcy, dcx));
    }
  }

  angles.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const a of angles) {
    if (deduped.length === 0 || Math.abs(a - deduped[deduped.length - 1]) > 1e-6) {
      deduped.push(a);
    }
  }

  const rim: Position[] = [];
  for (const a of deduped) {
    rim.push(castRayOnGrid(grid, smoke, eye.x, eye.y, a, tMax));
  }

  const cleaned = dedupeConsecutiveIdentical(rim, 1e-8);
  return { eye, rim: cleaned };
}

/** @deprecated Use buildEnemyVisionPolygon instead. */
export function buildEnemyVisionPolygonFromSegments(
  segs: OcclusionSeg[],
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
  const numRays = 96;
  const tMax = Math.SQRT2 * 1.02;

  const rim: Position[] = [];
  for (let i = 0; i <= numRays; i++) {
    const u = i / numRays;
    const ang = facing - halfCone + 2 * halfCone * u;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    rim.push(castRayToBoundary(eye.x, eye.y, ux, uy, tMax, segs));
  }

  const cleaned = dedupeConsecutiveIdentical(rim, 1e-8);
  return { eye, rim: cleaned };
}
