import path from "path";
import type { GridMap, Scenario } from "@/types";
import { generateGridFromMinimap } from "@/lib/gridgen";

export function deepCloneGridMap(grid: GridMap): GridMap {
  return {
    mapId: grid.mapId,
    cols: grid.cols,
    rows: grid.rows,
    tiles: grid.tiles.map((row) => row.map((t) => ({ ...t }))),
  };
}

/**
 * Builds the tactical grid for a scenario: either the committed author grid or minimap-derived.
 * Does not mutate the passed scenario.
 */
export async function resolveScenarioGrid(scenario: Scenario): Promise<GridMap> {
  if (scenario.authoritativeGrid) {
    return deepCloneGridMap(scenario.grid);
  }

  const imagePath = path.join(process.cwd(), "public", scenario.minimapImage);
  const grid = await generateGridFromMinimap(imagePath, scenario.map);
  const tiles = grid.tiles.map((row) => row.map((t) => ({ ...t })));
  scenario.applyGridOverrides?.(tiles);
  return { ...grid, tiles };
}
