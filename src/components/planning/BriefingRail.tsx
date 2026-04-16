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
    title: "Draft your utility",
    body: "Tap an ability under an agent, then tap the map. Smokes cut vision, mollies clear corners, flashes buy entry — and they actively lower your exposure.",
  },
  3: {
    title: "Draw paths",
    body: "One path per agent, from their spawn to the site. Segments color by exposure: teal = safe, amber = trade, red = open. Add a ◆ hold to pause and hold an angle anywhere along the path.",
  },
  4: {
    title: "Ready to simulate",
    body: "One official run per day. If your squad-wide exposure is high, consider smoking the red segments before you press Simulate.",
  },
};

function RuleRow({ description, points, category }: { description: string; points: number; category: string }) {
  const toneMap: Record<string, string> = {
    critical: "border-valorant-red/30 bg-valorant-red/5 text-valorant-red",
    important: "border-amber/30 bg-amber/5 text-amber",
    minor: "border-border-10 bg-surface text-ink-dim",
  };
  return (
    <div className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-[11px] ${toneMap[category] ?? toneMap.minor}`}>
      <span className="leading-snug">{description}</span>
      <span className="shrink-0 font-mono text-[11px] font-semibold">+{points}</span>
    </div>
  );
}

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

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-border-06 bg-pure-black/60">
      <div className="border-b border-border-06 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">Briefing</div>
        <div className="mt-0.5 text-sm font-medium text-ink">{scenario.name}</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            <span className="h-1 w-1 rounded-full bg-amber" /> Situation
          </div>
          <div className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-dim">
            <div>
              Spike planted on <span className="text-ink">{scenario.map.toUpperCase()}</span>.
            </div>
            <div>
              <span className="text-ink">{totalEnemies} defenders</span> on-site ({hiddenCount} position unknown).
            </div>
            <div>
              You have <span className="text-ink">{agentsTotal} operators</span>. Re-take before the spike detonates.
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-amber/20 bg-amber/5 px-3 py-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-amber">
            <span className="h-1 w-1 rounded-full bg-amber" /> What&apos;s next
          </div>
          <div className="mt-1 text-[13px] font-semibold text-ink">{hint.title}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-ink-dim">{hint.body}</div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="flex items-center justify-between rounded border border-border-08 bg-pure-black/40 px-2 py-1">
              <span className="text-ink-mute">Placed</span>
              <span className="font-mono text-ink">{agentsPlaced}/{agentsTotal}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-border-08 bg-pure-black/40 px-2 py-1">
              <span className="text-ink-mute">Utility</span>
              <span className="font-mono text-ink">{utilityDrafted}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-border-08 bg-pure-black/40 px-2 py-1">
              <span className="text-ink-mute">Paths</span>
              <span className="font-mono text-ink">{pathsDrawn}/{agentsTotal}</span>
            </div>
            <div
              className="flex items-center justify-between rounded border px-2 py-1"
              style={{
                borderColor: `${exposureVisual.stroke}33`,
                backgroundColor: `${exposureVisual.stroke}0d`,
              }}
            >
              <span className="text-ink-mute">Exposure</span>
              <span className="font-mono" style={{ color: exposureVisual.stroke }}>
                {pathsDrawn > 0 ? `${exposurePct}%` : "—"}
              </span>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
            <span className="h-1 w-1 rounded-full bg-teal" /> How you&apos;re graded
          </div>
          <div className="mt-2 space-y-1.5">
            {scenario.rules.slice(0, 6).map((r) => (
              <RuleRow key={r.id} description={r.description} points={r.points} category={r.category} />
            ))}
            {scenario.rules.length > 6 && (
              <div className="pl-1 pt-1 text-[10px] text-ink-mute">+ {scenario.rules.length - 6} more rules</div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
