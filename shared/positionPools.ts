/**
 * Defender position pools — tactically valid positions per site per map.
 * 
 * Each map has multiple sites, each site has position pools organized by role:
 * - "anchor": holds the site pre-plant, falls back post-plant
 * - "lurker": plays off-angles, flanks post-plant
 * - "retake": positioned to retake if site is lost
 * - "postplant": common positions after planting spike
 * - "common": positions used in multiple situations
 *
 * Positions are 0-1 normalized coordinates matching the minimap image.
 *
 * HOW TO ADD NEW POSITIONS:
 * 1. Open the minimap in an image editor
 * 2. Note the pixel coordinates of the position (e.g., x=750, y=300 on a 1024x1024 map)
 * 3. Convert to normalized: x_norm = pixel_x / 1024, y_norm = pixel_y / 1024
 * 4. Add to the appropriate pool below
 * 5. The scenario generator randomly picks N positions from the pool
 */

export type PositionRole = "anchor" | "lurker" | "retake" | "postplant" | "common" | "offangle" | "retake_spawn";

export interface PositionDef {
  id: string;
  name: string;          // Human-readable name (e.g., "Market", "Tree")
  position: { x: number; y: number };  // 0-1 normalized
  role: PositionRole;
  description?: string;  // Optional tactical note
}

export interface SitePositionPool {
  siteId: string;        // e.g., "ascent-b"
  siteName: string;      // e.g., "B Site"
  plantZone: {           // The plantable area (green zone on minimap)
    center: { x: number; y: number };
    radius: number;      // Radius of plantable area (0-1 normalized)
  };
  defenderPositions: PositionDef[];
  attackerRetakePaths: PositionDef[]; // Common retake entry points
}

export interface MapPositionPools {
  mapId: string;
  mapName: string;
  sites: SitePositionPool[];
}

// ========================================
// ASCENT — Full position pools
// ========================================
// Coordinates estimated from Valorant tactical minimap (1024x1024)
// A site = left side, B site = right side
// CT spawn = bottom center, T spawn = top center

