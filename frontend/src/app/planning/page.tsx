"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import MinimapCanvas from "@/components/canvas/MinimapCanvas";
import type {
  PlayerPlan,
  UtilityItem,
  Arrow,
  AgentPosition,
  UtilityType,
} from "@shared/types";
import { ALL_AGENTS, getCompUtility, type AgentAbilities } from "@shared/agentAbilities";
import { getAgentIconUrl, getAbilityIconUrl } from "@shared/assets";

// ========================================
// Agent Ability Card Component
// ========================================

function AgentAbilityRow({
  abilityName,
  abilityType,
  charges,
  used,
  agentIconUrl,
  isSelected,
  onSelect,
}: {
  abilityName: string;
  abilityType: string;
  charges: number;
  used: number;
  agentIconUrl: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const remaining = Math.max(0, charges - used);
  const isExhausted = remaining <= 0;

  const typeColors: Record<string, string> = {
    smoke: "border-blue-500/30 bg-blue-500/5",
    flash: "border-yellow-500/30 bg-yellow-500/5",
    mollie: "border-red-500/30 bg-red-500/5",
    dart: "border-green-500/30 bg-green-500/5",
    concussion: "border-pink-500/30 bg-pink-500/5",
    decoy: "border-indigo-500/30 bg-indigo-500/5",
    dash: "border-purple-500/30 bg-purple-500/5",
    wall: "border-violet-500/30 bg-violet-500/5",
    sensor: "border-sky-500/30 bg-sky-500/5",
    heal: "border-emerald-500/30 bg-emerald-500/5",
    gravity_well: "border-orange-500/30 bg-orange-500/5",
    trap: "border-gray-500/30 bg-gray-500/5",
    turret: "border-amber-500/30 bg-amber-500/5",
    alarm: "border-red-400/30 bg-red-400/5",
    revive: "border-green-500/30 bg-green-500/5",
    nanoswarm: "border-yellow-400/30 bg-yellow-400/5",
    tripwire: "border-cyan-500/30 bg-cyan-500/5",
  };

  const typeBadgeColors: Record<string, string> = {
    smoke: "bg-blue-500/20 text-blue-400",
    flash: "bg-yellow-500/20 text-yellow-400",
    mollie: "bg-red-500/20 text-red-400",
    dart: "bg-green-500/20 text-green-400",
    concussion: "bg-pink-500/20 text-pink-400",
    decoy: "bg-indigo-500/20 text-indigo-400",
    dash: "bg-purple-500/20 text-purple-400",
    wall: "bg-violet-500/20 text-violet-400",
    sensor: "bg-sky-500/20 text-sky-400",
    heal: "bg-emerald-500/20 text-emerald-400",
    gravity_well: "bg-orange-500/20 text-orange-400",
    trap: "bg-gray-500/20 text-gray-400",
    turret: "bg-amber-500/20 text-amber-400",
    alarm: "bg-red-400/20 text-red-400",
    revive: "bg-green-500/20 text-green-400",
    nanoswarm: "bg-yellow-400/20 text-yellow-400",
    tripwire: "bg-cyan-500/20 text-cyan-400",
  };

  const borderColor = typeColors[abilityType] || "border-vtext-dim/10 bg-vdark";
  const badgeColor = typeBadgeColors[abilityType] || "bg-vsurface text-vtext-dim";

  return (
    <button
      onClick={onSelect}
      disabled={isExhausted}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left group ${borderColor} ${isExhausted
          ? "opacity-30 cursor-not-allowed"
          : isSelected
            ? "ring-1 ring-vr border-vr/30 bg-vr/5"
            : "hover:bg-vsurface-hover/50 border-vtext-dim/10"
        }`}
    >
      {/* Ability icon */}
      <div className="w-7 h-7 rounded bg-vdark/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <AbilityIconImage name={abilityName} size={18} />
      </div>

      {/* Ability info */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isExhausted ? "text-vtext-dim/50" : "text-vtext"}`}>
          {abilityName}
        </p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeColor}`}>
          {abilityType}
        </span>
      </div>

      {/* Charge counter */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="flex gap-0.5">
          {Array.from({ length: charges }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i < used ? "bg-vtext-dim/30" : "bg-vr"
                }`}
            />
          ))}
        </div>
        <span className={`text-[10px] font-mono ${isExhausted ? "text-vtext-dim/30" : "text-vtext-dim"}`}>
          {remaining}/{charges}
        </span>
      </div>
    </button>
  );
}

