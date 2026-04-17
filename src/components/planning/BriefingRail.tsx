"use client";

import type { Scenario } from "@/types";
import { exposureColor } from "@/engine/simulation/exposure";

interface BriefingRailProps {
  scenario: Scenario;
  agentsPlaced: number;
  agentsTotal: number;
  utilityDrafted: number;
  pathsDrawn: number;
  activeStep: 1 | 2 | 3 | 4;
  /** Squad-wide average exposure across all drawn paths, 0..1. */
  averageExposure: number;
}

const PHASE_HINTS: Record<number, { title: string; body: string }> = {
  1: {
    title: "Drop your squad",
    body: "Tap an agent in the rail, then tap a spawn tile. Re-tap to reposition before you lock a plan.",
  },
  2: {
    title: "Draft pre-contact util",
    body: "Only util you want fired before first contact goes here. Save your reactive smokes + mollies for live calls mid-retake.",
  },
  3: {
    title: "Draw your default-side path",
    body: "One path per agent from spawn up to first-contact. The sim pauses at contact and asks you live questions — don't over-plan it.",
  },
  4: {
    title: "Commit & execute",
    body: "One official commit per day. After first contact, you'll be asked to make live tactical calls under a 10-second clock.",
  },
};

/* ── Section header ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-mute">
      {children}
    </div>
  );
}

/* ── Compact checklist row ──────────────────────────────────────────────── */

function ChecklistRow({
  step,
  label,
  value,
  state,
}: {
  step: number;
  label: string;
  value: string;
  state: "done" | "active" | "pending";
}) {
  const bullet = (() => {
    if (state === "done") {
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal/90 text-[9px] font-bold text-pure-black">
          ✓
        </span>
      );
    }
    if (state === "active") {
      return (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber text-[9px] font-bold text-pure-black">
          {step}
        </span>
      );
    }
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border-10 text-[9px] font-semibold text-ink-mute">
        {step}
      </span>
    );
  })();

  const labelColor =
    state === "active" ? "text-ink" : state === "done" ? "text-ink-dim" : "text-ink-mute";

  return (
    <div className="flex items-center gap-2.5 py-1">
      {bullet}
      <div className={`flex-1 text-[11px] ${labelColor}`}>{label}</div>
      <div
        className={`font-mono text-[10px] ${
          state === "active" ? "text-ink" : state === "done" ? "text-teal" : "text-ink-mute"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Refined rule row ───────────────────────────────────────────────────── */

function RuleRow({
  description,
  points,
  category,
}: {
  description: string;
  points: number;
  category: string;
}) {
  const dotMap: Record<string, string> = {
    critical: "bg-valorant-red",
    important: "bg-amber",
    minor: "bg-ink-mute/60",
  };
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotMap[category] ?? dotMap.minor}`}
      />
      <span className="flex-1 text-[11px] leading-snug text-ink-dim">{description}</span>
      <span className="shrink-0 font-mono text-[10px] font-semibold text-ink">+{points}</span>
    </div>
  );
}

/* ── Main rail ──────────────────────────────────────────────────────────── */

export default function BriefingRail({
  scenario,
  agentsPlaced,
  agentsTotal,
  utilityDrafted,
  pathsDrawn,
  activeStep,
  averageExposure,
}: BriefingRailProps) {
  const hint = PHASE_HINTS[activeStep];
  const totalEnemies = scenario.enemyAgents.length + scenario.hiddenEnemies.length;
  const hiddenCount = scenario.hiddenEnemies.length;
  const exposurePct = Math.round(averageExposure * 100);
  const exposureVisual = exposureColor(averageExposure);

  // Step states for the checklist
  const stepState = (id: 1 | 2 | 3 | 4): "done" | "active" | "pending" => {
    if (id < activeStep) return "done";
    if (id === activeStep) return "active";
    return "pending";
  };

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-border-06 bg-pure-black/70">
      {/* Header */}
      <div className="border-b border-border-06 px-4 pt-4 pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-mute">
          Briefing
        </div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">{scenario.name}</div>
        <div className="mt-0.5 text-[11px] text-ink-mute">
          {scenario.map.toUpperCase()} · {totalEnemies} defender{totalEnemies === 1 ? "" : "s"}
          {hiddenCount > 0 && (
            <span className="text-ink-mute"> · {hiddenCount} unknown</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Current objective ────────────────────────────────────────── */}
        <section className="px-4 pt-4 pb-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Now</SectionLabel>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
              Step {activeStep}/4
            </span>
          </div>
          <div className="mt-2 text-[14px] font-semibold leading-tight text-ink">{hint.title}</div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">{hint.body}</div>
        </section>

        <div className="mx-4 border-t border-border-06" />

        {/* ── Progress checklist ───────────────────────────────────────── */}
        <section className="px-4 pt-4 pb-4">
          <SectionLabel>Progress</SectionLabel>
          <div className="mt-2">
            <ChecklistRow
              step={1}
              label="Place squad"
              value={`${agentsPlaced}/${agentsTotal}`}
              state={stepState(1)}
            />
            <ChecklistRow
              step={2}
              label="Draft utility"
              value={utilityDrafted > 0 ? `${utilityDrafted}` : "—"}
              state={stepState(2)}
            />
            <ChecklistRow
              step={3}
              label="Draw paths"
              value={`${pathsDrawn}/${agentsTotal}`}
              state={stepState(3)}
            />
            <div className="flex items-center gap-2.5 py-1">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full ${
                  activeStep === 4
                    ? "bg-amber text-pure-black"
                    : "border border-border-10 text-ink-mute"
                } text-[9px] font-bold`}
              >
                4
              </span>
              <div
                className={`flex-1 text-[11px] ${
                  activeStep === 4 ? "text-ink" : "text-ink-mute"
                }`}
              >
                Squad exposure
              </div>
              <div
                className="font-mono text-[10px]"
                style={{ color: pathsDrawn > 0 ? exposureVisual.stroke : undefined }}
              >
                {pathsDrawn > 0 ? `${exposurePct}%` : "—"}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-4 border-t border-border-06" />

        {/* ── Scoring ──────────────────────────────────────────────────── */}
        <section className="px-4 pt-4 pb-5">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Scoring</SectionLabel>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
              {scenario.rules.length} rule{scenario.rules.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 divide-y divide-border-06">
            {scenario.rules.slice(0, 6).map((r) => (
              <RuleRow
                key={r.id}
                description={r.description}
                points={r.points}
                category={r.category}
              />
            ))}
          </div>
          {scenario.rules.length > 6 && (
            <div className="pt-2 text-[10px] text-ink-mute">
              + {scenario.rules.length - 6} more
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
