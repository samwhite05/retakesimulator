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
// Agent Ability Row
// ========================================

function AgentAbilityRow({
  abilityName,
  abilityType,
  charges,
  used,
  isSelected,
  onSelect,
}: {
  abilityName: string;
  abilityType: string;
  charges: number;
  used: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const remaining = Math.max(0, charges - used);
  const isExhausted = remaining <= 0;

  return (
    <button
      onClick={onSelect}
      disabled={isExhausted}
      className={`w-full flex items-center gap-2 px-2.5 py-2 border transition-all text-left rounded ${isExhausted
          ? "opacity-20 cursor-not-allowed border-border-04"
          : isSelected
            ? "border-cyan/30 bg-cyan-dim"
            : "border-border-06 hover:border-border-10 hover:bg-pure-black/50"
        }`}
      style={{ borderRadius: 2 }}
    >
      {/* Ability icon */}
      <div className="w-7 h-7 bg-void flex items-center justify-center flex-shrink-0" style={{ borderRadius: 2 }}>
        <AbilityIconImage name={abilityName} size={16} />
      </div>

      {/* Ability info */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs truncate ${isExhausted ? "text-text-muted" : "text-text-primary"}`}>
          {abilityName}
        </p>
        <span
          className={`text-[10px] font-mono ${isSelected ? "text-cyan" : "text-text-muted"}`}
          style={{ letterSpacing: "0.3px" }}
        >
          {abilityType.toUpperCase()}
        </span>
      </div>

      {/* Charge counter — monospace metrics */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="flex gap-0.5">
          {Array.from({ length: charges }).map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 ${i < used ? "bg-text-muted" : isSelected ? "bg-cyan" : "border border-border-10"}`}
            />
          ))}
        </div>
        <span className={`text-[10px] font-mono ${isExhausted ? "text-text-muted/30" : "text-text-muted"}`}>
          {remaining}/{charges}
        </span>
      </div>
    </button>
  );
}