function AbilityIconImage({ name, size = 18 }: { name: string; size?: number }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const url = getAbilityIconUrl(name);
    if (!url) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled) setImg(image); };
    image.src = url;
    return () => { cancelled = true; };
  }, [name]);

  if (img) {
    return <img src={img.src} alt={name} style={{ width: size, height: size, objectFit: "contain" }} />;
  }

  // Fallback
  const fallbacks: Record<string, string> = {
    smoke: "💨", flash: "⚡", mollie: "🔥", dart: "🎯", dash: "»",
    concussion: "💫", decoy: "👻", wall: "▮", sensor: "◉", heal: "+",
    gravity_well: "◎", trap: "⚠", turret: "⊕", alarm: "!", revive: "★",
    nanoswarm: "⬡", tripwire: "⚡",
  };

  // Try to match by type
  const type = name.toLowerCase();
  if (type.includes("smoke") || type.includes("cover") || type.includes("cloud") || type.includes("nebula") || type.includes("cove") || type.includes("ruse") || type.includes("meddle")) return <span style={{ fontSize: size * 0.7 }}>💨</span>;
  if (type.includes("flash") || type.includes("blind") || type.includes("paranoia") || type.includes("leer") || type.includes("arc rose")) return <span style={{ fontSize: size * 0.7 }}>⚡</span>;
  if (type.includes("mollie") || type.includes("incendiar") || type.includes("blaze") || type.includes("paint") || type.includes("mosh") || type.includes("aftershock") || type.includes("frag") || type.includes("hot hand") || type.includes("snake") || type.includes("razor")) return <span style={{ fontSize: size * 0.7 }}>🔥</span>;
  if (type.includes("dart") || type.includes("recon") || type.includes("owl") || type.includes("seeker") || type.includes("prowler") || type.includes("wingman") || type.includes("trail") || type.includes("haunt")) return <span style={{ fontSize: size * 0.7 }}>🎯</span>;
  if (type.includes("concuss") || type.includes("shock") || type.includes("nova") || type.includes("fault") || type.includes("rolling") || type.includes("null") || type.includes("headhunter") || type.includes("tour") || type.includes("relay") || type.includes("undercut") || type.includes("thrash") || type.includes("armageddon")) return <span style={{ fontSize: size * 0.7 }}>💫</span>;

  return <span style={{ fontSize: size * 0.7, color: "#8B99A5" }}>?</span>;
}

// ========================================
// Agent Card Component
// ========================================

