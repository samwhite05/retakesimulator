import type { GridMap, Scenario } from "@/types";
import author from "./ascent-b-3v2-author.json";

type AuthorExport = {
  scenarioId: string;
  authoritativeGrid: boolean;
  grid: GridMap;
  plantableArea?: { x: number; y: number; width: number; height: number };
  spawnZones?: { x: number; y: number; width: number; height: number }[];
  camera?: { center: { x: number; y: number }; zoom: number };
};

const authorData = author as AuthorExport;

export const ascentB3v2: Scenario = {
  id: "ascent-b-3v2",
  name: "Ascent B-Site | 3v2 Post-Plant",
  map: "ascent",
  minimapImage: "/assets/minimaps/ascent.png",
  spikeSite: { x: 0.3125, y: 0.8125 },
  camera: authorData.camera ?? { center: { x: 0.3125, y: 0.8125 }, zoom: 1.4 },
  spawnZones: authorData.spawnZones,
  plantableArea: authorData.plantableArea,
  authoritativeGrid: true,
  grid: authorData.grid,
  friendlyAgents: [
    { id: "attacker-1", agentId: "sova", position: { x: 0.125, y: 0.125 } },
    { id: "attacker-2", agentId: "omen", position: { x: 0.0625, y: 0.25 } },
    { id: "attacker-3", agentId: "jett", position: { x: 0.1875, y: 0.1875 } },
  ],
  enemyAgents: [
    { id: "defender-1", agentId: "cypher", position: { x: 0.2708, y: 0.8958 }, weapon: "phantom" },
    {
      id: "defender-2",
      agentId: "killjoy",
      position: { x: 0.3958, y: 0.6458 },
      lookAt: { x: 0.175, y: 0.69 },
      weapon: "vandal",
    },
  ],
  hiddenEnemies: [
    { id: "lurker-1", agentId: "raze", position: { x: 0.375, y: 0.625 }, weapon: "sheriff", isHidden: true, offAngle: true },
  ],
  availableAgents: ["sova", "omen", "jett"],
  planningRoster: [
    { agentId: "sova", eliminated: false },
    { agentId: "omen", eliminated: false },
    { agentId: "jett", eliminated: false },
    { agentId: "reyna", eliminated: true },
    { agentId: "sage", eliminated: true },
  ],
  /** Mid-round retake: depleted kit (no full charges). */
  availableUtility: [
    { type: "smoke", agentId: "omen", charges: 1 },
    { type: "flash", agentId: "omen", charges: 1 },
    { type: "dash", agentId: "omen", charges: 1 },
    { type: "dart", agentId: "sova", charges: 1 },
    { type: "mollie", agentId: "sova", charges: 1 },
    { type: "updraft", agentId: "jett", charges: 1 },
    { type: "dash", agentId: "jett", charges: 1 },
    { type: "smoke", agentId: "jett", charges: 1 },
  ],
  rules: [
    {
      id: "spike_defused",
      description: "Defuse the spike (clear site or uncontested tap)",
      category: "critical",
      points: 40,
    },
    { id: "minimize_casualties", description: "Keep your team alive", category: "important", points: 25 },
    {
      id: "clear_defenders",
      description: "Win gunfights — pick defenders where you can",
      category: "important",
      points: 20,
    },
    { id: "utility_efficiency", description: "Use utility effectively", category: "minor", points: 15 },
  ],
};

ascentB3v2.availableUtility = ascentB3v2.availableUtility.filter((u) => !(u.agentId === "sova" && u.type === "smoke"));
