import type { Scenario } from "@shared/types";
import { ascentB3v2 } from "./ascent-b-3v2";

// Re-export for direct access
export { ascentB3v2 };

export const allScenarios: Scenario[] = [ascentB3v2];

/**
 * Gets the scenario for a given date.
 * Cycles through scenarios if more days have passed than scenarios available.
 */
export function getScenarioForDate(date: Date = new Date()): Scenario | undefined {
  const today = date.toISOString().split("T")[0];
  return allScenarios.find((s) => s.releaseDate === today);
}

/**
 * Gets all available scenarios (for admin/seeding purposes).
 */
export function getAllScenarios(): Scenario[] {
  return allScenarios;
}
