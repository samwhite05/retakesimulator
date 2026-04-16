import type { GridMap, Position, Scenario, UtilityItem } from "@/types";
import { buildEnemyVisionPolygon, smokeTilesFromPlacements } from "./visionCone";
import { buildVisionPolygonFromBitmap, type WallBitmap } from "./minimapVision";

type SmokePlacementLike = Pick<UtilityItem, "type" | "position">;

/**
 * Exposure-driven pathing model.
 *
 * Valorant retakes aren't distance puzzles — they're sightline puzzles. The
 * exposure engine scores a drawn path by how much of it sits inside a known
 * defender's vision cone *and* isn't occluded by smoke or wall. Safe = teal,
 * trading = amber, open = red.
 *
 * Exposure ∈ [0, 1] where 0 is covered and 1 is fully open in defender FOV.
 */

export interface PathSegmentExposure {
  /** Normalized endpoints of this segment. */
  start: Position;
  end: Position;
  /** 0..1 exposure score; 0 = fully covered, 1 = naked in defender FOV. */
  exposure: number;
}

export interface PathExposureReport {
  segments: PathSegmentExposure[];
  /** Length-weighted average exposure across the whole path. */
  averageExposure: number;
  /** Max segment exposure (the single most dangerous step). */
  peakExposure: number;
  /** Fraction of path length in red / amber / teal bands. */
  redFraction: number;
  amberFraction: number;
  tealFraction: number;
}

const RED_THRESHOLD = 0.55;
const AMBER_THRESHOLD = 0.15;

function normalizeAngle(angle: number, center: number): number {
  let a = angle;
  while (a < center - Math.PI) a += 2 * Math.PI;
  while (a > center + Math.PI) a -= 2 * Math.PI;
  return a;
}

/**
 * Ray-triangle-fan membership test for a vision polygon described by
 * `{ eye, rim }`. A point p is inside the polygon iff the ray from eye to p
 * stays within the angular spread of the fan AND the point is closer than the
 * rim at that angle.
 */
function pointInVisionFan(
  eye: Position,
  rim: Position[],
  p: Position
): boolean {
  if (rim.length < 2) return false;
  const dx = p.x - eye.x;
  const dy = p.y - eye.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return true;
  const angle = Math.atan2(dy, dx);

  const leftDx = rim[0].x - eye.x;
  const leftDy = rim[0].y - eye.y;
  const leftAngle = Math.atan2(leftDy, leftDx);
  const rightDx = rim[rim.length - 1].x - eye.x;
  const rightDy = rim[rim.length - 1].y - eye.y;
  const rightAngle = Math.atan2(rightDy, rightDx);

  const facing = (leftAngle + rightAngle) / 2;
  const normAngle = normalizeAngle(angle, facing);
  const normLeft = normalizeAngle(leftAngle, facing);
  const normRight = normalizeAngle(rightAngle, facing);
  const lo = Math.min(normLeft, normRight);
  const hi = Math.max(normLeft, normRight);
  if (normAngle < lo - 1e-6 || normAngle > hi + 1e-6) return false;

  // Binary search rim for the two samples that bracket this angle.
  const rimAngles = rim.map((r) => normalizeAngle(Math.atan2(r.y - eye.y, r.x - eye.x), facing));
  let lo2 = 0;
  let hi2 = rimAngles.length - 1;
  const ascending = rimAngles[0] < rimAngles[rimAngles.length - 1];
  while (hi2 - lo2 > 1) {
    const mid = (lo2 + hi2) >> 1;
    const va = rimAngles[mid];
    if (ascending ? va < normAngle : va > normAngle) lo2 = mid;
    else hi2 = mid;
  }
  const a = rim[lo2];
  const b = rim[hi2];
  const aDist = Math.hypot(a.x - eye.x, a.y - eye.y);
  const bDist = Math.hypot(b.x - eye.x, b.y - eye.y);
  const va = rimAngles[lo2];
  const vb = rimAngles[hi2];
  const span = vb - va;
  const t = Math.abs(span) < 1e-9 ? 0 : (normAngle - va) / span;
  const boundaryDist = aDist + (bDist - aDist) * t;
  return dist <= boundaryDist + 1e-6;
}