export const ASCENT_POSITIONS: MapPositionPools = {
  mapId: "ascent",
  mapName: "Ascent",
  sites: [
    {
      siteId: "ascent-b",
      siteName: "B Site",
      plantZone: {
        // B site plant zone — the circular green area on the minimap
        // Located in the upper-right quadrant
        center: { x: 0.74, y: 0.38 },
        radius: 0.06, // ~60px radius on 1024 map
      },
      defenderPositions: [
        // ===== B SITE ANCHOR POSITIONS (pre-plant) =====
        {
          id: "b-default",
          name: "Default",
          position: { x: 0.72, y: 0.42 },
          role: "anchor",
          description: "Standard site anchor, covers Market and Tree",
        },
        {
          id: "b-market",
          name: "Market",
          position: { x: 0.66, y: 0.30 },
          role: "anchor",
          description: "Inside Market, holds Market door angle",
        },
        {
          id: "b-market-stairs",
          name: "Market Stairs",
          position: { x: 0.62, y: 0.35 },
          role: "anchor",
          description: "On Market stairs, elevated angle on site",
        },
        {
          id: "b-tree",
          name: "Tree",
          position: { x: 0.82, y: 0.44 },
          role: "anchor",
          description: "Behind Tree, covers B Main and site entrance",
        },
        {
          id: "b-tree-back",
          name: "Tree Back",
          position: { x: 0.85, y: 0.48 },
          role: "anchor",
          description: "Behind Tree further back, safer hold",
        },

        // ===== POST-PLANT POSITIONS (after spike planted) =====
        {
          id: "b-market-post",
          name: "Market (Post-Plant)",
          position: { x: 0.64, y: 0.28 },
          role: "postplant",
          description: "Deep in Market, hard to trade",
        },
        {
          id: "b-market-door",
          name: "Market Door",
          position: { x: 0.68, y: 0.33 },
          role: "postplant",
          description: "At Market door, peeking onto site",
        },
        {
          id: "b-tree-post",
          name: "Tree (Post-Plant)",
          position: { x: 0.80, y: 0.46 },
          role: "postplant",
          description: "Behind Tree, watching B Main and default",
        },
        {
          id: "b-behind-site",
          name: "Behind Site",
          position: { x: 0.76, y: 0.48 },
          role: "postplant",
          description: "Behind the spike, crossfires with Tree",
        },
        {
          id: "b-on-spike",
          name: "On Spike",
          position: { x: 0.74, y: 0.38 },
          role: "postplant",
          description: "Sitting directly on the spike (risky)",
        },
        {
          id: "b-ct-rotate",
          name: "CT Rotate",
          position: { x: 0.70, y: 0.52 },
          role: "postplant",
          description: "Rotating from CT, holds default entrance",
        },

        // ===== LURKER / OFF-ANGLE POSITIONS =====
        {
          id: "b-main",
          name: "B Main",
          position: { x: 0.88, y: 0.55 },
          role: "lurker",
          description: "Holding B Main flank, unexpected angle",
        },
        {
          id: "b-main-alcove",
          name: "B Main Alcove",
          position: { x: 0.86, y: 0.50 },
          role: "offangle",
          description: "In the alcove off B Main, off-angle",
        },
        {
          id: "b-ct",
          name: "CT Spawn",
          position: { x: 0.68, y: 0.60 },
          role: "lurker",
          description: "Holding from CT, deep flank position",
        },
        {
          id: "b-mid-link",
          name: "Mid Link",
          position: { x: 0.55, y: 0.45 },
          role: "lurker",
          description: "Linking Mid to B, unexpected rotate angle",
        },

        // ===== RETAKE POSITIONS (if attackers took site) =====
        {
          id: "b-ct-retake",
          name: "CT Retake",
          position: { x: 0.65, y: 0.58 },
          role: "retake",
          description: "CT-side retake position",
        },
        {
          id: "b-main-retake",
          name: "B Main Retake",
          position: { x: 0.84, y: 0.58 },
          role: "retake",
          description: "B Main-side retake position",
        },
      ],
      attackerRetakePaths: [
        {
          id: "retake-ct",
          name: "From CT",
          position: { x: 0.60, y: 0.65 },
          role: "common",
          description: "Retake entry from CT spawn",
        },
        {
          id: "retake-market",
          name: "Through Market",
          position: { x: 0.58, y: 0.32 },
          role: "common",
          description: "Retake entry through Market",
        },
        {
          id: "retake-bmain",
          name: "Through B Main",
          position: { x: 0.90, y: 0.60 },
          role: "common",
          description: "Retake entry through B Main",
        },
      ],
    },
    {
      siteId: "ascent-a",
      siteName: "A Site",
      plantZone: {
        // A site plant zone — left side of the map
        center: { x: 0.22, y: 0.35 },
        radius: 0.06,
      },
      defenderPositions: [
        // ===== A SITE ANCHOR POSITIONS =====
        {
          id: "a-default",
          name: "Default",
          position: { x: 0.24, y: 0.40 },
          role: "anchor",
          description: "Standard A site anchor",
        },
        {
          id: "a-tower",
          name: "Tower",
          position: { x: 0.18, y: 0.28 },
          role: "anchor",
          description: "In Tower, elevated angle on A site",
        },
        {
          id: "a-catwalk",
          name: "Catwalk",
          position: { x: 0.28, y: 0.30 },
          role: "anchor",
          description: "On Catwalk, holds A Main and site",
        },
        {
          id: "a-heaven",
          name: "Heaven",
          position: { x: 0.20, y: 0.25 },
          role: "anchor",
          description: "Heaven position above A site",
        },
        {
          id: "a-main",
          name: "A Main",
          position: { x: 0.32, y: 0.38 },
          role: "anchor",
          description: "Holding A Main entrance",
        },

        // ===== POST-PLANT POSITIONS =====
        {
          id: "a-tower-post",
          name: "Tower (Post-Plant)",
          position: { x: 0.16, y: 0.26 },
          role: "postplant",
          description: "Deep in Tower, hard to trade",
        },
        {
          id: "a-cat-post",
          name: "Catwalk (Post-Plant)",
          position: { x: 0.26, y: 0.32 },
          role: "postplant",
          description: "On Catwalk, watching A Main",
        },
        {
          id: "a-heaven-post",
          name: "Heaven (Post-Plant)",
          position: { x: 0.18, y: 0.22 },
          role: "postplant",
          description: "In Heaven, crossfire with site",
        },
        {
          id: "a-behind-site",
          name: "Behind Site",
          position: { x: 0.22, y: 0.44 },
          role: "postplant",
          description: "Behind the spike, holds CT rotate",
        },

        // ===== LURKER / OFF-ANGLE =====
        {
          id: "a-mid",
          name: "A Mid",
          position: { x: 0.38, y: 0.48 },
          role: "lurker",
          description: "Holding Mid link to A",
        },
        {
          id: "a-ct",
          name: "CT Spawn",
          position: { x: 0.30, y: 0.58 },
          role: "lurker",
          description: "CT-side flank for A",
        },
        {
          id: "a-main-deep",
          name: "A Main Deep",
          position: { x: 0.38, y: 0.35 },
          role: "offangle",
          description: "Deep in A Main, off-angle",
        },

        // ===== RETAKE POSITIONS =====
        {
          id: "a-ct-retake",
          name: "CT Retake",
          position: { x: 0.28, y: 0.55 },
          role: "retake",
          description: "CT-side A retake",
        },
        {
          id: "a-main-retake",
          name: "A Main Retake",
          position: { x: 0.35, y: 0.42 },
          role: "retake",
          description: "A Main-side retake",
        },
      ],
      attackerRetakePaths: [
        {
          id: "retake-ct",
          name: "From CT",
          position: { x: 0.35, y: 0.65 },
          role: "common",
          description: "Retake entry from CT",
        },
        {
          id: "retake-AMain",
          name: "Through A Main",
          position: { x: 0.40, y: 0.35 },
          role: "common",
          description: "Retake entry through A Main",
        },
      ],
    },
  ],
};