function AbilityIconImage({ name, size = 16 }: { name: string; size?: number }) {
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

  const fallbacks: Record<string, string> = {
    smoke: "S", flash: "F", mollie: "M", dart: "D", dash: ">",
    concussion: "C", decoy: "D", wall: "W", sensor: "S", heal: "+",
    gravity_well: "G", trap: "T", turret: "T", alarm: "!", revive: "R",
    nanoswarm: "N", tripwire: "W",
  };

  return (
    <span style={{ fontSize: size * 0.6, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
      {fallbacks[name.toLowerCase()] || "?"}
    </span>
  );
}

// ========================================
// Agent Card
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

  return (
    <div className="bg-pure-black border border-border-08 overflow-hidden" style={{ borderRadius: 4 }}>
      {/* Agent header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        {/* Agent icon — near-square, subtle border */}
        <div className="w-9 h-9 overflow-hidden border border-border-10 flex-shrink-0 bg-void" style={{ borderRadius: 4 }}>
          {iconUrl ? (
            <img src={iconUrl} alt={agent.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-xs font-mono">
              {agent.displayName[0]}
            </div>
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm text-text-primary">{agent.displayName}</p>
          <span
            className="text-[10px] uppercase font-mono text-text-muted"
            style={{ letterSpacing: "0.3px" }}
          >
            {agent.role}
          </span>
        </div>

        {/* Expand indicator */}
        <span className="text-text-muted text-xs transition-transform duration-200 font-mono" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
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

  const compUtility = useMemo(() => {
    if (!scenario) return [];
    return scenario.availableUtility || [];
  }, [scenario]);

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

  const handleAgentMove = useCallback((agentId: string, position: { x: number; y: number }) => {
    setAgentPositions((prev) =>
      prev.map((a) => (a.agentId === agentId ? { ...a, position } : a))
    );
  }, []);

  const handleSelectAbility = useCallback((agentId: string, type: string) => {
    const key = `${type}:${agentId}`;
    setSelectedAbilityKey((prev) => (prev === key ? null : key));
    setDrawingArrow(false);
    setArrowStart(null);
    setSelectedAgentForArrow(null);
  }, []);

  const handleStartArrow = (agentId: string) => {
    setSelectedAgentForArrow(agentId);
    setDrawingArrow(true);
    setSelectedAbilityKey(null);
  };

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
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-none h-5 w-5 border border-cyan border-t-transparent" />
          <p className="mt-4 text-text-muted text-xs font-mono" style={{ letterSpacing: "0.5px" }}>
            LOADING SCENARIO...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-void flex flex-col">
      {/* Header — sticky, dark, border containment */}
      <header className="bg-void/90 backdrop-blur-sm border-b border-border-06 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <button
          onClick={() => router.push("/")}
          className="text-text-muted hover:text-text-primary text-sm font-mono transition-colors"
          style={{ letterSpacing: "0.3px" }}
        >
          ← BACK
        </button>
        <h1
          className="text-sm text-text-primary tracking-tight truncate max-w-[200px] sm:max-w-none"
          style={{ lineHeight: 1.0 }}
        >
          {scenario?.name}
        </h1>
        <button
          onClick={handleClear}
          className="text-text-muted hover:text-danger text-sm font-mono transition-colors"
          style={{ letterSpacing: "0.3px" }}
        >
          CLEAR
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Minimap Canvas */}
        <div className="flex-1 relative min-h-[50vh] lg:min-h-0">
          <MinimapCanvas
            minimapImage={scenario?.minimapImage}
            mapId={scenario?.map || "ascent"}
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

          {/* Active tool indicator — pure black card */}
          {selectedAbilityInfo && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-pure-black/95 backdrop-blur-sm border border-border-10 px-4 py-2 flex items-center gap-2 z-10" style={{ borderRadius: 4 }}>
              <div className="w-5 h-5 bg-void flex items-center justify-center" style={{ borderRadius: 2 }}>
                <img
                  src={getAbilityIconUrl(selectedAbilityInfo.ability.name)}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <span className="text-xs text-text-secondary">
                <span className="text-text-primary">{selectedAbilityInfo.ability.name}</span>
              </span>
              <button
                onClick={() => setSelectedAbilityKey(null)}
                className="ml-1 text-text-muted hover:text-danger text-xs font-mono"
              >
                ✕
              </button>
            </div>
          )}

          {drawingArrow && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-dim border border-cyan/20 text-cyan px-4 py-2 text-xs font-mono tracking-wide whitespace-nowrap z-10" style={{ borderRadius: 4, letterSpacing: "0.5px" }}>
              TAP DESTINATION TO DRAW MOVEMENT PATH
            </div>
          )}

          {/* Submit Button — white fill, dark text */}
          <div className="absolute bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-64">
            <button
              onClick={handleSubmit}
              disabled={submitting || utilityPlacements.length === 0}
              className="w-full py-3 bg-text-primary hover:bg-text-primary/90 disabled:bg-border-06 disabled:text-text-muted text-void font-mono text-xs tracking-widest uppercase rounded transition-all active:scale-[0.98] disabled:active:scale-100"
              style={{ borderRadius: 4, letterSpacing: "0.7px" }}
            >
              {submitting ? "EVALUATING..." : "EXECUTE PLAN"}
            </button>
          </div>
        </div>

        {/* Right Sidebar — pure black containment */}
        <div className="lg:w-80 xl:w-96 bg-pure-black border-t lg:border-t-0 lg:border-l border-border-06 flex flex-col">
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-border-06 flex-shrink-0">
            <h2
              className="text-text-muted text-[10px] uppercase font-mono tracking-widest"
              style={{ letterSpacing: "0.7px" }}
            >
              YOUR TEAM
            </h2>
            <p className="text-[10px] text-text-muted/60 mt-1">
              Tap ability → tap map to place
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

          {/* Movement paths section */}
          <div className="px-4 py-3 border-t border-border-06 flex-shrink-0">
            <p
              className="text-text-muted text-[10px] uppercase font-mono tracking-widest mb-2"
              style={{ letterSpacing: "0.7px" }}
            >
              MOVEMENT PATHS
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agentPositions.map((agent) => (
                <button
                  key={agent.agentId}
                  onClick={() => handleStartArrow(agent.agentId)}
                  className={`px-2.5 py-1.5 border text-xs font-mono transition-all flex items-center gap-1.5 ${selectedAgentForArrow === agent.agentId && drawingArrow
                      ? "border-cyan/30 bg-cyan-dim text-cyan"
                      : "border-border-06 text-text-muted hover:text-text-primary hover:border-border-10"
                    }`}
                  style={{ borderRadius: 2, letterSpacing: "0.3px" }}
                >
                  <span className="w-4 h-4 overflow-hidden border border-border-08 bg-void inline-block" style={{ borderRadius: 4 }}>
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

          {/* Plan summary — metrics display */}
          <div className="px-4 py-3 border-t border-border-06 flex-shrink-0 bg-void/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-mono" style={{ letterSpacing: "0.3px" }}>UTILITY</span>
              <span className="text-text-primary font-mono text-sm">{utilityPlacements.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-text-muted font-mono" style={{ letterSpacing: "0.3px" }}>PATHS</span>
              <span className="text-text-primary font-mono text-sm">{movementArrows.length}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
