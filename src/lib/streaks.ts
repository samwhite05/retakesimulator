const STORAGE_KEY = "retake-streaks-v1";

export interface DailyRecord {
  date: string;
  scenarioId: string;
  score: number;
  maxScore?: number;
  tier: "clean" | "messy" | "failed";
}

export interface StreakState {
  runs: DailyRecord[];
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string | null;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  const diff = Math.round((db.getTime() - da.getTime()) / 86400000);
  return diff;
}

function safeRead(): StreakState {
  if (typeof window === "undefined") {
    return { runs: [], currentStreak: 0, bestStreak: 0, lastPlayedDate: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { runs: [], currentStreak: 0, bestStreak: 0, lastPlayedDate: null };
    }
    const parsed = JSON.parse(raw) as StreakState;
    return {
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      currentStreak: parsed.currentStreak || 0,
      bestStreak: parsed.bestStreak || 0,
      lastPlayedDate: parsed.lastPlayedDate || null,
    };
  } catch {
    return { runs: [], currentStreak: 0, bestStreak: 0, lastPlayedDate: null };
  }
}

export function loadStreakState(): StreakState {
  const s = safeRead();
  // Invalidate streak if user missed a day
  if (s.lastPlayedDate) {
    const gap = daysBetween(s.lastPlayedDate, todayISO());
    if (gap > 1) {
      return { ...s, currentStreak: 0 };
    }
  }
  return s;
}

export function recordDailyRun(
  scenarioId: string,
  score: number,
  tier: "clean" | "messy" | "failed",
  maxScore?: number
): StreakState {
  if (typeof window === "undefined") {
    return { runs: [], currentStreak: 0, bestStreak: 0, lastPlayedDate: null };
  }
  const state = safeRead();
  const today = todayISO();
  const alreadyToday = state.runs.find((r) => r.date === today);
  const runs = alreadyToday
    ? state.runs.map((r) => (r.date === today ? { ...r, score, tier, maxScore } : r))
    : [...state.runs, { date: today, scenarioId, score, tier, maxScore }];

  let currentStreak = state.currentStreak;
  if (!alreadyToday) {
    if (!state.lastPlayedDate) {
      currentStreak = 1;
    } else {
      const gap = daysBetween(state.lastPlayedDate, today);
      currentStreak = gap === 1 ? state.currentStreak + 1 : gap === 0 ? state.currentStreak : 1;
    }
  } else if (currentStreak === 0) {
    currentStreak = 1;
  }

  const bestStreak = Math.max(state.bestStreak || 0, currentStreak);
  const next: StreakState = {
    runs: runs.slice(-60),
    currentStreak,
    bestStreak,
    lastPlayedDate: today,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable
  }
  return next;
}

export function last7Days(state: StreakState): DailyRecord[] {
  const map = new Map(state.runs.map((r) => [r.date, r]));
  const out: DailyRecord[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    const rec = map.get(iso);
    out.push(
      rec ?? {
        date: iso,
        scenarioId: "",
        score: -1,
        tier: "failed",
      }
    );
  }
  return out;
}

export function gradeForScore(score: number, maxScore: number): string {
  if (maxScore <= 0) return "—";
  const pct = (score / maxScore) * 100;
  if (pct >= 92) return "S";
  if (pct >= 80) return "A";
  if (pct >= 65) return "B";
  if (pct >= 45) return "C";
  if (pct > 0) return "D";
  return "F";
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case "S":
      return "text-amber";
    case "A":
      return "text-teal";
    case "B":
      return "text-teal";
    case "C":
      return "text-ink-dim";
    case "D":
      return "text-valorant-red";
    case "F":
      return "text-valorant-red";
    default:
      return "text-ink-mute";
  }
}
