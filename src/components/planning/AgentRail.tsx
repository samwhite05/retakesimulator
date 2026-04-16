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

function Chip({
  active,
  disabled,
  onClick,
  children,
  tone = "neutral",
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "amber" | "teal" | "red" | "violet";
  title?: string;
}) {
  const toneMap: Record<string, string> = {
    neutral: active
      ? "border-border-12 bg-elevated text-ink"
      : "border-border-08 text-ink-dim hover:border-border-12 hover:text-ink",
    amber: active
      ? "border-amber/60 bg-amber/15 text-amber"
      : "border-amber/25 text-amber/80 hover:border-amber/50 hover:bg-amber/10",
    teal: active
      ? "border-teal/60 bg-teal/15 text-teal"
      : "border-teal/25 text-teal/80 hover:border-teal/50 hover:bg-teal/10",
    red: active
      ? "border-valorant-red/60 bg-valorant-red/15 text-valorant-red"
      : "border-valorant-red/25 text-valorant-red/80 hover:border-valorant-red/50 hover:bg-valorant-red/10",
    violet: active
      ? "border-violet/60 bg-violet/15 text-violet"
      : "border-violet/25 text-violet/80 hover:border-violet/50 hover:bg-violet/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors disabled:opacity-30 disabled:pointer-events-none ${toneMap[tone]}`}
    >
      {children}
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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-ink-mute">
        <span>Exposure</span>
        <span className="font-semibold" style={{ color: color.stroke }}>
          {avgPct}% · {color.label}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-elevated ring-1 ring-border-06">
        {teal > 0 && <div className="bg-teal" style={{ width: `${teal}%` }} />}
        {amber > 0 && <div className="bg-amber" style={{ width: `${amber}%` }} />}
        {red > 0 && <div className="bg-valorant-red" style={{ width: `${red}%` }} />}
      </div>
    </div>
  );
}

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

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-border-06 bg-pure-black/60">
      <div className="border-b border-border-06 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">Your squad</div>
        <div className="mt-0.5 text-sm text-ink-dim">
          {agentPositions.length} / {scenario.availableAgents.length} placed
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {roster.map((entry) => {
          const def = getAgentDef(entry.agentId);
          if (!def) return null;
          const eliminated = entry.eliminated;
          const placed = agentPositions.some((a) => a.agentId === entry.agentId);
          const isActive = selectedAgentId === entry.agentId;
          const mp = movementPaths.find((p) => p.agentId === entry.agentId);
          const hasPath = !!mp && mp.path.length >= 2;
          const holdCount = mp?.holds?.length ?? 0;
          const summary = exposureByAgent[entry.agentId];
          const abilities = def.abilities.filter((a) => !a.isUltimate);

          const iconUrl = getAgentIconUrl(entry.agentId);
          const baseClasses =
            "group relative mb-1.5 rounded-lg border bg-surface/40 text-left transition-colors";
          const stateClasses = eliminated
            ? "border-border-04 opacity-40"
            : isActive
              ? "border-amber/40 bg-amber/5 ring-1 ring-amber/20"
              : placed
                ? "border-border-10 hover:border-border-12"
                : "border-dashed border-border-10 hover:border-amber/40";

          return (
            <div key={entry.agentId} className={`${baseClasses} ${stateClasses}`}>
              <button
                type="button"
                disabled={eliminated}
                onClick={() => (placed ? onSelectAgent(entry.agentId) : onStartPlace(entry.agentId))}
                className="flex w-full items-center gap-3 px-3 pt-2.5 pb-1.5 disabled:cursor-not-allowed"
              >
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-elevated ring-1 ring-border-08">
                  {iconUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrl} alt={def.displayName} className="h-full w-full object-cover" />
                  )}
                  {eliminated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-pure-black/60 text-[9px] font-bold text-valorant-red">
                      KIA
                    </div>
                  )}
                  {!placed && !eliminated && (
                    <div className="absolute inset-0 flex items-center justify-center bg-pure-black/70 text-[9px] font-bold text-amber">
                      TAP
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-semibold text-ink">{def.displayName}</div>
                    {placed && (
                      <div className="flex items-center gap-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${hasPath ? "bg-teal" : "bg-ink-mute/40"}`}
                          title={hasPath ? "Path drawn" : "Path needed"}
                        />
                        {holdCount > 0 && (
                          <span
                            className="text-[9px] font-mono text-amber"
                            title={`${holdCount} hold waypoint${holdCount === 1 ? "" : "s"}`}
                          >
                            ◆{holdCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-mute">{roleLabel[def.role]}</div>
                </div>
              </button>

              {placed && !eliminated && (
                <div className="px-3 pb-2.5 pt-0.5 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {abilities.map((ability) => {
                      const avail = scenario.availableUtility.find(
                        (u) => u.type === ability.type && u.agentId === def.id
                      );
                      const total = avail?.charges ?? 0;
                      if (total === 0) return null;
                      const key = `${ability.type}:${def.id}`;
                      const used = usedCharges[key] || 0;
                      const remaining = Math.max(0, total - used);
                      const active = selectedAbilityKey === key && mode === "ability";
                      const iconUrl = getAbilityIconUrl(ability.name);
                      return (
                        <button
                          key={ability.type}
                          type="button"
                          disabled={remaining === 0}
                          onClick={() => onSelectAbility(def.id, ability.type)}
                          title={`${ability.name} · ${remaining} left`}
                          className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[10px] transition-colors disabled:opacity-30 disabled:pointer-events-none ${
                            active
                              ? "border-amber/60 bg-amber/15 text-amber"
                              : "border-border-08 text-ink-dim hover:border-amber/40 hover:bg-amber/5"
                          }`}
                        >
                          {iconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={iconUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                          )}
                          <span className="font-medium">{remaining}</span>
                          <span className="text-ink-mute">/{total}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Chip
                      tone="teal"
                      active={mode === "move" && selectedAgentId === def.id}
                      onClick={() => onStartMovePath(def.id)}
                      title="Draw a path from this agent to the site"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 12h14M13 6l6 6-6 6" />
                      </svg>
                      {hasPath ? "Re-draw" : "Draw path"}
                    </Chip>

                    {hasPath && (
                      <Chip
                        tone="amber"
                        active={mode === "hold" && selectedAgentId === def.id}
                        onClick={() => onStartHoldMode(def.id)}
                        title="Tap any point on the path to add or remove a hold (pause + hold angle)"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        Hold ◆
                      </Chip>
                    )}

                    {hasPath && (
                      <Chip tone="neutral" onClick={() => onClearMovePath(def.id)} title="Clear path">
                        ✕
                      </Chip>
                    )}
                  </div>

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
