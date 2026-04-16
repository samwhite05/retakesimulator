"use client";

import { useEffect, useState } from "react";
import { last7Days, loadStreakState, gradeForScore, gradeColor } from "@/lib/streaks";

interface DailyStatsProps {
  totalPlaysToday: number;
}

interface ComputedStats {
  streak: { currentStreak: number; bestStreak: number };
  week: ReturnType<typeof last7Days>;
  avgGrade: string;
}

const EMPTY_STATS: ComputedStats = {
  streak: { currentStreak: 0, bestStreak: 0 },
  week: [],
  avgGrade: "—",
};

function computeStats(): ComputedStats {
  const s = loadStreakState();
  const days = last7Days(s);
  const scored = s.runs.filter((r) => r.maxScore && r.maxScore > 0 && r.score >= 0);
  let avgGrade = "—";
  if (scored.length > 0) {
    const avg = scored.reduce((sum, r) => sum + r.score / (r.maxScore || 1), 0) / scored.length;
    avgGrade = gradeForScore(avg * 100, 100);
  }
  return {
    streak: { currentStreak: s.currentStreak, bestStreak: s.bestStreak },
    week: days,
    avgGrade,
  };
}

export default function DailyStats({ totalPlaysToday }: DailyStatsProps) {
  const [stats, setStats] = useState<ComputedStats>(EMPTY_STATS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reading from localStorage is a legitimate external-system sync on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(computeStats());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  const { streak, week, avgGrade } = stats;

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="rounded-2xl border border-border-10 bg-surface/70 p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] text-ink-mute">Your streak</div>
        <div className="text-[10px] text-ink-mute">
          {totalPlaysToday} plays today
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-4xl font-semibold text-amber">
              {ready ? streak.currentStreak : "—"}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-ink-mute">day</span>
          </div>
          <div className="text-[11px] text-ink-mute">Best: {ready ? streak.bestStreak : "—"}</div>
        </div>

        <div className="flex flex-col items-end">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-mute">Avg grade</div>
          <div className={`font-mono text-3xl font-bold ${gradeColor(avgGrade)}`}>{avgGrade}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          <span>Last 7 days</span>
          <span>{ready ? week.filter((r) => r.score >= 0).length : 0}/7</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d, i) => {
            const played = d.score >= 0;
            const tone = !played
              ? "bg-surface border-border-08"
              : d.tier === "clean"
                ? "bg-teal/25 border-teal/40"
                : d.tier === "messy"
                  ? "bg-amber/25 border-amber/40"
                  : "bg-valorant-red/25 border-valorant-red/40";
            return (
              <div
                key={d.date + i}
                title={played ? `${d.date} · ${d.score} pts (${d.tier})` : `${d.date} · no play`}
                className={`flex h-10 flex-col items-center justify-center rounded-md border text-[10px] ${tone}`}
              >
                <span className="text-ink-mute">{dayLabels[new Date(d.date).getDay() === 0 ? 6 : new Date(d.date).getDay() - 1]}</span>
                <span className="font-mono font-semibold text-ink">
                  {played ? d.score : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
