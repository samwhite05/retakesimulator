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
} from "react-konva";
import { ALL_AGENTS, getCompUtility, type AgentAbilities, type AbilityDef } from "@shared/agentAbilities";
import { ALL_MAP_POSITIONS, type MapPositionPools, type SitePositionPool, type PositionDef } from "@shared/positionPools";
import { getAgentIconUrl, getAbilityIconUrl, getAgentDisplayName } from "@shared/assets";
import type { Position } from "@shared/types";

// ========================================
// Admin Scenario Creator — Redesigned
// ========================================

type ToolMode =
  | "select"
  | "place-spike"
  | "place-defender"
  | "place-attacker"
  | "place-hidden"
  | "place-retake-entry"
  | "place-attacker-spawn";

interface PlacedItem {
  id: string;
  type: "spike" | "defender" | "attacker" | "hidden" | "retake-entry" | "attacker-spawn";
  position: Position;
  agentId?: string;
  label?: string;
}

export default function AdminCreatePage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 800 });

  // Map selection
  const [selectedMap, setSelectedMap] = useState<MapPositionPools>(ALL_MAP_POSITIONS[0]);
  const [selectedSite, setSelectedSite] = useState<SitePositionPool>(selectedMap.sites[0]);

  // Tool state
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [selectedDefenderAgent, setSelectedDefenderAgent] = useState<string>("cypher");

  // Placements
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);

  // Player comp (attacking team)
  const [playerAgents, setPlayerAgents] = useState<string[]>([]);

  // Scenario metadata
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [scenarioDifficulty, setScenarioDifficulty] = useState(2);

  // Saved scenarios
  const [savedScenarios, setSavedScenarios] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("rr_scenarios") || "[]");
      } catch { return []; }
    }
    return [];
  });

  // Resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: Math.max(rect.height, 500) });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Load saved scenarios from DB on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/scenarios`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data.length > 0) {
          setSavedScenarios(json.data.map((s: any) => s.config));
        }
      })
      .catch(() => { });
  }, []);

  const MAP_PADDING = 32;

  // Generate scenario JSON
  const scenarioJson = useMemo(() => {
    const spikeItem = placedItems.find((i) => i.type === "spike");
    const defenders = placedItems.filter((i) => i.type === "defender");
    const hidden = placedItems.filter((i) => i.type === "hidden");
    const attackerSpawns = placedItems.filter((i) => i.type === "attacker-spawn");
    const retakeEntries = placedItems.filter((i) => i.type === "retake-entry");

    const utility = getCompUtility(playerAgents);

    // Use attacker-spawn positions for friendly agents, fallback to retake entries
    const spawnPositions = attackerSpawns.length > 0 ? attackerSpawns : retakeEntries;

    return {
      name: scenarioName || `${selectedMap.mapName} ${selectedSite.siteName} | ${playerAgents.length}v${defenders.length} Post-Plant`,
      map: selectedMap.mapId,
      minimapImage: `/assets/minimaps/${selectedMap.mapId}.png`,
      spikeSite: spikeItem?.position || selectedSite.plantZone.center,
      friendlyAgents: playerAgents.map((id, idx) => {
        const agent = ALL_AGENTS.find((a) => a.id === id);
        const spawnPos = spawnPositions[idx]?.position || { x: 0.5, y: 0.8 };
        return {
          id,
          displayName: agent?.displayName || `Agent ${idx + 1}`,
          position: spawnPos,
          role: agent?.role || "duelist",
        };
      }),
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

      const mapW = containerSize.width - MAP_PADDING * 2;
      const mapH = containerSize.height - MAP_PADDING * 2;
      const normalizedX = Math.max(0, Math.min(1, (pos.x - MAP_PADDING) / mapW));
      const normalizedY = Math.max(0, Math.min(1, (pos.y - MAP_PADDING) / mapH));

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
          { id: `defender-${Date.now()}`, type: "defender", position, agentId: selectedDefenderAgent },
        ]);
      } else if (toolMode === "place-hidden") {
        setPlacedItems((prev) => [
          ...prev,
          { id: `hidden-${Date.now()}`, type: "hidden", position, agentId: selectedDefenderAgent },
        ]);
      } else if (toolMode === "place-attacker-spawn") {
        if (playerAgents.length === 0) {
          alert("Add agents to your comp first (right panel)");
          return;
        }
        const idx = placedItems.filter((i) => i.type === "attacker-spawn").length;
        if (idx >= playerAgents.length) {
          alert(`You already placed spawns for all ${playerAgents.length} agents`);
          return;
        }
        setPlacedItems((prev) => [
          ...prev,
          {
            id: `attacker-spawn-${Date.now()}`,
            type: "attacker-spawn",
            position,
            agentId: playerAgents[idx],
          },
        ]);
      } else if (toolMode === "place-retake-entry") {
        const label = prompt("Label (e.g., 'From CT', 'Through Market'):") || "Entry";
        setPlacedItems((prev) => [
          ...prev,
          { id: `retake-${Date.now()}`, type: "retake-entry", position, label },
        ]);
        setToolMode("select");
      }
    },
    [toolMode, selectedDefenderAgent, playerAgents, placedItems, containerSize]
  );

  const removeItem = (id: string) => {
    setPlacedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const togglePlayerAgent = (agentId: string) => {
    setPlayerAgents((prev) =>
      prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId]
    );
  };

  const saveScenario = async () => {
    const scenario = {
      ...scenarioJson,
      id: (scenarioName || `scenario-${Date.now()}`).toLowerCase().replace(/\s+/g, "-"),
      releaseDate: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/scenarios`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scenario) }
      );
      const json = await res.json();
      if (json.success) {
        const updated = [...savedScenarios, scenario];
        setSavedScenarios(updated);
        localStorage.setItem("rr_scenarios", JSON.stringify(updated));
        alert(`✅ "${scenario.name}" saved to database!`);
      } else {
        alert(`❌ ${json.error}`);
      }
    } catch {
      const updated = [...savedScenarios, scenario];
      setSavedScenarios(updated);
      localStorage.setItem("rr_scenarios", JSON.stringify(updated));
      alert(`⚠️ Server down — saved locally`);
    }
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(scenarioJson, null, 2));
    alert("Copied!");
  };

  const toCanvas = (pos: Position) => ({
    x: MAP_PADDING + pos.x * (containerSize.width - MAP_PADDING * 2),
    y: MAP_PADDING + pos.y * (containerSize.height - MAP_PADDING * 2),
  });

  return (
    <main className="min-h-screen bg-vdark text-vtext flex flex-col">
      {/* Header */}
      <header className="bg-vsurface/80 backdrop-blur-sm border-b border-vtext-dim/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="text-vtext-dim hover:text-vtext text-sm">← Back</button>
          <h1 className="font-heading text-lg text-vr tracking-wide">SCENARIO CREATOR</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const w = window.open("", "_blank");
            if (w) { w.document.write(`<pre style="background:#0F1923;color:#ECE8E1;padding:20px;white-space:pre-wrap;">${JSON.stringify(scenarioJson, null, 2)}</pre>`); }
          }} className="px-3 py-1.5 bg-vsurface hover:bg-vsurface-hover rounded text-xs">Preview</button>
          <button onClick={copyJson} className="px-3 py-1.5 bg-vsurface hover:bg-vsurface-hover rounded text-xs">Copy JSON</button>
          <button onClick={saveScenario} className="px-4 py-1.5 bg-vr hover:bg-vr/90 rounded text-xs text-white font-medium">Save</button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Map + Canvas */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Map/Site selectors */}
          <div className="px-4 py-3 border-b border-vtext-dim/10 flex-shrink-0 flex flex-wrap gap-3">
            <div>
              <label className="text-[10px] text-vtext-dim uppercase tracking-wider block mb-1">Map</label>
              <select
                value={selectedMap.mapId}
                onChange={(e) => {
                  const map = ALL_MAP_POSITIONS.find((m) => m.mapId === e.target.value)!;
                  setSelectedMap(map);
                  setSelectedSite(map.sites[0]);
                }}
                className="bg-vdark border border-vtext-dim/20 rounded px-2 py-1 text-sm text-vtext"
              >
                {ALL_MAP_POSITIONS.map((m) => (
                  <option key={m.mapId} value={m.mapId}>{m.mapName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-vtext-dim uppercase tracking-wider block mb-1">Site</label>
              <div className="flex gap-1">
                {selectedMap.sites.map((site) => (
                  <button
                    key={site.siteId}
                    onClick={() => setSelectedSite(site)}
                    className={`px-3 py-1 rounded text-xs font-medium ${selectedSite.siteId === site.siteId ? "bg-vr text-white" : "bg-vdark text-vtext-dim"
                      }`}
                  >
                    {site.siteName}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-vtext-dim uppercase tracking-wider block mb-1">Scenario Name</label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full bg-vdark border border-vtext-dim/20 rounded px-2 py-1 text-sm text-vtext"
              />
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-vdark min-h-[400px]" ref={containerRef}>
            {toolMode !== "select" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-vr/90 backdrop-blur-sm text-white px-4 py-2 rounded text-xs font-medium z-10 whitespace-nowrap">
                {toolMode === "place-spike" && "🔴 Click to place spike"}
                {toolMode === "place-defender" && `🔴 Click to place defender (${selectedDefenderAgent})`}
                {toolMode === "place-hidden" && `👻 Click to place hidden (${selectedDefenderAgent})`}
                {toolMode === "place-attacker-spawn" && `🔵 Place spawn for ${playerAgents[placedItems.filter(i => i.type === "attacker-spawn").length] || "..."}`}
                {toolMode === "place-retake-entry" && "🟢 Click to place retake entry"}
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
                <Rect x={0} y={0} width={containerSize.width} height={containerSize.height} fill="#121D28" />
                <Rect x={MAP_PADDING} y={MAP_PADDING} width={containerSize.width - MAP_PADDING * 2} height={containerSize.height - MAP_PADDING * 2} fill="#0A1118" />

                {/* Grid */}
                {Array.from({ length: 9 }).map((_, i) => {
                  const x = MAP_PADDING + ((i + 1) / 10) * (containerSize.width - MAP_PADDING * 2);
                  return <Line key={`vg-${i}`} points={[x, MAP_PADDING, x, containerSize.height - MAP_PADDING]} stroke="rgba(42,58,74,0.15)" strokeWidth={0.5} />;
                })}
                {Array.from({ length: 9 }).map((_, i) => {
                  const y = MAP_PADDING + ((i + 1) / 10) * (containerSize.height - MAP_PADDING * 2);
                  return <Line key={`hg-${i}`} points={[MAP_PADDING, y, containerSize.width - MAP_PADDING, y]} stroke="rgba(42,58,74,0.15)" strokeWidth={0.5} />;
                })}

                {/* Plant zone */}
                <Circle
                  x={MAP_PADDING + selectedSite.plantZone.center.x * (containerSize.width - MAP_PADDING * 2)}
                  y={MAP_PADDING + selectedSite.plantZone.center.y * (containerSize.height - MAP_PADDING * 2)}
                  radius={selectedSite.plantZone.radius * (containerSize.width - MAP_PADDING * 2)}
                  fill="rgba(29,245,160,0.06)"
                  stroke="rgba(29,245,160,0.25)"
                  strokeWidth={1}
                  dash={[4, 4]}
                />

                {/* Minimap image */}
                <MinimapImageRenderer
                  mapId={selectedMap.mapId}
                  x={MAP_PADDING}
                  y={MAP_PADDING}
                  width={containerSize.width - MAP_PADDING * 2}
                  height={containerSize.height - MAP_PADDING * 2}
                />

                {/* Position pool reference dots */}
                {selectedSite.defenderPositions.slice(0, 15).map((pos) => (
                  <Circle
                    key={`ref-${pos.id}`}
                    x={MAP_PADDING + pos.position.x * (containerSize.width - MAP_PADDING * 2)}
                    y={MAP_PADDING + pos.position.y * (containerSize.height - MAP_PADDING * 2)}
                    radius={2}
                    fill="rgba(107,125,142,0.15)"
                  />
                ))}
              </Layer>

              {/* Placements layer */}
              <Layer>
                {/* Spike */}
                {placedItems.find((i) => i.type === "spike") && (
                  <Group>
                    <Circle
                      x={toCanvas(placedItems.find((i) => i.type === "spike")!.position).x}
                      y={toCanvas(placedItems.find((i) => i.type === "spike")!.position).y}
                      radius={14}
                      fill="rgba(255,70,85,0.1)"
                      stroke="#FF4655"
                      strokeWidth={2}
                      dash={[3, 3]}
                    />
                    <Text
                      x={toCanvas(placedItems.find((i) => i.type === "spike")!.position).x - 12}
                      y={toCanvas(placedItems.find((i) => i.type === "spike")!.position).y - 18}
                      text="SPIKE"
                      fontSize={9}
                      fill="#FF4655"
                      fontFamily="Oswald, sans-serif"
                      letterSpacing={1}
                    />
                  </Group>
                )}

                {/* Defenders */}
                {placedItems.filter((i) => i.type === "defender").map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={12}
                      fill="rgba(255,70,85,0.2)"
                      stroke="#FF4655"
                      strokeWidth={2}
                    />
                    <AgentFaceBubble
                      agentId={item.agentId || "unknown"}
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={10}
                    />
                  </Group>
                ))}

                {/* Hidden enemies */}
                {placedItems.filter((i) => i.type === "hidden").map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={10}
                      fill="rgba(255,70,85,0.1)"
                      stroke="#FF4655"
                      strokeWidth={1.5}
                      dash={[3, 3]}
                    />
                    <Text
                      x={toCanvas(item.position).x - 4}
                      y={toCanvas(item.position).y - 5}
                      text="?"
                      fontSize={10}
                      fill="rgba(255,70,85,0.5)"
                      fontFamily="Oswald, sans-serif"
                      fontStyle="bold"
                    />
                  </Group>
                ))}

                {/* Attacker spawns (player team starting positions) */}
                {placedItems.filter((i) => i.type === "attacker-spawn").map((item, idx) => (
                  <Group key={item.id}>
                    <Circle
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={14}
                      fill="rgba(91,206,250,0.1)"
                      stroke="#5BCEFA"
                      strokeWidth={2}
                      dash={[3, 3]}
                    />
                    <AgentFaceBubble
                      agentId={item.agentId || "unknown"}
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={11}
                    />
                    <Text
                      x={toCanvas(item.position).x - 5}
                      y={toCanvas(item.position).y + 20}
                      text={`P${idx + 1}`}
                      fontSize={8}
                      fill="#5BCEFA"
                      fontFamily="Oswald, sans-serif"
                    />
                  </Group>
                ))}

                {/* Retake entry points */}
                {placedItems.filter((i) => i.type === "retake-entry").map((item) => (
                  <Group key={item.id}>
                    <Circle
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={8}
                      fill="rgba(29,245,160,0.1)"
                      stroke="#1DF5A0"
                      strokeWidth={1.5}
                    />
                    <Text
                      x={toCanvas(item.position).x - 15}
                      y={toCanvas(item.position).y + 16}
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

          {/* Tool buttons bar */}
          <div className="px-4 py-2 border-t border-vtext-dim/10 flex-shrink-0 flex flex-wrap gap-1.5">
            <button onClick={() => setToolMode("place-spike")} className={`px-2.5 py-1.5 rounded text-xs font-medium ${toolMode === "place-spike" ? "bg-vr text-white" : "bg-vdark text-vtext-dim"}`}>🔴 Spike</button>
            <select value={selectedDefenderAgent} onChange={(e) => setSelectedDefenderAgent(e.target.value)} className="bg-vdark border border-vtext-dim/20 rounded px-1.5 py-1 text-xs text-vtext">
              {ALL_AGENTS.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
            </select>
            <button onClick={() => setToolMode("place-defender")} className={`px-2.5 py-1.5 rounded text-xs font-medium ${toolMode === "place-defender" ? "bg-red-600/80 text-white" : "bg-vdark text-vtext-dim"}`}>🔴 Defender</button>
            <button onClick={() => setToolMode("place-hidden")} className={`px-2.5 py-1.5 rounded text-xs font-medium ${toolMode === "place-hidden" ? "bg-red-800/80 text-white" : "bg-vdark text-vtext-dim"}`}>👻 Hidden</button>
            <button onClick={() => setToolMode("place-attacker-spawn")} className={`px-2.5 py-1.5 rounded text-xs font-medium ${toolMode === "place-attacker-spawn" ? "bg-blue-600/80 text-white" : "bg-vdark text-vtext-dim"}`}>🔵 Spawn</button>
            <button onClick={() => setToolMode("place-retake-entry")} className={`px-2.5 py-1.5 rounded text-xs font-medium ${toolMode === "place-retake-entry" ? "bg-green-600/80 text-white" : "bg-vdark text-vtext-dim"}`}>🟢 Entry</button>
            <button onClick={() => setToolMode("select")} className={`px-2.5 py-1.5 rounded text-xs font-medium ${toolMode === "select" ? "bg-vsurface-hover text-white" : "bg-vdark text-vtext-dim"}`}>🖱️ Done</button>
            <button onClick={() => setPlacedItems([])} className="px-2.5 py-1.5 rounded text-xs text-vr ml-auto">Clear All</button>
          </div>
        </div>

        {/* Right: Player Comp + Details */}
        <div className="lg:w-80 bg-vsurface/50 border-t lg:border-t-0 lg:border-l border-vtext-dim/10 overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            {/* Scenario details */}
            <div>
              <h3 className="font-heading text-[10px] text-vtext-dim uppercase tracking-wider mb-2">Details</h3>
              <textarea
                value={scenarioDesc}
                onChange={(e) => setScenarioDesc(e.target.value)}
                placeholder="Briefing description"
                rows={2}
                className="w-full bg-vdark border border-vtext-dim/20 rounded px-2 py-1.5 text-xs text-vtext resize-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-vtext-dim">Difficulty:</label>
                <input type="range" min={1} max={5} value={scenarioDifficulty} onChange={(e) => setScenarioDifficulty(parseInt(e.target.value))} className="flex-1 accent-vr" />
                <span className="text-xs text-vtext font-mono">{scenarioDifficulty}</span>
              </div>
            </div>

            {/* Player Comp */}
            <div>
              <h3 className="font-heading text-[10px] text-vtext-dim uppercase tracking-wider mb-2">
                Player Comp ({playerAgents.length}/5)
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {ALL_AGENTS.map((agent) => {
                  const isSelected = playerAgents.includes(agent.id);
                  const displayName = getAgentDisplayName(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => togglePlayerAgent(agent.id)}
                      className={`relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all ${isSelected ? "border-vr bg-vr/10" : "border-vtext-dim/10 bg-vdark hover:border-vtext-dim/30"
                        }`}
                    >
                      <div className="w-7 h-7 rounded-full overflow-hidden mb-0.5">
                        <img
                          src={`/assets/agents/${displayName}_icon.webp`}
                          alt={agent.displayName}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      <span className="text-[7px] text-vtext-dim leading-none">{agent.displayName.slice(0, 5)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Utility preview for comp */}
            {playerAgents.length > 0 && (
              <div>
                <h3 className="font-heading text-[10px] text-vtext-dim uppercase tracking-wider mb-2">Available Utility</h3>
                <div className="space-y-2">
                  {playerAgents.map((agentId) => {
                    const agent = ALL_AGENTS.find((a) => a.id === agentId);
                    if (!agent) return null;
                    const utility = agent.abilities.filter((a) => !a.isUltimate);
                    return (
                      <div key={agentId} className="bg-vdark rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-vtext-dim/5">
                          <div className="w-5 h-5 rounded-full overflow-hidden">
                            <img
                              src={`/assets/agents/${getAgentDisplayName(agentId)}_icon.webp`}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                          <span className="text-xs text-vtext font-medium">{agent.displayName}</span>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          {utility.map((u) => (
                            <div key={u.slot} className="flex items-center gap-1.5 text-[10px]">
                              <span className="w-4 h-4 rounded bg-vsurface flex items-center justify-center flex-shrink-0">
                                <AbilityIconTiny name={u.name} />
                              </span>
                              <span className="text-vtext-dim truncate">{u.name}</span>
                              <span className="text-vtext-dim/50 ml-auto font-mono">×{u.charges}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Placed items */}
            {placedItems.length > 0 && (
              <div>
                <h3 className="font-heading text-[10px] text-vtext-dim uppercase tracking-wider mb-2">Placed ({placedItems.length})</h3>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {placedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-vdark rounded px-2 py-1 text-[10px]">
                      <span className="text-vtext-dim truncate">
                        {item.type === "spike" && "🔴 Spike"}
                        {item.type === "defender" && `🔴 ${item.agentId}`}
                        {item.type === "hidden" && `👻 ${item.agentId}`}
                        {item.type === "attacker-spawn" && `🔵 ${item.agentId} spawn`}
                        {item.type === "retake-entry" && `🟢 ${item.label}`}
                      </span>
                      <button onClick={() => removeItem(item.id)} className="text-vr ml-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved scenarios */}
            {savedScenarios.length > 0 && (
              <div className="pt-3 border-t border-vtext-dim/10">
                <h3 className="font-heading text-[10px] text-vtext-dim uppercase tracking-wider mb-2">Saved ({savedScenarios.length})</h3>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {savedScenarios.map((s, i) => (
                    <div key={i} className="bg-vdark rounded px-2 py-1 text-[10px] text-vtext-dim truncate">{s.name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ========================================
// Minimap Image Renderer (loads the actual map image)
// ========================================

function MinimapImageRenderer({
  mapId,
  x,
  y,
  width,
  height,
}: {
  mapId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = `/assets/minimaps/${mapId}.png`;
  }, [mapId]);

  if (!img) return null;

  return <KonvaImage image={img} x={x} y={y} width={width} height={height} />;
}

// ========================================
// Small agent face bubble for admin
// ========================================

function AgentFaceBubble({
  agentId,
  x,
  y,
  radius,
}: {
  agentId: string;
  x: number;
  y: number;
  radius: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const displayName = getAgentDisplayName(agentId);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = `/assets/agents/${displayName}_icon.webp`;
  }, [agentId]);

  const drawCircle = (context: any) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.closePath();
  };

  const drawImg = (context: any) => {
    if (!img) return;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    const imgRatio = img.width / img.height;
    let dw, dh, dx, dy;
    if (imgRatio > 1) {
      dh = radius * 2;
      dw = dh * imgRatio;
      dx = x - dw / 2;
      dy = y - radius;
    } else {
      dw = radius * 2;
      dh = dw / imgRatio;
      dx = x - radius;
      dy = y - dh / 2;
    }
    context.drawImage(img, dx, dy, dw, dh);
    context.restore();
  };

  if (!img) {
    return (
      <Group>
        <Circle x={x} y={y} radius={radius} fill="rgba(91,206,250,0.15)" stroke="#5BCEFA" strokeWidth={1.5} />
        <Text x={x - 4} y={y - 5} text={agentId[0]?.toUpperCase()} fontSize={9} fill="#5BCEFA" fontFamily="Oswald, sans-serif" fontStyle="bold" />
      </Group>
    );
  }

  return (
    <Group>
      <Circle x={x} y={y} radius={radius + 1} fill="rgba(91,206,250,0.1)" stroke="#5BCEFA" strokeWidth={1.5} />
      <KonvaImage image={img} x={x - radius} y={y - radius} width={radius * 2} height={radius * 2} clipFunc={drawCircle} customDrawFunc={drawImg} />
    </Group>
  );
}

// ========================================
// Tiny ability icon
// ========================================

function AbilityIconTiny({ name }: { name: string }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const url = getAbilityIconUrl(name);
    if (!url) return;
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
  }, [name]);

  if (img) {
    return <img src={img.src} alt="" className="w-full h-full object-contain" />;
  }

  // Fallback
  const n = name.toLowerCase();
  if (n.includes("smoke") || n.includes("cover") || n.includes("nebula")) return <span className="text-blue-400 text-[8px]">●</span>;
  if (n.includes("flash") || n.includes("blind")) return <span className="text-yellow-400 text-[8px]">✦</span>;
  if (n.includes("mollie") || n.includes("incendiar") || n.includes("blaze")) return <span className="text-red-400 text-[8px]">▲</span>;
  if (n.includes("dart") || n.includes("recon") || n.includes("owl")) return <span className="text-green-400 text-[8px]">◆</span>;
  return <span className="text-vtext-dim text-[8px]">?</span>;
}
