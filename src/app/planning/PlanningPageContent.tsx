"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TacticalMap from "@/components/canvas/TacticalMap";
import HelpModal from "@/components/planning/HelpModal";
import InteractiveCinematicPlayer from "@/components/animation/InteractiveCinematicPlayer";
import PlanningTopBar from "@/components/planning/PlanningTopBar";
import AgentRail from "@/components/planning/AgentRail";
import BriefingRail from "@/components/planning/BriefingRail";
import UtilityBay from "@/components/planning/UtilityBay";
import MapLegend from "@/components/planning/MapLegend";
import OnboardingCoachmark from "@/components/planning/OnboardingCoachmark";
import { usePlanStore, encodePlan } from "@/store/planStore";
import { normalizePlayerPlan } from "@/lib/normalizePlan";
import { isFinalExecuteSubmittable } from "@/lib/planValidation";
import type {
  Scenario,
  ScenarioResponse,
  SubmitPlanResponse,
  UtilityType,
  Position,
  FinalRunPayload,
} from "@/types";
import { tileToPos, posToTile, findPath, isSpawnable } from "@/engine/simulation/grid";
import { getAgentDef, getUtilityRenderSpec } from "@/lib/constants";
import { encodeUtf8JsonForQueryParam } from "@/lib/urlUtf8Payload";
import { computePathExposure } from "@/engine/simulation/exposure";
import { useWallBitmap } from "@/lib/useWallBitmap";
import { recordDailyRun } from "@/lib/streaks";

