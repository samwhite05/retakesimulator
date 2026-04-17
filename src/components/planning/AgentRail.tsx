"use client";

import type {
  AgentPosition,
  MovementPath,
  Scenario,
  UtilityType,
  UtilityItem,
} from "@/types";
import { getAgentDef } from "@/lib/constants";
import { getAbilityIconUrl, getAgentIconUrl } from "@/lib/assets";
import { exposureColor } from "@/engine/simulation/exposure";

type Mode = "none" | "ability" | "move" | "hold" | "place";

export interface PathExposureSummary {
  averageExposure: number;
  redFraction: number;
  amberFraction: number;
  tealFraction: number;
}

interface AgentRailProps {
  scenario: Scenario;
  agentPositions: AgentPosition[];
  utilityPlacements: UtilityItem[];
  movementPaths: MovementPath[];
  /** Optional per-agent exposure report (keyed by agent id). */
  exposureByAgent: Record<string, PathExposureSummary>;
  selectedAgentId: string | null;
  selectedAbilityKey: string | null;
  mode: Mode;
  onStartPlace: (agentId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onSelectAbility: (agentId: string, type: UtilityType) => void;
  onStartMovePath: (agentId: string) => void;
  onStartHoldMode: (agentId: string) => void;
  onClearMovePath: (agentId: string) => void;
}

const roleLabel: Record<string, string> = {
  duelist: "Duelist",
  initiator: "Initiator",
  controller: "Controller",
  sentinel: "Sentinel",
};

/* ── Small, reusable primitives ─────────────────────────────────────────── */

function IconAction({
  active,
  disabled,
  tone = "neutral",
  onClick,
  title,
  label,
  icon,
}: {
  active?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "amber" | "teal";
  onClick?: () => void;
  title?: string;
  label: string;
  icon: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    neutral: active
      ? "border-border-12 bg-elevated text-ink"
      : "border-border-08 text-ink-dim hover:border-border-12 hover:bg-surface hover:text-ink",
    teal: active
      ? "border-teal/50 bg-teal/10 text-teal"
      : "border-border-08 text-ink-dim hover:border-teal/40 hover:bg-teal/[0.06] hover:text-teal",
    amber: active
      ? "border-amber/50 bg-amber/10 text-amber"
      : "border-border-08 text-ink-dim hover:border-amber/40 hover:bg-amber/[0.06] hover:text-amber",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[10px] font-medium uppercase tracking-[0.08em] transition-colors disabled:opacity-30 disabled:pointer-events-none ${toneMap[tone]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ExposureBar({ summary }: { summary: PathExposureSummary }) {
  const red = Math.round(summary.redFraction * 100);
  const amber = Math.round(summary.amberFraction * 100);
  const teal = Math.max(0, 100 - red - amber);
  const avgPct = Math.round(summary.averageExposure * 100);
  const color = exposureColor(summary.averageExposure);
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.18em] text-ink-mute">
        <span>Exposure</span>
        <span className="font-semibold" style={{ color: color.stroke }}>
          {avgPct}%
        </span>
      </div>
      <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-pure-black/60 ring-1 ring-border-06">
        {teal > 0 && <div className="bg-teal/80" style={{ width: `${teal}%` }} />}
        {amber > 0 && <div className="bg-amber/80" style={{ width: `${amber}%` }} />}
        {red > 0 && <div className="bg-valorant-red/80" style={{ width: `${red}%` }} />}
      </div>
    </div>
  );
}

/* ── Main rail ─────────────────────────────────────────────────────────── */

export default function AgentRail({
  scenario,
  agentPositions,
  utilityPlacements,
  movementPaths,
  exposureByAgent,
  selectedAgentId,
  selectedAbilityKey,
  mode,
  onStartPlace,
  onSelectAgent,
  onSelectAbility,
  onStartMovePath,
  onStartHoldMode,
  onClearMovePath,
}: AgentRailProps) {
  const roster = scenario.planningRoster ?? scenario.availableAgents.map((id) => ({ agentId: id, eliminated: false }));

  const usedCharges: Record<string, number> = {};
  for (const u of utilityPlacements) {
    const key = `${u.type}:${u.agentId}`;
    usedCharges[key] = (usedCharges[key] || 0) + 1;
  }

  const total = scenario.availableAgents.length;
  const placed = agentPositions.length;
  const placedPct = total > 0 ? Math.round((placed / total) * 100) : 0;

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-border-06 bg-pure-black/70">
      {/* Header */}
      <div className="border-b border-border-06 px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">Squad</div>
          <div className="font-mono text-[11px] text-ink-dim">
            <span className="text-ink">{placed}</span>
            <span className="text-ink-mute">/{total}</span>
          </div>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-amber transition-[width] duration-300"
            style={{ width: `${placedPct}%` }}
          />
        </div>
      </div>

      {/* Roster */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {roster.map((entry) => {
          const def = getAgentDef(entry.agentId);
          if (!def) return null;
          const eliminated = entry.eliminated;
          const isPlaced = agentPositions.some((a) => a.agentId === entry.agentId);
          const isActive = selectedAgentId === entry.agentId;
          const mp = movementPaths.find((p) => p.agentId === entry.agentId);
          const hasPath = !!mp && mp.path.length >= 2;
          const holdCount = mp?.holds?.length ?? 0;
          const summary = exposureByAgent[entry.agentId];
          const abilities = def.abilities.filter((a) => !a.isUltimate);

          const iconUrl = getAgentIconUrl(entry.agentId);

          const rowState = eliminated
            ? "opacity-40"
            : isActive
              ? "bg-amber/[0.04] ring-1 ring-inset ring-amber/25"
              : isPlaced
                ? "hover:bg-surface/60"
                : "hover:bg-surface/60";

          return (
            <div
              key={entry.agentId}
              className={`mb-1 rounded-md transition-colors ${rowState}`}
            >
              {/* Primary row */}
              <button
                type="button"
                disabled={eliminated}
                onClick={() => (isPlaced ? onSelectAgent(entry.agentId) : onStartPlace(entry.agentId))}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left disabled:cursor-not-allowed"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-elevated ring-1 ring-border-08">
                  {iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={iconUrl}
                      alt={def.displayName}
                      className={`h-full w-full object-cover ${eliminated ? "grayscale" : ""}`}
                    />
                  )}
                  {eliminated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-pure-black/70 text-[9px] font-bold tracking-wider text-valorant-red">
                      KIA
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold leading-tight text-ink">
                    {def.displayName}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    {roleLabel[def.role]}
                  </div>
                </div>

                {/* Status */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {!isPlaced && !eliminated && (
                    <span className="rounded-sm border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber">
                      Place
                    </span>
                  )}
                  {isPlaced && !eliminated && (
                    <>
                      {holdCount > 0 && (
                        <span
                          className="font-mono text-[9px] text-amber"
                          title={`${holdCount} hold waypoint${holdCount === 1 ? "" : "s"}`}
                        >
                          ◆{holdCount}
                        </span>
                      )}
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          hasPath ? "bg-teal" : "bg-ink-mute/40"
                        }`}
                        title={hasPath ? "Path drawn" : "Path needed"}
                      />
                    </>
                  )}
                </div>
              </button>

              {/* Expanded drawer: abilities + actions + exposure */}
              {isPlaced && !eliminated && (
                <div className="space-y-2.5 border-t border-border-06 px-2.5 pt-2 pb-2.5">
                  {/* Abilities */}
                  {abilities.some((ability) => {
                    const avail = scenario.availableUtility.find(
                      (u) => u.type === ability.type && u.agentId === def.id
                    );
                    return (avail?.charges ?? 0) > 0;
                  }) && (
                    <div>
                      <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
                        Abilities
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {abilities.map((ability) => {
                          const avail = scenario.availableUtility.find(
                            (u) => u.type === ability.type && u.agentId === def.id
                          );
                          const totalCharges = avail?.charges ?? 0;
                          if (totalCharges === 0) return null;
                          const key = `${ability.type}:${def.id}`;
                          const used = usedCharges[key] || 0;
                          const remaining = Math.max(0, totalCharges - used);
                          const active = selectedAbilityKey === key && mode === "ability";
                          const iconUrl = getAbilityIconUrl(ability.name);
                          const depleted = remaining === 0;
                          return (
                            <button
                              key={ability.type}
                              type="button"
                              disabled={depleted}
                              onClick={() => onSelectAbility(def.id, ability.type)}
                              title={`${ability.name} — ${remaining}/${totalCharges} charges`}
                              className={`relative flex h-9 items-center gap-1.5 rounded-md border px-1.5 transition-colors disabled:cursor-not-allowed ${
                                active
                                  ? "border-amber/60 bg-amber/10"
                                  : depleted
                                    ? "border-border-06 bg-pure-black/30 opacity-40"
                                    : "border-border-08 bg-surface/40 hover:border-amber/35 hover:bg-amber/[0.05]"
                              }`}
                            >
                              <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-sm bg-pure-black/40">
                                {iconUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={iconUrl} alt="" className="h-5 w-5 object-contain" />
                                )}
                              </div>
                              <div className="flex items-baseline gap-0.5 pr-0.5 font-mono text-[10px] leading-none">
                                <span className={active ? "text-amber" : depleted ? "text-ink-mute" : "text-ink"}>
                                  {remaining}
                                </span>
                                <span className="text-ink-mute">/{totalCharges}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1">
                    <IconAction
                      tone="teal"
                      active={mode === "move" && selectedAgentId === def.id}
                      onClick={() => onStartMovePath(def.id)}
                      label={hasPath ? "Re-route" : "Route"}
                      title={hasPath ? "Draw a new path" : "Draw path to the site"}
                      icon={
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 17l6-6 4 4 6-8" />
                        </svg>
                      }
                    />
                    {/* Hold mode is disabled in the interactive model —
                         mid-retake pauses replace upfront hold waypoints. */}
                    {hasPath && (
                      <button
                        type="button"
                        onClick={() => onClearMovePath(def.id)}
                        title="Clear path"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border-08 text-ink-mute transition-colors hover:border-valorant-red/40 hover:text-valorant-red"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Exposure */}
                  {hasPath && summary && <ExposureBar summary={summary} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
