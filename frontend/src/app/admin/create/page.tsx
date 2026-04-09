"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Line,
  Text,
  Group,
  Rect,
  Arrow,
} from "react-konva";
import { ALL_AGENTS, getCompUtility, type AgentAbilities } from "@shared/agentAbilities";
import { ALL_MAP_POSITIONS, type MapPositionPools, type SitePositionPool } from "@shared/positionPools";
import { getAgentDisplayName } from "@shared/assets";
import type { Position } from "@shared/types";

// ========================================
// Admin Scenario Creator
// Interactive tool for building retake scenarios
// ========================================

type ToolMode =
  | "select"
  | "place-spike"
  | "place-defender"
  | "place-attacker"
  | "place-hidden"
  | "place-retake-entry";

interface PlacedItem {
  id: string;
  type: "spike" | "defender" | "attacker" | "hidden" | "retake-entry";
  position: Position;
  agentId?: string; // For defenders/attackers
  label?: string;
}

export default function AdminCreatePage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 800 });

  // Map/state
  const [selectedMap, setSelectedMap] = useState<MapPositionPools>(ALL_MAP_POSITIONS[0]);
  const [selectedSite, setSelectedSite] = useState<SitePositionPool>(selectedMap.sites[0]);

  // Tool
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [selectedDefenderAgent, setSelectedDefenderAgent] = useState<string>("cypher");
  const [selectedAttackerAgent, setSelectedAttackerAgent] = useState<string>("sova");

  // Placements
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);

  // Player comp
  const [playerAgents, setPlayerAgents] = useState<string[]>([]);

  // Scenario metadata
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [scenarioDifficulty, setScenarioDifficulty] = useState(2);

  // Export
  const [showJson, setShowJson] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("rr_scenarios") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  // Resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Generate scenario JSON
  const scenarioJson = useMemo(() => {
    const spikeItem = placedItems.find((i) => i.type === "spike");
    const defenders = placedItems.filter((i) => i.type === "defender");
    const hidden = placedItems.filter((i) => i.type === "hidden");
    const retakeEntries = placedItems.filter((i) => i.type === "retake-entry");

    const utility = getCompUtility(playerAgents);

    return {
      name: scenarioName || `${selectedMap.mapName} ${selectedSite.siteName} | ${playerAgents.length}v${defenders.length} Post-Plant`,
      map: selectedMap.mapId,
      minimapImage: `/assets/minimaps/${selectedMap.mapId}.png`,
      spikeSite: spikeItem?.position || selectedSite.plantZone.center,
      friendlyAgents: placedItems
        .filter((i) => i.type === "attacker")
        .map((a, idx) => ({
          id: a.agentId || `attacker-${idx}`,
          displayName: ALL_AGENTS.find((ag) => ag.id === a.agentId)?.displayName || `Attacker ${idx + 1}`,
          position: a.position,
          role: ALL_AGENTS.find((ag) => ag.id === a.agentId)?.role || "duelist",
        })),
      enemyAgents: defenders.map((d, idx) => ({
        id: `enemy-${idx + 1}`,
        position: d.position,
        agent: d.agentId || "unknown",
        isHidden: false,
      })),
      hiddenEnemies: hidden.map((h, idx) => ({
        id: `enemy-hidden-${idx + 1}`,
        position: h.position,
        agent: h.agentId || "unknown",
        isHidden: true,
      })),
      availableAgents: playerAgents,
      availableUtility: utility.map((u) => ({
        type: u.type,
        agentId: u.agentId,
        charges: u.charges,
      })),
      retakeEntries: retakeEntries.map((r) => ({
        position: r.position,
        label: r.label,
      })),
      difficulty: scenarioDifficulty,
      description: scenarioDesc,
    };
  }, [placedItems, playerAgents, selectedMap, selectedSite, scenarioName, scenarioDesc, scenarioDifficulty]);

  // Canvas click handler
  const handleCanvasClick = useCallback(
    (e: any) => {
      if (!stageRef.current || toolMode === "select") return;
      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;

      const mapW = containerSize.width - 64;
      const mapH = containerSize.height - 64;
      const normalizedX = Math.max(0, Math.min(1, (pos.x - 32) / mapW));
      const normalizedY = Math.max(0, Math.min(1, (pos.y - 32) / mapH));

      const position: Position = { x: normalizedX, y: normalizedY };

      if (toolMode === "place-spike") {
        setPlacedItems((prev) => [
          ...prev.filter((i) => i.type !== "spike"),
          { id: "spike", type: "spike", position },
        ]);
        setToolMode("select");
      } else if (toolMode === "place-defender") {
        setPlacedItems((prev) => [
          ...prev,
          {
            id: `defender-${Date.now()}`,
            type: "defender",
            position,
            agentId: selectedDefenderAgent,
          },
        ]);
      } else if (toolMode === "place-attacker") {
        setPlacedItems((prev) => [
          ...prev,
          {
            id: `attacker-${Date.now()}`,
            type: "attacker",
            position,
            agentId: selectedAttackerAgent,
          },
        ]);
      } else if (toolMode === "place-hidden") {
        setPlacedItems((prev) => [
          ...prev,
          {
            id: `hidden-${Date.now()}`,
            type: "hidden",
            position,
            agentId: selectedDefenderAgent,
          },
        ]);
      } else if (toolMode === "place-retake-entry") {
        const label = prompt("Label for this retake entry point (e.g., 'From CT', 'Through Market'):") || "Entry";
        setPlacedItems((prev) => [
          ...prev,
          { id: `retake-${Date.now()}`, type: "retake-entry", position, label },
        ]);
        setToolMode("select");
      }
    },
    [toolMode, selectedDefenderAgent, selectedAttackerAgent, containerSize]
  );

  // Remove item
  const removeItem = (id: string) => {
    setPlacedItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Toggle player agent
  const togglePlayerAgent = (agentId: string) => {
    setPlayerAgents((prev) =>
      prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId]
    );
  };

  // Save scenario
  const saveScenario = async () => {
    const name = scenarioName || `${selectedMap.mapId}-${selectedSite.siteId}-${Date.now()}`;
    const scenario = {
      ...scenarioJson,
      id: name.toLowerCase().replace(/\s+/g, "-"),
      releaseDate: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/scenarios`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario),
        }
      );
      const json = await res.json();

      if (json.success) {
        const updated = [...savedScenarios, scenario];
        setSavedScenarios(updated);
        if (typeof window !== "undefined") {
          localStorage.setItem("rr_scenarios", JSON.stringify(updated));
        }
        alert(`✅ Scenario "${scenario.name}" saved to database!`);
      } else {
        alert(`❌ Failed to save: ${json.error}`);
      }
    } catch (err) {
      // Fallback: save to localStorage only
      const updated = [...savedScenarios, scenario];
      setSavedScenarios(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("rr_scenarios", JSON.stringify(updated));
      }
      alert(`⚠️ Server unreachable — saved locally only (${updated.length} total)`);
    }
  };

  // Export JSON
  const copyJson = () => {
    const text = JSON.stringify(scenarioJson, null, 2);
    navigator.clipboard.writeText(text);
    alert("Scenario JSON copied to clipboard!");
  };

  const MAP_PADDING = 32;

  return (
    <main className="min-h-screen bg-vdark text-vtext">
      {/* Header */}
      <header className="bg-vsurface border-b border-vtext-dim/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-vtext-dim hover:text-vtext text-sm transition-colors"
          >
            ← Back
          </button>
          <h1 className="font-heading text-xl font-semibold text-vr tracking-wide">
            SCENARIO CREATOR
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJson(!showJson)}
            className="px-4 py-2 bg-vsurface hover:bg-vsurface-hover rounded text-sm transition-colors"
          >
            {showJson ? "Hide JSON" : "View JSON"}
          </button>
          <button
            onClick={saveScenario}
            className="px-4 py-2 bg-vr hover:bg-vr/90 rounded text-sm text-white font-medium transition-colors"
          >
            Save Scenario
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-64px)]">
        {/* Left Panel: Map, Agents, Tools */}
        <div className="lg:w-80 bg-vsurface border-r border-vtext-dim/10 overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-6">
            {/* Map Selection */}
            <div>
              <h3 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">Map</h3>
              <select
                value={selectedMap.mapId}
                onChange={(e) => {
                  const map = ALL_MAP_POSITIONS.find((m) => m.mapId === e.target.value)!;
                  setSelectedMap(map);
                  setSelectedSite(map.sites[0]);
                }}
                className="w-full bg-vdark border border-vtext-dim/20 rounded px-3 py-2 text-sm text-vtext"
              >
                {ALL_MAP_POSITIONS.map((m) => (
                  <option key={m.mapId} value={m.mapId}>{m.mapName}</option>
                ))}
              </select>
            </div>

            {/* Site Selection */}
            <div>
              <h3 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">Site</h3>
              <div className="flex gap-2">
                {selectedMap.sites.map((site) => (
                  <button
                    key={site.siteId}
                    onClick={() => setSelectedSite(site)}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${selectedSite.siteId === site.siteId
                      ? "bg-vr text-white"
                      : "bg-vdark text-vtext-dim hover:text-vtext"
                      }`}
                  >
                    {site.siteName}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario Metadata */}
            <div>
              <h3 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">Details</h3>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Scenario name"
                className="w-full bg-vdark border border-vtext-dim/20 rounded px-3 py-2 text-sm text-vtext mb-2"
              />
              <textarea
                value={scenarioDesc}
                onChange={(e) => setScenarioDesc(e.target.value)}
                placeholder="Briefing description"
                rows={2}
                className="w-full bg-vdark border border-vtext-dim/20 rounded px-3 py-2 text-sm text-vtext resize-none"
              />
              <div className="mt-2">
                <label className="text-xs text-vtext-dim">Difficulty: {scenarioDifficulty}/5</label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={scenarioDifficulty}
                  onChange={(e) => setScenarioDifficulty(parseInt(e.target.value))}
                  className="w-full accent-vr"
                />
              </div>
            </div>

            {/* Tools */}
            <div>
              <h3 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">Place on Map</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setToolMode("place-spike")}
                  className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${toolMode === "place-spike" ? "bg-vr text-white" : "bg-vdark text-vtext-dim hover:text-vtext"
                    }`}
                >
                  🔴 Place Spike
                </button>
                <div className="flex gap-2">
                  <select
                    value={selectedDefenderAgent}
                    onChange={(e) => setSelectedDefenderAgent(e.target.value)}
                    className="flex-1 bg-vdark border border-vtext-dim/20 rounded px-2 py-1 text-xs text-vtext"
                  >
                    {ALL_AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>{a.displayName}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setToolMode("place-defender")}
                  className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${toolMode === "place-defender" ? "bg-red-600/80 text-white" : "bg-vdark text-vtext-dim hover:text-vtext"
                    }`}
                >
                  🔴 Place Defender
                </button>
                <button
                  onClick={() => setToolMode("place-hidden")}
                  className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${toolMode === "place-hidden" ? "bg-red-800/80 text-white" : "bg-vdark text-vtext-dim hover:text-vtext"
                    }`}
                >
                  👻 Place Hidden Enemy
                </button>
                <hr className="border-vtext-dim/10 my-2" />
                <div className="flex gap-2">
                  <select
                    value={selectedAttackerAgent}
                    onChange={(e) => setSelectedAttackerAgent(e.target.value)}
                    className="flex-1 bg-vdark border border-vtext-dim/20 rounded px-2 py-1 text-xs text-vtext"
                  >
                    {ALL_AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>{a.displayName}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setToolMode("place-attacker")}
                  className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${toolMode === "place-attacker" ? "bg-blue-600/80 text-white" : "bg-vdark text-vtext-dim hover:text-vtext"
                    }`}
                >
                  🔵 Place Attacker
                </button>
                <button
                  onClick={() => setToolMode("place-retake-entry")}
                  className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${toolMode === "place-retake-entry" ? "bg-green-600/80 text-white" : "bg-vdark text-vtext-dim hover:text-vtext"
                    }`}
                >
                  🟢 Place Retake Entry
                </button>
                <button
                  onClick={() => setToolMode("select")}
                  className={`w-full px-3 py-2 rounded text-sm text-left transition-colors ${toolMode === "select" ? "bg-vsurface-hover text-white" : "bg-vdark text-vtext-dim hover:text-vtext"
                    }`}
                >
                  🖱️ Select / Done Placing
                </button>
              </div>
            </div>

            {/* Placed Items List */}
            {placedItems.length > 0 && (
              <div>
                <h3 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">
                  Placed ({placedItems.length})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {placedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-vdark rounded px-2 py-1 text-xs"
                    >
                      <span className="text-vtext-dim truncate">
                        {item.type === "spike" && "🔴 Spike"}
                        {item.type === "defender" && `🔴 ${item.agentId}`}
                        {item.type === "hidden" && `👻 ${item.agentId} (hidden)`}
                        {item.type === "attacker" && `🔵 ${item.agentId}`}
                        {item.type === "retake-entry" && `🟢 ${item.label}`}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-vr hover:text-vr/80 ml-2 flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Minimap Canvas */}
        <div className="flex-1 relative bg-vdark" ref={containerRef}>
          {/* Tool indicator */}
          {toolMode !== "select" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-vr/90 backdrop-blur-sm text-white px-4 py-2 rounded text-sm font-medium tracking-wide z-10 whitespace-nowrap">
              {toolMode === "place-spike" && "🔴 Click to place spike"}
              {toolMode === "place-defender" && `🔴 Click to place defender (${selectedDefenderAgent})`}
              {toolMode === "place-hidden" && `👻 Click to place hidden enemy (${selectedDefenderAgent})`}
              {toolMode === "place-attacker" && `🔵 Click to place attacker (${selectedAttackerAgent})`}
              {toolMode === "place-retake-entry" && "🟢 Click to place retake entry point"}
            </div>
          )}

          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            onClick={handleCanvasClick}
            onTap={handleCanvasClick}
            className={toolMode !== "select" ? "cursor-crosshair" : "cursor-default"}
          >
            <Layer>
              {/* Map background */}
              <Rect x={0} y={0} width={containerSize.width} height={containerSize.height} fill="#121D28" />
              <Rect
                x={MAP_PADDING}
                y={MAP_PADDING}
                width={containerSize.width - MAP_PADDING * 2}
                height={containerSize.height - MAP_PADDING * 2}
                fill="#0A1118"
              />

              {/* Grid */}
              {Array.from({ length: 9 }).map((_, i) => {
                const x = MAP_PADDING + ((i + 1) / 10) * (containerSize.width - MAP_PADDING * 2);
                return (
                  <Line
                    key={`vg-${i}`}
                    points={[x, MAP_PADDING, x, containerSize.height - MAP_PADDING]}
                    stroke="rgba(42, 58, 74, 0.2)"
                    strokeWidth={0.5}
                  />
                );
              })}
              {Array.from({ length: 9 }).map((_, i) => {
                const y = MAP_PADDING + ((i + 1) / 10) * (containerSize.height - MAP_PADDING * 2);
                return (
                  <Line
                    key={`hg-${i}`}
                    points={[MAP_PADDING, y, containerSize.width - MAP_PADDING, y]}
                    stroke="rgba(42, 58, 74, 0.2)"
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* Plant zone indicator */}
              <Circle
                x={MAP_PADDING + selectedSite.plantZone.center.x * (containerSize.width - MAP_PADDING * 2)}
                y={MAP_PADDING + selectedSite.plantZone.center.y * (containerSize.height - MAP_PADDING * 2)}
                radius={selectedSite.plantZone.radius * (containerSize.width - MAP_PADDING * 2)}
                fill="rgba(29, 245, 160, 0.08)"
                stroke="rgba(29, 245, 160, 0.3)"
                strokeWidth={1}
                dash={[4, 4]}
              />

              {/* Position pool reference dots */}
              {selectedSite.defenderPositions.map((pos) => (
                <Circle
                  key={`ref-${pos.id}`}
                  x={MAP_PADDING + pos.position.x * (containerSize.width - MAP_PADDING * 2)}
                  y={MAP_PADDING + pos.position.y * (containerSize.height - MAP_PADDING * 2)}
                  radius={3}
                  fill="rgba(107, 125, 142, 0.2)"
                />
              ))}
            </Layer>

            {/* Placements layer */}
            <Layer>
              {/* Spike */}
              {placedItems.find((i) => i.type === "spike") && (
                <Group>
                  <Circle
                    x={MAP_PADDING + placedItems.find((i) => i.type === "spike")!.position.x * (containerSize.width - MAP_PADDING * 2)}
                    y={MAP_PADDING + placedItems.find((i) => i.type === "spike")!.position.y * (containerSize.height - MAP_PADDING * 2)}
                    radius={14}
                    fill="rgba(255, 70, 85, 0.15)"
                    stroke="#FF4655"
                    strokeWidth={2}
                    dash={[3, 3]}
                  />
                  <Text
                    x={MAP_PADDING + placedItems.find((i) => i.type === "spike")!.position.x * (containerSize.width - MAP_PADDING * 2) - 8}
                    y={MAP_PADDING + placedItems.find((i) => i.type === "spike")!.position.y * (containerSize.height - MAP_PADDING * 2) - 18}
                    text="SPIKE"
                    fontSize={9}
                    fill="#FF4655"
                    fontFamily="Oswald, sans-serif"
                    letterSpacing={1}
                  />
                </Group>
              )}

              {/* Defenders */}
              {placedItems
                .filter((i) => i.type === "defender")
                .map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2)}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2)}
                      radius={12}
                      fill="rgba(255, 70, 85, 0.25)"
                      stroke="#FF4655"
                      strokeWidth={2}
                    />
                    <Text
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2) - 5}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2) - 6}
                      text={(item.agentId || "?")[0].toUpperCase()}
                      fontSize={10}
                      fill="#FF4655"
                      fontFamily="Oswald, sans-serif"
                      fontStyle="bold"
                    />
                  </Group>
                ))}

              {/* Hidden enemies */}
              {placedItems
                .filter((i) => i.type === "hidden")
                .map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2)}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2)}
                      radius={10}
                      fill="rgba(255, 70, 85, 0.15)"
                      stroke="#FF4655"
                      strokeWidth={1.5}
                      dash={[3, 3]}
                    />
                    <Text
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2) - 4}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2) - 5}
                      text="?"
                      fontSize={10}
                      fill="#FF465580"
                      fontFamily="Oswald, sans-serif"
                      fontStyle="bold"
                    />
                  </Group>
                ))}

              {/* Attackers (player team starting positions) */}
              {placedItems
                .filter((i) => i.type === "attacker")
                .map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2)}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2)}
                      radius={12}
                      fill="rgba(91, 206, 250, 0.25)"
                      stroke="#5BCEFA"
                      strokeWidth={2}
                    />
                    <Text
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2) - 5}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2) - 6}
                      text={(item.agentId || "?")[0].toUpperCase()}
                      fontSize={10}
                      fill="#5BCEFA"
                      fontFamily="Oswald, sans-serif"
                      fontStyle="bold"
                    />
                  </Group>
                ))}

              {/* Retake entry points */}
              {placedItems
                .filter((i) => i.type === "retake-entry")
                .map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2)}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2)}
                      radius={8}
                      fill="rgba(29, 245, 160, 0.15)"
                      stroke="#1DF5A0"
                      strokeWidth={1.5}
                    />
                    <Text
                      x={MAP_PADDING + item.position.x * (containerSize.width - MAP_PADDING * 2) - 15}
                      y={MAP_PADDING + item.position.y * (containerSize.height - MAP_PADDING * 2) + 16}
                      text={item.label || ""}
                      fontSize={8}
                      fill="#1DF5A0"
                      fontFamily="Inter, sans-serif"
                    />
                  </Group>
                ))}
            </Layer>
          </Stage>
        </div>

        {/* Right Panel: Player Comp */}
        <div className="lg:w-72 bg-vsurface border-l border-vtext-dim/10 overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            <h3 className="font-heading text-xs text-vtext-dim uppercase tracking-wider">Player Comp</h3>
            <p className="text-xs text-vtext-dim">Select 3-5 agents for the retake team:</p>

            <div className="grid grid-cols-4 gap-2">
              {ALL_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => togglePlayerAgent(agent.id)}
                  className={`relative w-full aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${playerAgents.includes(agent.id)
                    ? "border-vr bg-vr/10"
                    : "border-vtext-dim/20 bg-vdark hover:border-vtext-dim/40"
                    }`}
                >
                  <img
                    src={`/assets/agents/${getAgentDisplayName(agent.id)}_icon.webp`}
                    alt={agent.displayName}
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[7px] text-vtext-dim whitespace-nowrap">
                    {agent.displayName.slice(0, 4)}
                  </span>
                </button>
              ))}
            </div>

            {playerAgents.length > 0 && (
              <div>
                <h4 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">
                  Available Utility ({playerAgents.length} agent{playerAgents.length > 1 ? "s" : ""})
                </h4>
                <div className="space-y-2">
                  {playerAgents.map((agentId) => {
                    const agent = ALL_AGENTS.find((a) => a.id === agentId);
                    if (!agent) return null;
                    const utility = agent.abilities.filter((a) => !a.isUltimate);
                    return (
                      <div key={agentId} className="bg-vdark rounded p-2">
                        <p className="text-xs text-vtext font-medium mb-1">{agent.displayName}</p>
                        <div className="flex flex-wrap gap-1">
                          {utility.map((u) => (
                            <span
                              key={u.slot}
                              className="text-[10px] bg-vsurface px-1.5 py-0.5 rounded text-vtext-dim"
                            >
                              {u.slot}: {u.name} (×{u.charges})
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="pt-4 border-t border-vtext-dim/10 space-y-2">
              <button
                onClick={() => setPlacedItems([])}
                className="w-full px-3 py-2 bg-vdark hover:bg-vsurface-hover rounded text-xs text-vtext-dim transition-colors"
              >
                Clear All Placements
              </button>
              <button
                onClick={copyJson}
                className="w-full px-3 py-2 bg-vsurface hover:bg-vsurface-hover rounded text-xs text-vtext transition-colors"
              >
                Copy JSON to Clipboard
              </button>
            </div>

            {/* Saved scenarios */}
            {savedScenarios.length > 0 && (
              <div className="pt-4 border-t border-vtext-dim/10">
                <h4 className="font-heading text-xs text-vtext-dim uppercase tracking-wider mb-2">
                  Saved ({savedScenarios.length})
                </h4>
                <div className="space-y-1">
                  {savedScenarios.map((s, i) => (
                    <div key={i} className="bg-vdark rounded px-2 py-1 text-xs text-vtext-dim truncate">
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JSON Preview Modal */}
      {showJson && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-vsurface rounded-xl p-6 max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-vtext">Scenario JSON</h2>
              <button
                onClick={() => setShowJson(false)}
                className="text-vtext-dim hover:text-vtext"
              >
                ✕
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-vdark rounded p-4 text-xs text-vtext-dim font-mono whitespace-pre-wrap">
              {JSON.stringify(scenarioJson, null, 2)}
            </pre>
            <div className="flex gap-2 mt-4">
              <button
                onClick={copyJson}
                className="flex-1 py-2 bg-vr hover:bg-vr/90 rounded text-sm text-white font-medium"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowJson(false)}
                className="flex-1 py-2 bg-vsurface hover:bg-vsurface-hover rounded text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