export default function PlanningPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const encoded = searchParams.get("p");

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const executeResultsUrlRef = useRef("");

  const {
    agentPositions,
    utilityPlacements,
    movementPaths,
    selectedAbilityKey,
    selectedAgentId,
    mode,
    initPlan,
    selectAbility,
    clearSelection,
    placeUtility,
    removeUtility,
    startMoveMode,
    startHoldMode,
    startPlaceMode,
    setMovePath,
    toggleHoldAtIndex,
    clearMovePath,
    updateAgentPosition,
    clearPlan,
    getPlan,
    setFromEncoded,
    handleDropAgent,
    undo,
    redo,
    past,
    future,
  } = usePlanStore();

  const initialEncoded = useRef(encoded);

  useEffect(() => {
    function sync() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    async function fetchScenario() {
      try {
        const res = await fetch("/api/scenarios/today");
        const json = (await res.json()) as { success: boolean; data?: ScenarioResponse; error?: string };
        if (json.success && json.data) {
          setScenario(json.data.scenario);
        } else {
          setError(json.error || "Failed to load scenario");
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    fetchScenario();
  }, []);

  useEffect(() => {
    if (!scenario) return;
    if (initialEncoded.current) {
      setFromEncoded(initialEncoded.current);
    } else {
      initPlan(scenario.id, []);
    }
  }, [scenario, initPlan, setFromEncoded]);

  useEffect(() => {
    if (!scenario) return;
    const plan = getPlan();
    if (plan.agentPositions.length > 0 || plan.utilityPlacements.length > 0) {
      const url = new URL(window.location.href);
      url.searchParams.set("p", encodePlan(plan));
      window.history.replaceState({}, "", url.toString());
    }
  }, [scenario, agentPositions, utilityPlacements, movementPaths, getPlan]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const usedCharges = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of utilityPlacements) {
      const key = `${u.type}:${u.agentId}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [utilityPlacements]);

  const totalUtilityCharges = useMemo(() => {
    return scenario?.availableUtility.reduce((sum, u) => sum + u.charges, 0) || 0;
  }, [scenario]);

  const canSimulate = useMemo(() => {
    if (!scenario) return false;
    const p = normalizePlayerPlan({
      scenarioId: scenario.id,
      agentSelection: agentPositions.map((a) => a.agentId),
      agentPositions,
      utilityPlacements,
      movementPaths,
      createdAt: new Date().toISOString(),
    });
    return isFinalExecuteSubmittable(scenario, p);
  }, [scenario, agentPositions, utilityPlacements, movementPaths]);

  const activeStep: 1 | 2 | 3 | 4 = useMemo(() => {
    if (!scenario) return 1;
    const total = scenario.availableAgents.length;
    if (agentPositions.length < total) return 1;
    if (utilityPlacements.length === 0) return 2;
    const allPaths = scenario.availableAgents.every((id) => {
      const mp = movementPaths.find((p) => p.agentId === id);
      return mp && mp.path.length >= 2;
    });
    if (!allPaths) return 3;
    return 4;
  }, [scenario, agentPositions, utilityPlacements, movementPaths]);

  const selectedAbilityInfo = useMemo(() => {
    if (!selectedAbilityKey) return null;
    const [type, agentId] = selectedAbilityKey.split(":");
    const agent = getAgentDef(agentId);
    const ability = agent?.abilities.find((a) => a.type === type && !a.isUltimate);
    return ability ? { type, agentId, agent, ability } : null;
  }, [selectedAbilityKey]);

  const wallBitmap = useWallBitmap(scenario?.minimapImage);

  /** Per-agent exposure summary for the Agent Rail + Briefing Rail. */
  const exposureByAgent = useMemo(() => {
    if (!scenario) return {} as Record<string, ReturnType<typeof computePathExposure>>;
    const out: Record<string, ReturnType<typeof computePathExposure>> = {};
    for (const mp of movementPaths) {
      const start = agentPositions.find((a) => a.agentId === mp.agentId)?.position;
      if (!start || mp.path.length < 2) continue;
      out[mp.agentId] = computePathExposure(
        scenario,
        start,
        mp.path,
        utilityPlacements,
        wallBitmap
      );
    }
    return out;
  }, [scenario, movementPaths, agentPositions, utilityPlacements, wallBitmap]);

  const squadExposure = useMemo(() => {
    const reports = Object.values(exposureByAgent);
    if (reports.length === 0) return 0;
    const avg = reports.reduce((s, r) => s + r.averageExposure, 0) / reports.length;
    return avg;
  }, [exposureByAgent]);

  const handleCanvasTap = useCallback(
    (position: Position) => {
      if (!scenario) return;

      if (mode === "ability" && selectedAbilityInfo) {
        const { type, agentId } = selectedAbilityInfo;
        const key = `${type}:${agentId}`;
        const avail = scenario.availableUtility.find((u) => u.type === type && u.agentId === agentId);
        const total = avail?.charges || 0;
        const used = usedCharges[key] || 0;
        if (used < total) {
          const agent = agentPositions.find((a) => a.agentId === agentId);
          const spec = getUtilityRenderSpec(agentId, type as UtilityType);
          let placementPos = position;
          let target: Position | undefined;

          if (agent && spec.shape !== "circle" && spec.shape !== "none") {
            if (agentId === "omen" && type === "flash") {
              placementPos = agent.position;
              target = position;
            } else if (agentId === "breach") {
              if (type === "flash" || type === "mollie") {
                placementPos = position;
                target = agent.position;
              } else if (type === "concussion") {
                placementPos = agent.position;
                target = position;
              }
            } else if (type === "wall") {
              placementPos = position;
              target = agent.position;
            }
          }

          placeUtility(type, agentId, placementPos, target);
        }
        clearSelection();
      } else if (mode === "move" && selectedAgentId) {
        const startNorm = agentPositions.find((a) => a.agentId === selectedAgentId)?.position;
        if (!startNorm) return;
        const def = getAgentDef(selectedAgentId);
        const role = def?.role || "initiator";
        const start = posToTile(startNorm);
        const end = posToTile(position);
        const path = findPath(scenario.grid, start, end, role, undefined, {
          maxCost: 9999,
          wallBitmap,
        });
        if (path && path.length > 1) {
          setMovePath(selectedAgentId, path.map(tileToPos));
        }
        clearSelection();
      } else if (mode === "hold" && selectedAgentId) {
        // Click on an existing path point to toggle a hold there. The map's
        // own hit-testing on hold diamonds handles removal; here we handle
        // "tap near a path point" by finding the nearest index.
        const mp = movementPaths.find((p) => p.agentId === selectedAgentId);
        if (!mp || mp.path.length < 2) return;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < mp.path.length; i++) {
          const dx = mp.path[i].x - position.x;
          const dy = mp.path[i].y - position.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDist) {
            bestDist = d2;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && bestDist < 0.0025) {
          toggleHoldAtIndex(selectedAgentId, bestIdx);
        }
      } else if (mode === "place" && selectedAgentId) {
        const tile = posToTile(position);
        const valid = isSpawnable(scenario.grid, tile, scenario.spikeSite, 3.5, scenario.spawnZones);
        if (valid) {
          handleDropAgent(selectedAgentId, tileToPos(tile), true);
        } else {
          clearSelection();
        }
      }
    },
    [
      mode,
      selectedAbilityInfo,
      selectedAgentId,
      agentPositions,
      scenario,
      usedCharges,
      movementPaths,
      placeUtility,
      clearSelection,
      setMovePath,
      toggleHoldAtIndex,
      handleDropAgent,
      wallBitmap,
    ]
  );

  const handleSelectAgentFromRail = useCallback(
    (agentId: string) => {
      const placed = agentPositions.some((a) => a.agentId === agentId);
      if (!placed) {
        startPlaceMode(agentId);
        return;
      }
      startMoveMode(agentId);
    },
    [agentPositions, startPlaceMode, startMoveMode]
  );

  const pathsDrawn = useMemo(
    () =>
      agentPositions.filter((ap) => {
        const mp = movementPaths.find((p) => p.agentId === ap.agentId);
        return mp && mp.path.length >= 2;
      }).length,
    [agentPositions, movementPaths]
  );

  const handleSimulate = async () => {
    if (!scenario || !canSimulate) return;
    setSubmitting(true);
    setError(null);
    try {
      const plan = { ...getPlan(), createdAt: new Date().toISOString() };
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const text = await res.text();
      let json: { success: boolean; data?: SubmitPlanResponse; error?: string };
      try {
        json = JSON.parse(text) as { success: boolean; data?: SubmitPlanResponse; error?: string };
      } catch {
        setError(text.slice(0, 200) || `Bad response (${res.status})`);
        return;
      }
      if (json.success && json.data) {
        setActiveRunId(json.data.planId);
      } else {
        setError(json.error || "Failed to submit");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during submission");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Called by the interactive player once the full run finalises — we then
   * hand the resulting log/outcome off to the results page for grading and
   * rank display.
   */
  const handleRunComplete = useCallback(
    (payload: FinalRunPayload) => {
      if (!scenario) return;
      try {
        recordDailyRun(
          scenario.id,
          payload.outcome.score,
          payload.outcome.tier,
          payload.outcome.maxScore
        );
      } catch {
        /* localStorage disabled; ignore */
      }
      const out = encodeUtf8JsonForQueryParam(payload);
      executeResultsUrlRef.current = `/results?d=${out}&autoplay=0`;
      router.push(executeResultsUrlRef.current);
      setActiveRunId(null);
    },
    [router, scenario]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border border-amber border-t-transparent" />
          <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-mute">Loading scenario</p>
        </div>
      </main>
    );
  }

  if (error || !scenario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <p className="font-mono text-sm text-valorant-red">{error || "No scenario available"}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 font-mono text-xs text-ink-mute hover:text-ink"
          >
            ← Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-bg">
      <PlanningTopBar
        scenarioName={scenario.name}
        mapName={scenario.map}
        activeStep={activeStep}
        onBack={() => router.push("/")}
        onHelp={() => setHelpOpen(true)}
        onUndo={undo}
        onRedo={redo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
      />

      <div className="flex flex-1 min-h-0">
        <AgentRail
          scenario={scenario}
          agentPositions={agentPositions}
          utilityPlacements={utilityPlacements}
          movementPaths={movementPaths}
          exposureByAgent={exposureByAgent}
          selectedAgentId={selectedAgentId}
          selectedAbilityKey={selectedAbilityKey}
          mode={mode}
          onStartPlace={startPlaceMode}
          onSelectAgent={handleSelectAgentFromRail}
          onSelectAbility={(agentId, type) => selectAbility(agentId, type)}
          onStartMovePath={(id) => startMoveMode(id)}
          onStartHoldMode={(id) => startHoldMode(id)}
          onClearMovePath={(id) => clearMovePath(id)}
        />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <TacticalMap
              scenario={scenario}
              agentPositions={agentPositions}
              utilityPlacements={utilityPlacements}
              movementPaths={movementPaths}
              selectedAgentId={selectedAgentId}
              selectedAbilityKey={selectedAbilityKey}
              mode={mode}
              onCanvasTap={handleCanvasTap}
              onAgentSelect={handleSelectAgentFromRail}
              onDropAgent={handleDropAgent}
              onDragAgent={(agentId, position, valid) => {
                if (valid) {
                  updateAgentPosition(agentId, position);
                  clearMovePath(agentId);
                }
              }}
              onTogglePathHold={(agentId, pathIndex) => toggleHoldAtIndex(agentId, pathIndex)}
            />

            <MapLegend />

            {mode === "ability" && selectedAbilityInfo && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-amber/25 bg-amber/10 px-4 py-1.5 text-[11px] uppercase tracking-wide text-amber backdrop-blur">
                Tap the map to place <span className="font-semibold">{selectedAbilityInfo.ability.name}</span>
              </div>
            )}

            {mode === "move" && selectedAgentId && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-teal/30 bg-teal/10 px-4 py-1.5 text-[11px] uppercase tracking-wide text-teal backdrop-blur">
                Drawing path · tap map to set destination
              </div>
            )}

            {mode === "hold" && selectedAgentId && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-amber/30 bg-amber/10 px-4 py-1.5 text-[11px] uppercase tracking-wide text-amber backdrop-blur">
                Hold mode · tap a point on the path to pause &amp; hold an angle
              </div>
            )}

            {mode === "place" && selectedAgentId && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-amber/30 bg-amber/10 px-4 py-1.5 text-[11px] uppercase tracking-wide text-amber backdrop-blur">
                Tap a highlighted tile to drop {getAgentDef(selectedAgentId)?.displayName ?? "agent"}
              </div>
            )}
          </div>

          <UtilityBay
            utilityPlacements={utilityPlacements}
            totalUtilityCharges={totalUtilityCharges}
            canSimulate={canSimulate}
            simulating={submitting}
            onClear={clearPlan}
            onSimulate={handleSimulate}
            onRemoveUtility={removeUtility}
          />
        </div>

        <BriefingRail
          scenario={scenario}
          agentsPlaced={agentPositions.length}
          agentsTotal={scenario.availableAgents.length}
          utilityDrafted={utilityPlacements.length}
          pathsDrawn={pathsDrawn}
          activeStep={activeStep}
          averageExposure={squadExposure}
        />
      </div>

      {activeRunId && (
        <div className="fixed inset-0 z-[70] bg-pure-black">
          <InteractiveCinematicPlayer
            planId={activeRunId}
            scenario={scenario}
            width={viewport.w}
            height={viewport.h}
            onComplete={handleRunComplete}
            onAbort={() => setActiveRunId(null)}
          />
        </div>
      )}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <OnboardingCoachmark activeStep={activeStep} />
    </main>
  );
}
