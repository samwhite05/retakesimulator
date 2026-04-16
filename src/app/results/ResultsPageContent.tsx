"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SubmitPlanResponse, Scenario, ScenarioResponse, GameEvent } from "@/types";
import CinematicPlayer from "@/components/animation/CinematicPlayer";
import { decodeUtf8JsonFromQueryParam } from "@/lib/urlUtf8Payload";
import { gradeForScore, gradeColor } from "@/lib/streaks";
import GradeCardDownload from "@/components/results/GradeCardDownload";

interface KeyMoment {
  tLabel: string;
  phase: string;
  title: string;
  detail: string;
  tone: "teal" | "amber" | "red" | "violet";
}

function summarizeMoments(log: SubmitPlanResponse["log"]): KeyMoment[] {
  const out: KeyMoment[] = [];
  let tSec = 0;
  const phaseLabel: Record<string, string> = {
    setup: "Load-in",
    utility: "Utility",
    movement_entry: "Entry",
    movement_reposition: "Re-site",
    combat: "Combat",
    spike: "Spike",
  };
  for (const turn of log.turns) {
    const phaseBump = turn.phase === "setup" ? 0 : turn.phase === "utility" ? 2 : turn.phase === "movement_entry" ? 3 : turn.phase === "movement_reposition" ? 4 : turn.phase === "combat" ? 3 : 2;
    tSec += phaseBump;
    for (const e of turn.events) {
      const at = `${String(Math.floor(tSec / 60)).padStart(1, "0")}:${String(tSec % 60).padStart(2, "0")}`;
      const momentForEvent = matchMomentEvent(e, at, phaseLabel[turn.phase] ?? turn.phase);
      if (momentForEvent) out.push(momentForEvent);
      tSec += 1;
    }
  }
  return out.slice(0, 8);
}

function matchMomentEvent(e: GameEvent, at: string, phase: string): KeyMoment | null {
  switch (e.type) {
    case "kill":
      return {
        tLabel: at,
        phase,
        title: `${e.killer} → ${e.victim}`,
        detail: "Fragged a defender.",
        tone: "teal",
      };
    case "duel":
      if (e.winner !== e.attacker) {
        return {
          tLabel: at,
          phase,
          title: `${e.attacker} lost duel`,
          detail: `${e.defender} won the first contact.`,
          tone: "red",
        };
      }
      return null;
    case "smoke_expand":
      return {
        tLabel: at,
        phase,
        title: `${e.agentId} smoke`,
        detail: "Cut a defender sightline.",
        tone: "violet",
      };
    case "flash_detonate":
      return {
        tLabel: at,
        phase,
        title: `${e.agentId} flash popped`,
        detail: "Blinded the hold.",
        tone: "amber",
      };
    case "mollie_erupt":
      return {
        tLabel: at,
        phase,
        title: `${e.agentId} mollie`,
        detail: "Cleared a corner.",
        tone: "amber",
      };
    case "trap_trigger":
      return {
        tLabel: at,
        phase,
        title: "Trap hit",
        detail: `${e.victim} caught by ${e.agentId}.`,
        tone: "red",
      };
    case "defuse_complete":
      return {
        tLabel: at,
        phase,
        title: `${e.agentId} defused`,
        detail: "Spike neutralized.",
        tone: "teal",
      };
    case "spike_explosion":
      return {
        tLabel: at,
        phase,
        title: "Spike detonated",
        detail: "Round lost.",
        tone: "red",
      };
    default:
      return null;
  }
}