/**
 * Compute per-segment exposure for a player's drawn path.
 *
 * `path` is expected in normalized map coordinates (same as scenario data).
 * We sample each segment at sub-tile resolution and check, for each sample,
 * whether any known defender has clear vision to it.
 */
export function computePathExposure(
  scenario: Scenario,
  startPosition: Position,
  path: Position[],
  utilityPlacements: SmokePlacementLike[],
  /**
   * Optional minimap-derived wall bitmap. When provided, defender vision
   * fans are raycast against the painted wall outlines for pixel-accurate
   * cones. Falls back to the coarse grid occluder when absent (e.g. during
   * SSR or before the minimap image has loaded).
   */
  wallBitmap?: WallBitmap | null
): PathExposureReport {
  if (path.length === 0) {
    return {
      segments: [],
      averageExposure: 0,
      peakExposure: 0,
      redFraction: 0,
      amberFraction: 0,
      tealFraction: 0,
    };
  }

  const smoke = smokeTilesFromPlacements(
    utilityPlacements.filter((u): u is UtilityItem => u.type === "smoke" && !!u.position)
  );
  const fans = scenario.enemyAgents
    .filter((e) => !e.isHidden)
    .map((e) => {
      const lookAt = e.lookAt ?? scenario.spikeSite;
      if (wallBitmap) {
        return buildVisionPolygonFromBitmap(wallBitmap, smoke, e.position, lookAt, {
          offAngle: e.offAngle,
        });
      }
      return buildEnemyVisionPolygon(scenario.grid, smoke, e.position, lookAt, {
        offAngle: e.offAngle,
      });
    });

  const fullPath: Position[] = [startPosition, ...path];
  const segments: PathSegmentExposure[] = [];

  let totalLen = 0;
  let weightedSum = 0;
  let peak = 0;
  let redLen = 0;
  let amberLen = 0;
  let tealLen = 0;

  const cols = scenario.grid.cols || 48;
  const sampleSpacing = 1 / cols / 2; // ~half-tile sampling

  for (let i = 0; i < fullPath.length - 1; i++) {
    const a = fullPath[i];
    const b = fullPath[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;

    const samples = Math.max(2, Math.ceil(length / sampleSpacing));
    let exposedSamples = 0;
    for (let s = 0; s < samples; s++) {
      const t = (s + 0.5) / samples;
      const p = { x: a.x + dx * t, y: a.y + dy * t };
      let visible = false;
      for (const fan of fans) {
        if (pointInVisionFan(fan.eye, fan.rim, p)) {
          visible = true;
          break;
        }
      }
      if (visible) exposedSamples++;
    }
    const exposure = exposedSamples / samples;
    segments.push({ start: a, end: b, exposure });

    totalLen += length;
    weightedSum += exposure * length;
    peak = Math.max(peak, exposure);
    if (exposure >= RED_THRESHOLD) redLen += length;
    else if (exposure >= AMBER_THRESHOLD) amberLen += length;
    else tealLen += length;
  }

  const averageExposure = totalLen > 0 ? weightedSum / totalLen : 0;
  return {
    segments,
    averageExposure,
    peakExposure: peak,
    redFraction: totalLen > 0 ? redLen / totalLen : 0,
    amberFraction: totalLen > 0 ? amberLen / totalLen : 0,
    tealFraction: totalLen > 0 ? tealLen / totalLen : 0,
  };
}

export function exposureColor(exposure: number): {
  fill: string;
  stroke: string;
  label: string;
} {
  if (exposure >= RED_THRESHOLD) {
    return { fill: "rgba(255, 70, 85, 0.9)", stroke: "#ff4655", label: "Open" };
  }
  if (exposure >= AMBER_THRESHOLD) {
    return { fill: "rgba(245, 177, 60, 0.9)", stroke: "#f5b13c", label: "Trade" };
  }
  return { fill: "rgba(93, 212, 190, 0.9)", stroke: "#5dd4be", label: "Safe" };
}

/** Also exported so the runner can lookup point-in-fan. */
export { pointInVisionFan };

export type { GridMap };
