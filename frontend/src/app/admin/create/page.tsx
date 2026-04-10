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
    <main className="min-h-screen bg-void text-text-primary flex flex-col">
      {/* Header — sticky, dark, border containment */}
      <header className="bg-void/90 backdrop-blur-sm border-b border-border-06 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="text-text-muted hover:text-text-primary text-sm font-mono transition-colors" style={{ letterSpacing: "0.3px" }}>
            ← BACK
          </button>
          <h1 className="text-sm text-text-primary tracking-tight font-mono" style={{ letterSpacing: "0.5px" }}>SCENARIO CREATOR</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const w = window.open("", "_blank");
            if (w) { w.document.write(`<pre style="background:#0f0f0f;color:#ffffff;padding:20px;white-space:pre-wrap;font-family:monospace;">${JSON.stringify(scenarioJson, null, 2)}</pre>`); }
          }} className="px-3 py-1.5 bg-charcoal hover:bg-charcoal/80 border border-border-08 rounded text-xs font-mono transition-colors" style={{ letterSpacing: "0.3px", borderRadius: 2 }}>
            PREVIEW
          </button>
          <button onClick={copyJson} className="px-3 py-1.5 bg-charcoal hover:bg-charcoal/80 border border-border-08 rounded text-xs font-mono transition-colors" style={{ letterSpacing: "0.3px", borderRadius: 2 }}>
            COPY JSON
          </button>
          <button onClick={saveScenario} className="px-4 py-1.5 bg-text-primary hover:bg-text-primary/90 rounded text-void text-xs font-mono transition-all" style={{ letterSpacing: "0.3px", borderRadius: 2 }}>
            SAVE
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Map + Canvas */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Map/Site selectors */}
          <div className="px-4 py-3 border-b border-border-06 flex-shrink-0 flex flex-wrap gap-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1 font-mono" style={{ letterSpacing: "0.3px" }}>MAP</label>
              <select
                value={selectedMap.mapId}
                onChange={(e) => {
                  const map = ALL_MAP_POSITIONS.find((m) => m.mapId === e.target.value)!;
                  setSelectedMap(map);
                  setSelectedSite(map.sites[0]);
                }}
                className="bg-void border border-border-10 rounded px-2 py-1 text-sm text-text-primary font-mono"
                style={{ borderRadius: 2 }}
              >
                {ALL_MAP_POSITIONS.map((m) => (
                  <option key={m.mapId} value={m.mapId}>{m.mapName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1 font-mono" style={{ letterSpacing: "0.3px" }}>SITE</label>
              <div className="flex gap-1">
                {selectedMap.sites.map((site) => (
                  <button
                    key={site.siteId}
                    onClick={() => setSelectedSite(site)}
                    className={`px-3 py-1 border text-xs font-mono transition-all ${selectedSite.siteId === site.siteId
                      ? "border-cyan/30 bg-cyan-dim text-cyan"
                      : "border-border-08 text-text-muted hover:border-border-10"
                      }`}
                    style={{ borderRadius: 2, letterSpacing: "0.3px" }}
                  >
                    {site.siteName}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1 font-mono" style={{ letterSpacing: "0.3px" }}>SCENARIO NAME</label>
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full bg-void border border-border-10 rounded px-2 py-1 text-sm text-text-primary font-mono placeholder:text-text-muted/30"
                style={{ borderRadius: 2 }}
              />
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-void min-h-[400px]" ref={containerRef}>
            {toolMode !== "select" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-pure-black/95 backdrop-blur-sm border border-border-10 text-text-primary px-4 py-2 text-xs font-mono z-10 whitespace-nowrap" style={{ borderRadius: 4, letterSpacing: "0.5px" }}>
                {toolMode === "place-spike" && "CLICK TO PLACE SPIKE"}
                {toolMode === "place-defender" && `CLICK TO PLACE DEFENDER (${selectedDefenderAgent})`}
                {toolMode === "place-hidden" && `CLICK TO PLACE HIDDEN (${selectedDefenderAgent})`}
                {toolMode === "place-attacker-spawn" && `PLACE SPAWN FOR ${playerAgents[placedItems.filter(i => i.type === "attacker-spawn").length] || "..."}`}
                {toolMode === "place-retake-entry" && "CLICK TO PLACE RETAKE ENTRY"}
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
                <Rect x={0} y={0} width={containerSize.width} height={containerSize.height} fill="#000000" />
                <Rect x={MAP_PADDING} y={MAP_PADDING} width={containerSize.width - MAP_PADDING * 2} height={containerSize.height - MAP_PADDING * 2} fill="#0a0a0a" />

                {/* Grid — subtle */}
                {Array.from({ length: 9 }).map((_, i) => {
                  const x = MAP_PADDING + ((i + 1) / 10) * (containerSize.width - MAP_PADDING * 2);
                  return <Line key={`vg-${i}`} points={[x, MAP_PADDING, x, containerSize.height - MAP_PADDING]} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />;
                })}
                {Array.from({ length: 9 }).map((_, i) => {
                  const y = MAP_PADDING + ((i + 1) / 10) * (containerSize.height - MAP_PADDING * 2);
                  return <Line key={`hg-${i}`} points={[MAP_PADDING, y, containerSize.width - MAP_PADDING, y]} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />;
                })}

                {/* Plant zone */}
                <Circle
                  x={MAP_PADDING + selectedSite.plantZone.center.x * (containerSize.width - MAP_PADDING * 2)}
                  y={MAP_PADDING + selectedSite.plantZone.center.y * (containerSize.height - MAP_PADDING * 2)}
                  radius={selectedSite.plantZone.radius * (containerSize.width - MAP_PADDING * 2)}
                  fill="rgba(0,255,136,0.04)"
                  stroke="rgba(0,255,136,0.15)"
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
                    fill="rgba(255,255,255,0.06)"
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
                      fill="rgba(255,59,92,0.08)"
                      stroke="#ff3b5c"
                      strokeWidth={2}
                      dash={[3, 3]}
                    />
                    <Text
                      x={toCanvas(placedItems.find((i) => i.type === "spike")!.position).x - 12}
                      y={toCanvas(placedItems.find((i) => i.type === "spike")!.position).y - 18}
                      text="SPIKE"
                      fontSize={9}
                      fill="#ff3b5c"
                      fontFamily="monospace"
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
                      fill="rgba(255,59,92,0.15)"
                      stroke="#ff3b5c"
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
                      fill="rgba(255,59,92,0.06)"
                      stroke="#ff3b5c"
                      strokeWidth={1.5}
                      dash={[3, 3]}
                    />
                    <Text
                      x={toCanvas(item.position).x - 4}
                      y={toCanvas(item.position).y - 5}
                      text="?"
                      fontSize={10}
                      fill="rgba(255,59,92,0.4)"
                      fontFamily="monospace"
                      fontStyle="bold"
                    />
                  </Group>
                ))}

                {/* Attacker spawns */}
                {placedItems.filter((i) => i.type === "attacker-spawn").map((item, idx) => (
                  <Group key={item.id}>
                    <Circle
                      x={toCanvas(item.position).x}
                      y={toCanvas(item.position).y}
                      radius={14}
                      fill="rgba(0,137,255,0.08)"
                      stroke="#0089ff"
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
                      fill="#0089ff"
                      fontFamily="monospace"
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
                      fill="rgba(0,255,136,0.06)"
                      stroke="#00ff88"
                      strokeWidth={1.5}
                    />
                    <Text
                      x={toCanvas(item.position).x - 15}
                      y={toCanvas(item.position).y + 16}
                      text={item.label || ""}
                      fontSize={8}
                      fill="#00ff88"
                      fontFamily="sans-serif"
                    />
                  </Group>
                ))}
              </Layer>
            </Stage>
          </div>

          {/* Tool buttons bar */}
          <div className="px-4 py-2 border-t border-border-06 flex-shrink-0 flex flex-wrap gap-1.5">
            <button onClick={() => setToolMode("place-spike")} className={`px-2.5 py-1.5 border text-xs font-mono transition-all ${toolMode === "place-spike" ? "border-danger/30 bg-danger-dim text-danger" : "border-border-06 text-text-muted hover:border-border-10"}`} style={{ borderRadius: 2, letterSpacing: "0.3px" }}>SPIKE</button>
            <select value={selectedDefenderAgent} onChange={(e) => setSelectedDefenderAgent(e.target.value)} className="bg-void border border-border-10 rounded px-1.5 py-1 text-xs text-text-primary font-mono" style={{ borderRadius: 2 }}>
              {ALL_AGENTS.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
            </select>
            <button onClick={() => setToolMode("place-defender")} className={`px-2.5 py-1.5 border text-xs font-mono transition-all ${toolMode === "place-defender" ? "border-danger/30 bg-danger-dim text-danger" : "border-border-06 text-text-muted hover:border-border-10"}`} style={{ borderRadius: 2, letterSpacing: "0.3px" }}>DEFENDER</button>
            <button onClick={() => setToolMode("place-hidden")} className={`px-2.5 py-1.5 border text-xs font-mono transition-all ${toolMode === "place-hidden" ? "border-danger/20 bg-danger-dim text-danger" : "border-border-06 text-text-muted hover:border-border-10"}`} style={{ borderRadius: 2, letterSpacing: "0.3px" }}>HIDDEN</button>
            <button onClick={() => setToolMode("place-attacker-spawn")} className={`px-2.5 py-1.5 border text-xs font-mono transition-all ${toolMode === "place-attacker-spawn" ? "border-signal/30 bg-cyan-dim text-signal" : "border-border-06 text-text-muted hover:border-border-10"}`} style={{ borderRadius: 2, letterSpacing: "0.3px" }}>SPAWN</button>
            <button onClick={() => setToolMode("place-retake-entry")} className={`px-2.5 py-1.5 border text-xs font-mono transition-all ${toolMode === "place-retake-entry" ? "border-success/30 bg-success-dim text-success" : "border-border-06 text-text-muted hover:border-border-10"}`} style={{ borderRadius: 2, letterSpacing: "0.3px" }}>ENTRY</button>
            <button onClick={() => setToolMode("select")} className={`px-2.5 py-1.5 border text-xs font-mono transition-all ${toolMode === "select" ? "border-border-12 text-text-primary" : "border-border-06 text-text-muted hover:border-border-10"}`} style={{ borderRadius: 2, letterSpacing: "0.3px" }}>DONE</button>
            <button onClick={() => setPlacedItems([])} className="px-2.5 py-1.5 border border-border-06 text-xs text-danger font-mono ml-auto hover:border-danger/30 transition-all" style={{ borderRadius: 2, letterSpacing: "0.3px" }}>CLEAR</button>
          </div>
        </div>

        {/* Right: Player Comp + Details */}
        <div className="lg:w-80 bg-pure-black border-t lg:border-t-0 lg:border-l border-border-06 overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            {/* Scenario details */}
            <div>
              <h3 className="text-text-muted text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ letterSpacing: "0.7px" }}>DETAILS</h3>
              <textarea
                value={scenarioDesc}
                onChange={(e) => setScenarioDesc(e.target.value)}
                placeholder="Briefing description"
                rows={2}
                className="w-full bg-void border border-border-10 rounded px-2 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted/30 resize-none"
                style={{ borderRadius: 2 }}
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-text-muted font-mono" style={{ letterSpacing: "0.3px" }}>DIFFICULTY:</label>
                <input type="range" min={1} max={5} value={scenarioDifficulty} onChange={(e) => setScenarioDifficulty(parseInt(e.target.value))} className="flex-1" />
                <span className="text-xs text-text-primary font-mono">{scenarioDifficulty}</span>
              </div>
            </div>

            {/* Player Comp */}
            <div>
              <h3 className="text-text-muted text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ letterSpacing: "0.7px" }}>
                PLAYER COMP ({playerAgents.length}/5)
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {ALL_AGENTS.map((agent) => {
                  const isSelected = playerAgents.includes(agent.id);
                  const displayName = getAgentDisplayName(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => togglePlayerAgent(agent.id)}
                      className={`relative aspect-square border flex flex-col items-center justify-center transition-all ${isSelected ? "border-danger/30 bg-danger-dim" : "border-border-06 bg-void hover:border-border-10"
                        }`}
                      style={{ borderRadius: 2 }}
                    >
                      <div className="w-7 h-7 overflow-hidden mb-0.5 border border-border-06 bg-pure-black" style={{ borderRadius: 4 }}>
                        <img
                          src={`/assets/agents/${displayName}_icon.webp`}
                          alt={agent.displayName}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                      <span className="text-[7px] text-text-muted leading-none font-mono">{agent.displayName.slice(0, 5)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Utility preview for comp */}
            {playerAgents.length > 0 && (
              <div>
                <h3 className="text-text-muted text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ letterSpacing: "0.7px" }}>UTILITY</h3>
                <div className="space-y-2">
                  {playerAgents.map((agentId) => {
                    const agent = ALL_AGENTS.find((a) => a.id === agentId);
                    if (!agent) return null;
                    const utility = agent.abilities.filter((a) => !a.isUltimate);
                    return (
                      <div key={agentId} className="bg-void border border-border-06" style={{ borderRadius: 4 }}>
                        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border-04">
                          <div className="w-5 h-5 overflow-hidden border border-border-06 bg-pure-black" style={{ borderRadius: 4 }}>
                            <img
                              src={`/assets/agents/${getAgentDisplayName(agentId)}_icon.webp`}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                          <span className="text-xs text-text-primary">{agent.displayName}</span>
                        </div>
                        <div className="p-1.5 space-y-0.5">
                          {utility.map((u) => (
                            <div key={u.slot} className="flex items-center gap-1.5 text-[10px]">
                              <span className="w-4 h-4 border border-border-06 bg-pure-black flex items-center justify-center flex-shrink-0" style={{ borderRadius: 2 }}>
                                <AbilityIconTiny name={u.name} />
                              </span>
                              <span className="text-text-muted truncate">{u.name}</span>
                              <span className="text-text-muted/50 ml-auto font-mono">×{u.charges}</span>
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
                <h3 className="text-text-muted text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ letterSpacing: "0.7px" }}>PLACED ({placedItems.length})</h3>
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {placedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-void border border-border-04 px-2 py-1 text-[10px] font-mono" style={{ borderRadius: 2 }}>
                      <span className="text-text-muted truncate">
                        {item.type === "spike" && "SPIKE"}
                        {item.type === "defender" && `${item.agentId}`}
                        {item.type === "hidden" && `HIDDEN ${item.agentId}`}
                        {item.type === "attacker-spawn" && `${item.agentId} SPAWN`}
                        {item.type === "retake-entry" && `${item.label}`}
                      </span>
                      <button onClick={() => removeItem(item.id)} className="text-danger ml-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved scenarios */}
            {savedScenarios.length > 0 && (
              <div className="pt-3 border-t border-border-06">
                <h3 className="text-text-muted text-[10px] uppercase tracking-wider mb-2 font-mono" style={{ letterSpacing: "0.7px" }}>SAVED ({savedScenarios.length})</h3>
                <div className="space-y-0.5 max-h-24 overflow-y-auto">
                  {savedScenarios.map((s, i) => (
                    <div key={i} className="bg-void border border-border-04 px-2 py-1 text-[10px] text-text-muted font-mono truncate" style={{ borderRadius: 2 }}>{s.name}</div>
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
        <Circle x={x} y={y} radius={radius} fill="rgba(0,137,255,0.08)" stroke="#0089ff" strokeWidth={1.5} />
        <Text x={x - 4} y={y - 5} text={agentId[0]?.toUpperCase()} fontSize={9} fill="#0089ff" fontFamily="monospace" fontStyle="bold" />
      </Group>
    );
  }

  return (
    <Group>
      <Circle x={x} y={y} radius={radius + 1} fill="rgba(0,137,255,0.06)" stroke="#0089ff" strokeWidth={1.5} />
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
  if (n.includes("smoke") || n.includes("cover") || n.includes("nebula")) return <span style={{ fontSize: 8, color: "#0089ff", fontFamily: "var(--font-mono)" }}>●</span>;
  if (n.includes("flash") || n.includes("blind")) return <span style={{ fontSize: 8, color: "#ffaa00", fontFamily: "var(--font-mono)" }}>✦</span>;
  if (n.includes("mollie") || n.includes("incendiar") || n.includes("blaze")) return <span style={{ fontSize: 8, color: "#ff3b5c", fontFamily: "var(--font-mono)" }}>▲</span>;
  if (n.includes("dart") || n.includes("recon") || n.includes("owl")) return <span style={{ fontSize: 8, color: "#00ff88", fontFamily: "var(--font-mono)" }}>◆</span>;
  return <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-mono)" }}>?</span>;
}