export default function ResultsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d");
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const autoplayOff = searchParams.get("autoplay") === "0" || searchParams.get("autoplay") === "false";
  const [showCinematic, setShowCinematic] = useState(!autoplayOff);
  const [data, setData] = useState<SubmitPlanResponse | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!encoded) {
      router.push("/");
      return;
    }
    try {
      const parsed = decodeUtf8JsonFromQueryParam<SubmitPlanResponse>(encoded);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(parsed);
    } catch {
      router.push("/");
      return;
    }

    async function fetchScenario() {
      const res = await fetch("/api/scenarios/today");
      const json = (await res.json()) as { success: boolean; data?: ScenarioResponse };
      if (json.success && json.data) {
        setScenario(json.data.scenario);
      }
      setLoading(false);
    }
    fetchScenario();
  }, [encoded, router]);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [showCinematic]);

  const handleCinematicComplete = useCallback(() => {
    setShowCinematic(false);
  }, []);

  const moments = useMemo<KeyMoment[]>(() => (data ? summarizeMoments(data.log) : []), [data]);

  if (loading || !data || !scenario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border border-amber border-t-transparent" />
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-mute">Loading results</p>
        </div>
      </main>
    );
  }

  const { outcome, log, rank, total } = data;
  const totalPoints = outcome.scoreBreakdown.reduce((sum, r) => sum + r.maxPoints, 0) || outcome.maxScore || 1;
  const percentile = rank && total ? Math.max(1, Math.round(100 - ((rank - 1) / Math.max(1, total)) * 100)) : null;
  const grade = gradeForScore(outcome.score, totalPoints);
  const tierLabel = outcome.tier === "clean" ? "Clean retake" : outcome.tier === "messy" ? "Messy retake" : "Failed retake";

  const phaseDurations = log.turns.map((t) => {
    const label: Record<string, string> = {
      setup: "Setup",
      utility: "Utility",
      movement_entry: "Entry",
      movement_reposition: "Re-site",
      combat: "Combat",
      spike: "Spike",
    };
    return {
      phase: t.phase,
      label: label[t.phase] ?? t.phase,
      events: t.events.length,
    };
  });

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(245,177,60,0.06),transparent_55%)]" />

      <header className="flex items-center justify-between border-b border-border-06 bg-pure-black/85 px-5 py-3 backdrop-blur-md">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-ink-dim transition-colors hover:text-ink"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-valorant-red/40 bg-valorant-red/10 text-valorant-red">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Retake<span className="text-valorant-red">.</span></span>
        </button>
        <div className="text-[11px] uppercase tracking-[0.22em] text-ink-mute">Results · {scenario.name}</div>
        <GradeCardDownload
          grade={grade}
          score={outcome.score}
          maxScore={totalPoints}
          tier={outcome.tier}
          percentile={percentile}
          scenarioName={scenario.name}
          mapName={scenario.map}
        />
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <section className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-border-10 bg-surface/70">
              <div ref={containerRef} className="relative aspect-[16/10] bg-pure-black">
                {showCinematic ? (
                  <CinematicPlayer
                    log={log}
                    scenario={scenario}
                    width={size.width}
                    height={size.height}
                    onComplete={handleCinematicComplete}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCinematic(true)}
                    className="group flex h-full w-full flex-col items-center justify-center gap-3"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-amber/40 bg-amber/10 text-amber transition-all group-hover:bg-amber/20">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="8,5 19,12 8,19" />
                      </svg>
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.22em] text-ink-mute group-hover:text-ink">Replay cinematic</span>
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border-10 bg-surface/70 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.22em] text-ink-mute">Key moments</div>
                <div className="text-[10px] text-ink-mute">{moments.length} events</div>
              </div>
              {moments.length === 0 ? (
                <div className="text-[12px] italic text-ink-mute">No standout events — the round was a wash.</div>
              ) : (
                <ol className="space-y-1.5">
                  {moments.map((m, i) => {
                    const toneMap: Record<string, string> = {
                      teal: "border-teal/30 text-teal",
                      amber: "border-amber/30 text-amber",
                      red: "border-valorant-red/30 text-valorant-red",
                      violet: "border-violet/30 text-violet",
                    };
                    return (
                      <li key={i} className={`flex items-center gap-3 rounded-lg border bg-pure-black/30 px-3 py-2 ${toneMap[m.tone]}`}>
                        <span className="font-mono text-[10px] text-ink-mute">{m.tLabel}</span>
                        <span className="rounded-full border border-border-08 px-2 py-0.5 text-[9px] uppercase tracking-wider text-ink-mute">{m.phase}</span>
                        <span className="flex-1 text-[13px] font-semibold text-ink">{m.title}</span>
                        <span className="hidden text-[11px] text-ink-dim sm:inline">{m.detail}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="rounded-2xl border border-border-10 bg-surface/70 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.22em] text-ink-mute">Round timeline</div>
              </div>
              <div className="flex items-stretch gap-1.5">
                {phaseDurations.map((p, i) => {
                  const width = Math.max(5, Math.min(40, 6 + p.events * 3));
                  const toneMap: Record<string, string> = {
                    setup: "bg-border-10",
                    utility: "bg-violet/40",
                    movement_entry: "bg-teal/45",
                    movement_reposition: "bg-amber/45",
                    combat: "bg-valorant-red/45",
                    spike: "bg-valorant-red/70",
                  };
                  return (
                    <div key={i} className="flex flex-col items-center gap-1" style={{ flexBasis: `${width}%` }}>
                      <div className={`h-4 w-full rounded-sm ${toneMap[p.phase] ?? "bg-border-10"}`} />
                      <span className="text-[9px] uppercase tracking-wider text-ink-mute">{p.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-border-10 bg-surface/70 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-ink-mute">Final grade</div>
                  <div className={`mt-1 font-mono text-[84px] leading-none font-bold ${gradeColor(grade)}`}>{grade}</div>
                  <div className="mt-2 text-[13px] font-semibold text-ink">{tierLabel}</div>
                  <div className="text-[12px] text-ink-dim">{outcome.summary}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-3xl font-bold text-ink">
                    {outcome.score}
                    <span className="text-sm text-ink-mute">/{totalPoints}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-mute">points</div>
                </div>
              </div>

              {percentile !== null && rank && total && (
                <div className="mt-5 rounded-xl border border-border-08 bg-pure-black/40 p-4">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-ink-dim">
                    <span>Rank</span>
                    <span className="font-mono text-ink">
                      #{rank} <span className="text-ink-mute">/ {total}</span>
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-border-08">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-valorant-red via-amber to-teal"
                      style={{ width: `${percentile}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-ink-mute">
                    <span>Global</span>
                    <span>Top {100 - percentile}% today</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border-10 bg-surface/70 p-5">
              <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-ink-mute">Score breakdown</div>
              <div className="space-y-1.5">
                {outcome.scoreBreakdown.map((rule) => {
                  const pct = rule.maxPoints > 0 ? (rule.earnedPoints / rule.maxPoints) * 100 : 0;
                  return (
                    <div key={rule.ruleId} className="rounded-lg border border-border-08 bg-pure-black/30 px-3 py-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${rule.passed ? "bg-teal" : "bg-valorant-red"}`} />
                          <span className="text-ink-dim">{rule.description}</span>
                        </div>
                        <span className={`font-mono text-[11px] ${rule.passed ? "text-teal" : "text-valorant-red"}`}>
                          {rule.earnedPoints}/{rule.maxPoints}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border-08">
                        <div
                          className={`h-full rounded-full ${rule.passed ? "bg-teal" : "bg-valorant-red"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {rule.detail && <div className="mt-1 text-[10px] text-ink-mute">{rule.detail}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {(outcome.highlights.length > 0 || outcome.mistakes.length > 0) && (
              <div className="grid grid-cols-1 gap-3">
                {outcome.highlights.length > 0 && (
                  <div className="rounded-2xl border border-teal/25 bg-teal/5 p-4">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-teal">What worked</div>
                    <ul className="space-y-1 text-[12px] text-ink-dim">
                      {outcome.highlights.map((h, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-0.5 text-teal">✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {outcome.mistakes.length > 0 && (
                  <div className="rounded-2xl border border-valorant-red/25 bg-valorant-red/5 p-4">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-valorant-red">What to fix</div>
                    <ul className="space-y-1 text-[12px] text-ink-dim">
                      {outcome.mistakes.map((m, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-0.5 text-valorant-red">✕</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCinematic(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border-10 bg-surface/70 px-4 py-2.5 text-[11px] uppercase tracking-wider text-ink transition-colors hover:border-border-12"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={() => router.push("/planning")}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-amber/30 bg-amber/10 px-4 py-2.5 text-[11px] uppercase tracking-wider text-amber transition-colors hover:bg-amber/15"
              >
                Scrim mode
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border-10 bg-surface/70 px-4 py-2.5 text-[11px] uppercase tracking-wider text-ink transition-colors hover:border-border-12"
              >
                Home
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