// ========================================
// HAVEN — Position pools
// ========================================

export const HAVEN_POSITIONS: MapPositionPools = {
  mapId: "haven",
  mapName: "Haven",
  sites: [
    {
      siteId: "haven-c",
      siteName: "C Site",
      plantZone: {
        center: { x: 0.78, y: 0.35 },
        radius: 0.06,
      },
      defenderPositions: [
        {
          id: "c-default",
          name: "Default",
          position: { x: 0.76, y: 0.40 },
          role: "anchor",
        },
        {
          id: "c-garage",
          name: "Garage",
          position: { x: 0.82, y: 0.30 },
          role: "anchor",
        },
        {
          id: "c-long",
          name: "C Long",
          position: { x: 0.85, y: 0.45 },
          role: "anchor",
        },
        {
          id: "c-heaven",
          name: "C Heaven",
          position: { x: 0.74, y: 0.25 },
          role: "anchor",
        },
        {
          id: "c-link",
          name: "C Link",
          position: { x: 0.70, y: 0.35 },
          role: "anchor",
        },
        {
          id: "c-garage-post",
          name: "Garage (Post-Plant)",
          position: { x: 0.80, y: 0.28 },
          role: "postplant",
        },
        {
          id: "c-long-post",
          name: "C Long (Post-Plant)",
          position: { x: 0.84, y: 0.42 },
          role: "postplant",
        },
        {
          id: "c-link-post",
          name: "C Link (Post-Plant)",
          position: { x: 0.72, y: 0.38 },
          role: "postplant",
        },
        {
          id: "c-ct",
          name: "CT Spawn",
          position: { x: 0.70, y: 0.55 },
          role: "lurker",
        },
      ],
      attackerRetakePaths: [
        {
          id: "retake-ct",
          name: "From CT",
          position: { x: 0.65, y: 0.60 },
          role: "common",
        },
        {
          id: "retake-clong",
          name: "Through C Long",
          position: { x: 0.88, y: 0.50 },
          role: "common",
        },
      ],
    },
    {
      siteId: "haven-b",
      siteName: "B Site",
      plantZone: {
        center: { x: 0.78, y: 0.65 },
        radius: 0.06,
      },
      defenderPositions: [
        {
          id: "b-default",
          name: "Default",
          position: { x: 0.76, y: 0.62 },
          role: "anchor",
        },
        {
          id: "b-unicorn",
          name: "Unicorn",
          position: { x: 0.72, y: 0.68 },
          role: "anchor",
        },
        {
          id: "b-elsewhere",
          name: "Elsewhere",
          position: { x: 0.80, y: 0.60 },
          role: "anchor",
        },
        {
          id: "b-garage",
          name: "B Garage",
          position: { x: 0.84, y: 0.65 },
          role: "anchor",
        },
        {
          id: "b-mid",
          name: "B Mid",
          position: { x: 0.68, y: 0.55 },
          role: "anchor",
        },
      ],
      attackerRetakePaths: [
        {
          id: "retake-ct",
          name: "From CT",
          position: { x: 0.70, y: 0.72 },
          role: "common",
        },
        {
          id: "retake-mid",
          name: "Through Mid",
          position: { x: 0.65, y: 0.55 },
          role: "common",
        },
      ],
    },
    {
      siteId: "haven-a",
      siteName: "A Site",
      plantZone: {
        center: { x: 0.22, y: 0.35 },
        radius: 0.06,
      },
      defenderPositions: [
        {
          id: "a-default",
          name: "Default",
          position: { x: 0.24, y: 0.38 },
          role: "anchor",
        },
        {
          id: "a-tower",
          name: "Tower",
          position: { x: 0.18, y: 0.28 },
          role: "anchor",
        },
        {
          id: "a-main",
          name: "A Main",
          position: { x: 0.28, y: 0.32 },
          role: "anchor",
        },
        {
          id: "a-heaven",
          name: "A Heaven",
          position: { x: 0.20, y: 0.24 },
          role: "anchor",
        },
        {
          id: "a-link",
          name: "A Link",
          position: { x: 0.30, y: 0.42 },
          role: "anchor",
        },
      ],
      attackerRetakePaths: [
        {
          id: "retake-ct",
          name: "From CT",
          position: { x: 0.30, y: 0.55 },
          role: "common",
        },
        {
          id: "retake-amain",
          name: "Through A Main",
          position: { x: 0.35, y: 0.30 },
          role: "common",
        },
      ],
    },
  ],
};

