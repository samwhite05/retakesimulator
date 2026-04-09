/**
 * Line-of-Sight raycasting engine.
 * 
 * Samples the minimap image pixels along a ray path to determine
 * if a line between two points is blocked by walls.
 * 
 * Walls on minimaps are typically darker pixels (lower brightness).
 * Walkable areas are lighter. We use a brightness threshold to detect walls.
 */

import { createCanvas, loadImage, Canvas } from "canvas";
import * as path from "path";
import * as fs from "fs";

// Brightness threshold — pixels below this are considered walls
const WALL_BRIGHTNESS_THRESHOLD = 80;

// Alpha threshold — pixels below this are transparent (background, NOT walls)
const ALPHA_THRESHOLD = 30;

// How many points to sample along the ray
const RAY_SAMPLES = 30;

// Cache loaded minimap images
const minimapCache = new Map<string, Canvas>();

/**
 * Checks if there's a clear line of sight between two points
 * on a given map's minimap.
 * 
 * @param mapId - e.g., "ascent"
 * @param from - origin position (0-1 normalized)
 * @param to - target position (0-1 normalized)
 * @returns true if the path is NOT blocked by walls
 */
export async function hasLineOfSight(
  mapId: string,
  from: { x: number; y: number },
  to: { x: number; y: number }
): Promise<boolean> {
  const canvas = await loadMinimap(mapId);
  if (!canvas) {
    // If no minimap available, default to permissive (no LOS check)
    console.warn(`[LOS] No minimap found for "${mapId}", skipping LOS check`);
    return true;
  }

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const fromX = Math.floor(from.x * width);
  const fromY = Math.floor(from.y * height);
  const toX = Math.floor(to.x * width);
  const toY = Math.floor(to.y * height);

  // Sample points along the ray
  for (let i = 1; i <= RAY_SAMPLES; i++) {
    const t = i / (RAY_SAMPLES + 1);
    const sampleX = Math.floor(fromX + (toX - fromX) * t);
    const sampleY = Math.floor(fromY + (toY - fromY) * t);

    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(width - 1, sampleX));
    const clampedY = Math.max(0, Math.min(height - 1, sampleY));

    const pixel = ctx.getImageData(clampedX, clampedY, 1, 1);
    const brightness = getBrightness(pixel.data);

    // null = transparent (open space), skip
    if (brightness === null) continue;
    if (brightness < WALL_BRIGHTNESS_THRESHOLD) {
      // Hit a wall — LOS is blocked
      return false;
    }
  }

  return true;
}

/**
 * Checks if a utility placement has valid line of sight from the agent.
 * Returns the result with details.
 */
export async function checkUtilityLOS(
  mapId: string,
  agentPosition: { x: number; y: number },
  utilityPosition: { x: number; y: number },
  utilityType: string
): Promise<{
  hasLOS: boolean;
  blockedAt?: { x: number; y: number };
  detail: string;
}> {
  const canvas = await loadMinimap(mapId);
  if (!canvas) {
    return { hasLOS: true, detail: "No minimap loaded, LOS check skipped" };
  }

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const fromX = Math.floor(agentPosition.x * width);
  const fromY = Math.floor(agentPosition.y * height);
  const toX = Math.floor(utilityPosition.x * width);
  const toY = Math.floor(utilityPosition.y * height);

  for (let i = 1; i <= RAY_SAMPLES; i++) {
    const t = i / (RAY_SAMPLES + 1);
    const sampleX = Math.floor(fromX + (toX - fromX) * t);
    const sampleY = Math.floor(fromY + (toY - fromY) * t);

    const clampedX = Math.max(0, Math.min(width - 1, sampleX));
    const clampedY = Math.max(0, Math.min(height - 1, sampleY));

    const pixel = ctx.getImageData(clampedX, clampedY, 1, 1);
    const brightness = getBrightness(pixel.data);

    // null = transparent (open space), skip
    if (brightness === null) continue;
    if (brightness < WALL_BRIGHTNESS_THRESHOLD) {
      const blockedX = clampedX / width;
      const blockedY = clampedY / height;
      return {
        hasLOS: false,
        blockedAt: { x: blockedX, y: blockedY },
        detail: `${utilityType} path blocked by wall — no line of sight from agent to target`,
      };
    }
  }

  return { hasLOS: true, detail: `Clear line of sight for ${utilityType}` };
}

/**
 * Gets the average brightness of a pixel (RGBA → 0-255).
 * Uses perceived luminance weighting: 0.299*R + 0.587*G + 0.114*B
 *
 * Returns null if the pixel is transparent (alpha below threshold) —
 * transparent areas are NOT walls, they're just background.
 */
function getBrightness(rgba: Uint8ClampedArray): number | null {
  const alpha = rgba[3];

  // Transparent pixel — treat as open space (not a wall)
  if (alpha < ALPHA_THRESHOLD) {
    return null;
  }

  return (
    rgba[0] * 0.299 +
    rgba[1] * 0.587 +
    rgba[2] * 0.114
  );
}

/**
 * Loads a minimap image from the assets directory and caches it as a canvas.
 */
async function loadMinimap(mapId: string): Promise<Canvas | null> {
  if (minimapCache.has(mapId)) {
    return minimapCache.get(mapId)!;
  }

  // Try common image formats
  const assetDir = path.resolve(__dirname, "../../../../assets/minimaps");
  const possibleFiles = [
    `${mapId}.png`,
    `${mapId}.jpg`,
    `${mapId}.jpeg`,
    `${mapId}.webp`,
  ];

  let imagePath: string | null = null;
  for (const file of possibleFiles) {
    const fullPath = path.join(assetDir, file);
    if (fs.existsSync(fullPath)) {
      imagePath = fullPath;
      break;
    }
  }

  if (!imagePath) {
    return null;
  }

  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    minimapCache.set(mapId, canvas);
    return canvas;
  } catch (err) {
    console.error(`[LOS] Failed to load minimap "${mapId}":`, err);
    return null;
  }
}

/**
 * Clears the minimap cache (useful if assets change).
 */
export function clearMinimapCache(): void {
  minimapCache.clear();
}

/**
 * Pre-warm the cache by loading all known minimaps.
 */
export async function warmupMinimapCache(mapIds: string[]): Promise<void> {
  for (const mapId of mapIds) {
    await loadMinimap(mapId);
  }
}
