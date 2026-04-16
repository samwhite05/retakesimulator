import { Scenario } from "@/types";
import { ascentB3v2 } from "@/scenarios/ascent-b-3v2";
import { prisma } from "./db";

const ALL_SCENARIOS: Scenario[] = [ascentB3v2];

export function getAllScenarios(): Scenario[] {
  return ALL_SCENARIOS;
}

export function getScenarioForDate(date: Date): Scenario | null {
  const dateStr = date.toISOString().split("T")[0];
  // Use the scenario whose releaseDate matches today, or cycle through available scenarios
  const sorted = [...ALL_SCENARIOS].sort((a, b) => {
    const da = a.releaseDate ? new Date(a.releaseDate).toISOString() : "9999";
    const db = b.releaseDate ? new Date(b.releaseDate).toISOString() : "9999";
    return da.localeCompare(db);
  });

  const directMatch = sorted.find((s) => s.releaseDate === dateStr);
  if (directMatch) return directMatch;

  // Cycle based on days since first scenario
  if (sorted.length === 0) return null;
  const first = sorted[0];
  const firstDate = first.releaseDate ? new Date(first.releaseDate) : new Date("2024-01-01");
  const dayDiff = Math.floor((date.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const index = Math.abs(dayDiff) % sorted.length;
  return sorted[index];
}

export async function seedScenarios() {
  for (const scenario of ALL_SCENARIOS) {
    const releaseDate = scenario.releaseDate || new Date().toISOString().split("T")[0];
    await prisma.scenario.upsert({
      where: { id: scenario.id },
      update: {
        name: scenario.name,
        map: scenario.map,
        config: JSON.stringify(scenario),
        releaseDate: new Date(releaseDate),
      },
      create: {
        id: scenario.id,
        name: scenario.name,
        map: scenario.map,
        config: JSON.stringify(scenario),
        releaseDate: new Date(releaseDate),
      },
    });
  }
}