// ========================================
// Combine all map pools
// ========================================

export const ALL_MAP_POSITIONS: MapPositionPools[] = [
  ASCENT_POSITIONS,
  HAVEN_POSITIONS,
];

/**
 * Get position pool for a specific map and site.
 */
export function getSitePositions(mapId: string, siteId: string): SitePositionPool | undefined {
  const map = ALL_MAP_POSITIONS.find((m) => m.mapId === mapId);
  if (!map) return undefined;
  return map.sites.find((s) => s.siteId === siteId);
}

/**
 * Get random defender positions from a pool.
 * 
 * @param sitePool - The site position pool
 * @param count - How many positions to pick
 * @param roles - Filter to specific roles (default: all roles)
 * @returns Array of randomly selected positions (never duplicates)
 */
export function getRandomDefenderPositions(
  sitePool: SitePositionPool,
  count: number,
  roles?: PositionRole[]
): PositionDef[] {
  let pool = sitePool.defenderPositions;

  if (roles && roles.length > 0) {
    pool = pool.filter((p) => roles.includes(p.role));
  }

  // Shuffle and pick
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get the plant zone center for a site.
 */
export function getPlantZone(mapId: string, siteId: string): { x: number; y: number } | undefined {
  const site = getSitePositions(mapId, siteId);
  return site?.plantZone.center;
}