function AgentCard({
  agent,
  usedCharges,
  selectedAbilityKey,
  onSelectAbility,
}: {
  agent: AgentAbilities;
  usedCharges: Record<string, number>;
  selectedAbilityKey: string | null;
  onSelectAbility: (agentId: string, type: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const iconUrl = getAgentIconUrl(agent.id);
  const usableAbilities = agent.abilities.filter((a) => !a.isUltimate);

  const roleColors: Record<string, string> = {
    duelist: "text-orange-400",
    initiator: "text-blue-400",
    controller: "text-purple-400",
    sentinel: "text-emerald-400",
  };

  return (
    <div className="bg-vdark/50 rounded-xl overflow-hidden border border-vtext-dim/5">
      {/* Agent header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-vsurface-hover/30 transition-colors"
      >
        {/* Agent icon bubble */}
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-vtext-dim/20 flex-shrink-0 bg-vsurface">
          {iconUrl ? (
            <img src={iconUrl} alt={agent.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-vtext-dim text-sm font-bold">
              {agent.displayName[0]}
            </div>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-vtext">{agent.displayName}</p>
          <span className={`text-[10px] uppercase tracking-wider ${roleColors[agent.role] || "text-vtext-dim"}`}>
            {agent.role}
          </span>
        </div>

        {/* Expand arrow */}
        <span className="text-vtext-dim text-xs transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▾
        </span>
      </button>

      {/* Abilities list */}
      {expanded && (
        <div className="px-2 pb-2 space-y-1">
          {usableAbilities.map((ability) => {
            const chargeKey = `${ability.type}:${agent.id}`;
            const used = usedCharges[chargeKey] || 0;
            const isSelected = selectedAbilityKey === chargeKey;

            return (
              <AgentAbilityRow
                key={ability.slot}
                abilityName={ability.name}
                abilityType={ability.type}
                charges={ability.charges}
                used={used}
                agentIconUrl={iconUrl}
                isSelected={isSelected}
                onSelect={() => onSelectAbility(agent.id, ability.type)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========================================
// Main Planning Page
// ========================================

export default function PlanningPage() {
  const router = useRouter();
  const [scenario, setScenario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Plan state
  const [utilityPlacements, setUtilityPlacements] = useState<UtilityItem[]>([]);
  const [movementArrows, setMovementArrows] = useState<Arrow[]>([]);
  const [agentPositions, setAgentPositions] = useState<AgentPosition[]>([]);
  const [usedCharges, setUsedCharges] = useState<Record<string, number>>({});

  // Selection state
  const [selectedAbilityKey, setSelectedAbilityKey] = useState<string | null>(null);
  const [selectedAgentForArrow, setSelectedAgentForArrow] = useState<string | null>(null);
  const [drawingArrow, setDrawingArrow] = useState(false);
  const [arrowStart, setArrowStart] = useState<{ x: number; y: number } | null>(null);

  // Derived: selected ability info
  const selectedAbilityInfo = useMemo(() => {
    if (!selectedAbilityKey) return null;
    const [type, agentId] = selectedAbilityKey.split(":");
    const agent = ALL_AGENTS.find((a) => a.id === agentId);
    const ability = agent?.abilities.find((a) => a.type === type && !a.isUltimate);
    return ability ? { type, agentId, agent, ability } : null;
  }, [selectedAbilityKey]);

  // Comp utility from scenario
  const compUtility = useMemo(() => {
    if (!scenario) return [];
    return scenario.availableUtility || [];
  }, [scenario]);

  // Group agents by their abilities for display
  const compAgents = useMemo(() => {
    if (!scenario) return [];
    const agentIds = scenario.availableAgents || [];
    return ALL_AGENTS.filter((a) => agentIds.includes(a.id));
  }, [scenario]);

  useEffect(() => {
    async function fetchScenario() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/scenarios/today`
        );
        const json = await res.json();

        if (json.success) {
          setScenario(json.data.scenario);
          if (json.data.scenario.friendlyAgents) {
            setAgentPositions(
              json.data.scenario.friendlyAgents.map((a: any) => ({
                agentId: a.id,
                position: a.position,
              }))
            );
          }
        } else {
          router.push("/");
        }
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    }

    fetchScenario();
  }, [router]);

  // Handle canvas tap — place utility
  const handleCanvasTap = useCallback(
    (position: { x: number; y: number }) => {
      if (selectedAbilityInfo && scenario) {
        const { type, agentId } = selectedAbilityInfo;
        const chargeKey = `${type}:${agentId}`;

        const availableUtil = compUtility.find(
          (u: any) => u.type === type && u.agentId === agentId
        );
        const totalCharges = availableUtil?.charges || 0;
        const currentlyUsed = usedCharges[chargeKey] || 0;

        if (currentlyUsed >= totalCharges) {
          setSelectedAbilityKey(null);
          return;
        }

        const newItem: UtilityItem = {
          id: `util-${Date.now()}`,
          type: type as UtilityType,
          agentId,
          position,
        };
        setUtilityPlacements((prev) => [...prev, newItem]);
        setUsedCharges((prev) => ({
          ...prev,
          [chargeKey]: currentlyUsed + 1,
        }));
        setSelectedAbilityKey(null);
      } else if (drawingArrow && arrowStart && selectedAgentForArrow) {
        const newArrow: Arrow = {
          agentId: selectedAgentForArrow,
          path: [arrowStart, position],
        };
        setMovementArrows((prev) => [...prev, newArrow]);
        setDrawingArrow(false);
        setArrowStart(null);
        setSelectedAgentForArrow(null);
      }
    },
    [selectedAbilityInfo, drawingArrow, arrowStart, selectedAgentForArrow, scenario, compUtility, usedCharges]
  );

  // Handle agent drag on minimap
  const handleAgentMove = useCallback((agentId: string, position: { x: number; y: number }) => {
    setAgentPositions((prev) =>
      prev.map((a) => (a.agentId === agentId ? { ...a, position } : a))
    );
  }, []);

  // Select ability for placement
  const handleSelectAbility = useCallback((agentId: string, type: string) => {
    const key = `${type}:${agentId}`;
    setSelectedAbilityKey((prev) => (prev === key ? null : key));
    setDrawingArrow(false);
    setArrowStart(null);
    setSelectedAgentForArrow(null);
  }, []);

  // Start drawing arrow for agent
  const handleStartArrow = (agentId: string) => {
    setSelectedAgentForArrow(agentId);
    setDrawingArrow(true);
    setSelectedAbilityKey(null);
  };

  // Submit plan
  const handleSubmit = async () => {
    if (!scenario) return;
    setSubmitting(true);

    const plan: PlayerPlan = {
      scenarioId: scenario.id,
      agentSelection: agentPositions.map((a) => a.agentId),
      agentPositions,
      utilityPlacements,
      movementArrows,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        }
      );
      const json = await res.json();

      if (json.success) {
        sessionStorage.setItem("lastOutcome", JSON.stringify(json.data.outcome));
        sessionStorage.setItem("lastPlan", JSON.stringify(plan));
        router.push("/results");
      }
    } catch (err) {
      console.error("Failed to submit plan:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Clear all
  const handleClear = () => {
    setUtilityPlacements([]);
    setMovementArrows([]);
    setUsedCharges({});
    setSelectedAbilityKey(null);
    setSelectedAgentForArrow(null);
    setDrawingArrow(false);
    setArrowStart(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-vdark">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-vr border-t-transparent" />
          <p className="mt-4 text-vtext-dim text-sm">Loading scenario...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-vdark flex flex-col">
      {/* Header */}
      <header className="bg-vsurface/80 backdrop-blur-sm border-b border-vtext-dim/10 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={() => router.push("/")}
          className="text-vtext-dim hover:text-vtext text-sm transition-colors"
        >
          ← Back
        </button>
        <h1 className="font-heading text-sm sm:text-base font-semibold text-vtext tracking-wide truncate max-w-[200px] sm:max-w-none">
          {scenario?.name}
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClear}
            className="text-vtext-dim hover:text-vr text-sm transition-colors"
          >
            Clear
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Minimap Canvas */}
        <div className="flex-1 relative min-h-[50vh] lg:min-h-0">
          <MinimapCanvas
            minimapImage={scenario?.minimapImage}
            enemyAgents={scenario?.enemyAgents || []}
            friendlyAgents={scenario?.friendlyAgents || []}
            spikeSite={scenario?.spikeSite}
            utilityPlacements={utilityPlacements}
            movementArrows={movementArrows}
            agentPositions={agentPositions}
            onAgentMove={handleAgentMove}
            arrowStart={arrowStart}
            onCanvasTap={handleCanvasTap}
            drawingArrow={drawingArrow}
          />

          {/* Active tool indicator */}
          {selectedAbilityInfo && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-vsurface/90 backdrop-blur-sm border border-vtext-dim/20 rounded-lg px-4 py-2 flex items-center gap-2 z-10">
              <div className="w-5 h-5 rounded overflow-hidden bg-vdark/50">
                <img
                  src={getAbilityIconUrl(selectedAbilityInfo.ability.name)}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <span className="text-xs text-vtext">
                Place <span className="text-vtext font-medium">{selectedAbilityInfo.ability.name}</span>
              </span>
              <button
                onClick={() => setSelectedAbilityKey(null)}
                className="ml-1 text-vtext-dim hover:text-vr text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {drawingArrow && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-vr/90 backdrop-blur-sm text-white px-4 py-2 rounded text-xs font-medium tracking-wide whitespace-nowrap z-10">
              🎯 Tap destination to draw movement path
            </div>
          )}

          {/* Submit Button */}
          <div className="absolute bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-64">
            <button
              onClick={handleSubmit}
              disabled={submitting || utilityPlacements.length === 0}
              className="w-full py-3 bg-vr hover:bg-vr/90 disabled:bg-vsurface disabled:text-vtext-dim text-white font-heading text-base font-semibold tracking-widest uppercase rounded transition-all active:scale-[0.98] disabled:active:scale-100"
            >
              {submitting ? "EVALUATING..." : "EXECUTE PLAN"}
            </button>
          </div>
        </div>

        {/* Right Sidebar — Character Abilities */}
        <div className="lg:w-80 xl:w-96 bg-vsurface/50 backdrop-blur-sm border-t lg:border-t-0 lg:border-l border-vtext-dim/10 flex flex-col">
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-vtext-dim/10 flex-shrink-0">
            <h2 className="font-heading text-xs text-vtext-dim uppercase tracking-wider">Your Team</h2>
            <p className="text-[10px] text-vtext-dim/60 mt-0.5">
              Tap an ability to select it, then tap the minimap to place
            </p>
          </div>

          {/* Scrollable agent list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {compAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                usedCharges={usedCharges}
                selectedAbilityKey={selectedAbilityKey}
                onSelectAbility={handleSelectAbility}
              />
            ))}
          </div>

          {/* Movement arrows section */}
          <div className="px-4 py-3 border-t border-vtext-dim/10 flex-shrink-0">
            <p className="text-[10px] text-vtext-dim uppercase tracking-wider mb-2">Movement Paths</p>
            <div className="flex flex-wrap gap-1.5">
              {agentPositions.map((agent) => (
                <button
                  key={agent.agentId}
                  onClick={() => handleStartArrow(agent.agentId)}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${selectedAgentForArrow === agent.agentId && drawingArrow
                      ? "bg-vr text-white"
                      : "bg-vdark text-vtext-dim hover:text-vtext hover:bg-vsurface-hover"
                    }`}
                >
                  <span className="w-4 h-4 rounded-full overflow-hidden bg-vsurface inline-block">
                    <img
                      src={getAgentIconUrl(agent.agentId)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </span>
                  →
                </button>
              ))}
            </div>
          </div>

          {/* Plan summary */}
          <div className="px-4 py-3 border-t border-vtext-dim/10 flex-shrink-0 bg-vdark/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-vtext-dim">Utility placed</span>
              <span className="text-vtext font-mono">{utilityPlacements.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-vtext-dim">Movement paths</span>
              <span className="text-vtext font-mono">{movementArrows.length}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
