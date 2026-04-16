"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * /mockup — audit + shipped v2 redesign showcase.
 *
 * This is a static presentation page. It is NOT wired to the store or
 * simulator. It documents the weaknesses identified in the v1 audit and
 * shows the redesigned surfaces that are now live in the real app.
 *
 * Every finding on this page that has been resolved is marked "shipped".
 * Findings still in progress are marked "planned".
 */

// ─── Design tokens for the redesign ──────────────────────────────────────────
const bg = "#0B0D11"; // warmer than pure void
const panel = "#141820";
const panelSoft = "#1B2029";
const ink = "#E9E4D6"; // warm off-white
const inkDim = "#B4AFA3";
const inkMute = "#6E6A61";
const line = "rgba(233,228,214,0.08)";
const lineSoft = "rgba(233,228,214,0.05)";
const red = "#FF4655"; // keep Valorant red for critical
const amber = "#F5B13C"; // replaces neon cyan
const teal = "#5DD4BE";
const violet = "#9A7BD6";

export default function MockupPage() {
  return (
    <main
      className="min-h-screen text-[color:var(--ink)]"
      style={
        {
          ["--bg"]: bg,
          ["--panel"]: panel,
          ["--panel-soft"]: panelSoft,
          ["--ink"]: ink,
          ["--ink-dim"]: inkDim,
          ["--ink-mute"]: inkMute,
          ["--line"]: line,
          ["--line-soft"]: lineSoft,
          ["--red"]: red,
          ["--amber"]: amber,
          ["--teal"]: teal,
          ["--violet"]: violet,
          backgroundColor: bg,
          fontFamily:
            "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        } as React.CSSProperties
      }
    >
      <TopNav />

      <section className="mx-auto max-w-7xl px-6 pt-12 pb-10">
        <Eyebrow>Product audit · v2 shipped</Eyebrow>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-[color:var(--ink)]">
          Retake, reimagined as a daily ritual — and now live.
        </h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[color:var(--ink-dim)]">
          This page documents the v1 audit and shows the redesigned surfaces
          that are now live in production. Each finding is tagged{" "}
          <StatusInline kind="shipped" /> or <StatusInline kind="planned" />.
          The mockups below are static; the real thing is live at{" "}
          <Link href="/" className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]">
            /
          </Link>
          ,{" "}
          <Link href="/planning" className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]">
            /planning
          </Link>
          , and{" "}
          <Link href="/results" className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--ink)]">
            /results
          </Link>
          .
        </p>

        <ShippedSummary />
      </section>

      <AuditSection />

      <SectionDivider label="01 · Landing" copy="From a dry card-on-black to a daily ritual with a reason to come back." />
      <LandingMockup />

      <SectionDivider label="02 · Planning" copy="From floating modals and mode-switching to a persistent command deck." />
      <PlanningMockup />

      <SectionDivider label="03 · Results" copy="From a raw number to a story you want to screenshot." />
      <ResultsMockup />

      <SectionDivider label="04 · Design system" copy="A warmer, more tactile palette. Less neon, more command-center." />
      <DesignSystem />

      <footer className="mx-auto max-w-7xl px-6 py-16 text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[color:var(--ink-mute)]">
          End of preview · /mockup
        </p>
      </footer>
    </main>
  );
}

// ─── Shared presentational pieces ────────────────────────────────────────────

function TopNav() {
  return (
    <div
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        borderColor: "var(--line)",
        background: "rgba(11,13,17,0.8)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
            Mockup · v2 redesign
          </span>
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{
              background: "rgba(93,212,190,0.14)",
              color: "var(--teal)",
              border: "1px solid rgba(93,212,190,0.35)",
            }}
          >
            ● shipped
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-wider">
          <Link href="/" className="text-[color:var(--ink-dim)] hover:text-[color:var(--ink)]">
            ← Home
          </Link>
          <Link
            href="/planning"
            className="text-[color:var(--ink-dim)] hover:text-[color:var(--ink)]"
          >
            Planning
          </Link>
          <Link
            href="/results"
            className="text-[color:var(--ink-dim)] hover:text-[color:var(--ink)]"
          >
            Results
          </Link>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md"
        style={{ background: "var(--red)", color: "#0B0D11" }}
      >
        <span className="text-[12px] font-black tracking-tighter">R</span>
      </div>
      <div className="text-[15px] font-semibold tracking-tight">
        Retake<span style={{ color: "var(--red)" }}>.</span>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--amber)]">
      {children}
    </p>
  );
}

function SectionDivider({ label, copy }: { label: string; copy: string }) {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-20 pb-6">
      <div className="flex items-end justify-between gap-6 border-b pb-4" style={{ borderColor: "var(--line)" }}>
        <div>
          <Eyebrow>{label}</Eyebrow>
          <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[color:var(--ink)]">
            {copy}
          </h2>
        </div>
      </div>
    </div>
  );
}

// ─── Audit section ───────────────────────────────────────────────────────────

const gameplayIssues: Issue[] = [
  {
    title: "Only one scenario exists",
    body: "Ascent B-site 3v2 is the entire game. A 'daily' puzzle with no rotation has no retention hook.",
    fix: "Author at least 14 scenarios across 3 maps, rotate deterministically by date, show a 7-day calendar on the landing screen.",
    severity: "critical",
    status: "planned",
  },
  {
    title: "One-shot submit, no learning loop",
    body: "You plan blind, watch the cinematic once, and get a tier. Players can't understand why they failed.",
    fix: "Unlimited 'scrim' mode is live after your daily submission. Rewind, tweak, re-run.",
    severity: "critical",
    status: "shipped",
  },
  {
    title: "Cognitive cliff on first play",
    body: "Place agents, utility, entry paths, re-site holds and move budgets — all before any visual feedback.",
    fix: "Interactive onboarding coachmarks walk first-time players through each stage. Wizard progress is always visible in the top bar.",
    severity: "critical",
    status: "shipped",
  },
  {
    title: "Two-phase wizard feels like two puzzles",
    body: "'Watch entry', then plan re-site. Players don't understand why commitment is split and utility locks.",
    fix: "Collapsed to a single 'plan → simulate → grade' flow. Entry + re-site are drawn upfront per agent; one simulation run.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Tile budgets and hard movement caps felt clunky",
    body: "Agents couldn't reach half the map, diagonals were inconsistent, and reachable-tile highlights made pathing feel like Sudoku, not Valorant.",
    fix: "Tile budgets are gone. Paths are unlimited; risk is calculated by real-time exposure to defender vision cones (teal = safe, amber = trade, red = open). Direct lines to spike are legal but tactically fatal.",
    severity: "critical",
    status: "shipped",
  },
  {
    title: "Clunky 're-site' second phase",
    body: "Confusing naming, two separate wave plans, and an awkward hold toggle between them.",
    fix: "One continuous path per agent with optional ◆ hold waypoints tapped anywhere on the path. 'Re-site' is retired.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "No retention surface",
    body: "No streaks, no stats, no calendar, no share card. Nothing pulls the user back tomorrow.",
    fix: "Streak counter, 7-day heatmap, average grade, and a shareable PNG grade card are all live on landing + results.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Opaque scoring",
    body: "You get a number and a tier but no sense of 'what would S-rank look like'.",
    fix: "Letter grades S→D with percentile arc and yesterday's top plays of the day on the landing page.",
    severity: "medium",
    status: "shipped",
  },
  {
    title: "No onboarding",
    body: "The help modal is a wall of text. First-time players see an empty map and bounce.",
    fix: "Contextual onboarding coachmarks appear on each planning step; rewritten help modal is a numbered walkthrough.",
    severity: "medium",
    status: "shipped",
  },
  {
    title: "No undo",
    body: "'Clear' is the only recovery — it nukes the whole plan. Users get stuck mid-design.",
    fix: "Per-action undo/redo stack (40 entries) in the planning top bar. Cmd+Z / Cmd+Shift+Z supported.",
    severity: "medium",
    status: "shipped",
  },
];

const uiIssues: Issue[] = [
  {
    title: "Four floating panels fight for the map",
    body: "Phase indicator (top), ability banner (top), action dock (bottom), roster strip (bottom). On mobile they stack and obscure the site.",
    fix: "Command-deck layout: left agent rail, right briefing rail, bottom utility bay, top wizard bar. Map is never covered.",
    severity: "critical",
    status: "shipped",
  },
  {
    title: "Ability selection hidden behind modals",
    body: "Tap agent → panel opens → pick ability → panel closes → aim on map. 4 steps to place a smoke.",
    fix: "Ability chips live inline under each agent in the rail. Two clicks, zero modals.",
    severity: "critical",
    status: "shipped",
  },
  {
    title: "Monospace jargon everywhere",
    body: "'EXECUTE PHASE 1', 'POST-PLANT 3V2', 'RE-SITE · TAP DESTINATION'. Alienating to casual Valorant fans.",
    fix: "Plain-English labels throughout. Monospace reserved for timers, scores, and coordinates.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Dense cyan neon palette",
    body: "#00FFFF on #0F0F0F is high-contrast but eye-fatiguing and feels generic sci-fi, not Valorant.",
    fix: "Warm charcoal base (#0B0D11), Valorant red for critical, amber for tactical accents, paper-white ink for primary text.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Tiny 44px portraits in bottom strip",
    body: "Mobile taps miss, names are 8px, eliminated agents are easy to confuse with alive ones.",
    fix: "Agent rail cards with 40–48px portraits, clear status (Placed / Entry / Re-site), and KIA tombstones for eliminated teammates.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Utility counter is a cryptic lightning bolt + number",
    body: "No sense of which charges are left, per agent, per type.",
    fix: "Utility bay surfaces each placed ability with the caster's portrait, plus a per-scenario total + used counter.",
    severity: "medium",
    status: "shipped",
  },
  {
    title: "Results dump text bullets",
    body: "'Highlights' and 'Mistakes' are generic bullet lists. No timeline, no visual anchors.",
    fix: "Key moments panel with timestamps, round-timeline phase bar, score breakdown with bars, 'what worked / what to fix' sections.",
    severity: "medium",
    status: "shipped",
  },
  {
    title: "Landing is a card on a black background",
    body: "No streak, no teaser of the map, no prior results, no reason to care before clicking.",
    fix: "Hero with minimap preview, squad avatars, streak + 7-day heatmap, yesterday's top-3, and a live countdown to the next drop.",
    severity: "medium",
    status: "shipped",
  },
  {
    title: "Cinematic played like a silent replay",
    body: "No clock, no round state, no event feed, no playback controls. You watched passively and hoped you could follow what killed you.",
    fix: "Full broadcast HUD: spike clock, squad counters for both teams, phase chyron, scrolling kill/utility feed, agent name labels, and pause/0.5x/1x/2x/skip playback controls.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Vision cones bled through walls",
    body: "Cones were built off the coarse 48×48 grid, so they jagged across diagonal walls and leaked into corridors they couldn't actually see into.",
    fix: "Defender cones are now raycast directly against the minimap's painted wall outlines — pixel-accurate geometry with a 1-pixel dilation so hairline strokes still block sight. Path exposure colors use the same bitmap, so what you see is what grades you.",
    severity: "high",
    status: "shipped",
  },
  {
    title: "Scenario editor felt like a different app",
    body: "Cramped two-column layout, monospace everywhere, tiny washed-out tile chips, a wall of JSON, plain-text save messages, and no way to preview what cones would look like for the scenario being authored.",
    fix: "Full rebrand to match the planning deck: left tool rail (paint / fill / eraser / plantable / spawn / camera) with 1-8 brush shortcuts, right properties panel with live tile stats + per-type bars, full undo/redo stack with Cmd+Z, an in-editor vision cone preview toggle wired to the same pixel raycaster, wall-bitmap overlay for debugging, collapsible JSON preview, and tone-aware toasts on every save / copy / download.",
    severity: "medium",
    status: "shipped",
  },
  {
    title: "Utility looked generic and didn't feel alive",
    body: "Placed smokes were flat purple circles, flashes were a static yellow triangle, mollies were a dim orange blob, and recon darts were barely visible. Nothing animated, nothing read as its Valorant counterpart, and in the cinematic every util type looked the same shade of 'circle on a minimap'.",
    fix: "New UtilityGlyph system draws each ability the way it reads in-game: Jett smokes pulse cold & dashed while Omen's are dense violet puffs, Viper toxics are luminous green, Sova darts sonar-ping at their target, Breach capsules march direction chevrons, Sage walls raise tile-by-tile with a marching highlight, and Cypher tripwires pulse red between endpoints. Every cinematic FX has a proper spawn → sustain → fade lifecycle driven by one shared RAF clock. Mechanically: flashes now need LOS + facing to blind, incendiaries damage defenders caught on drop, Breach cones respect their capsule shape, tripwires trigger at either endpoint, and Gravity Well stuns + reveals.",
    severity: "medium",
    status: "shipped",
  },
];

interface Issue {
  title: string;
  body: string;
  fix: string;
  severity: "critical" | "high" | "medium";
  status: "shipped" | "planned";
}

function AuditSection() {
  return (
    <section className="mx-auto max-w-7xl px-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <AuditColumn title="Gameplay loop" issues={gameplayIssues} />
        <AuditColumn title="UI inefficiencies" issues={uiIssues} />
      </div>
    </section>
  );
}

function AuditColumn({ title, issues }: { title: string; issues: Issue[] }) {
  const shippedCount = issues.filter((i) => i.status === "shipped").length;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
          {shippedCount} / {issues.length} shipped
        </span>
      </div>
      <ol className="space-y-3">
        {issues.map((i, idx) => (
          <li
            key={idx}
            className="rounded-xl border p-4"
            style={{
              borderColor: i.status === "shipped" ? "rgba(93,212,190,0.22)" : "var(--line)",
              background: "var(--panel)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] font-medium text-[color:var(--ink)]">
                <span className="mr-2 font-mono text-[color:var(--ink-mute)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {i.title}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge status={i.status} />
                <SeverityChip severity={i.severity} />
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--ink-dim)]">
              {i.body}
            </p>
            <div
              className="mt-3 rounded-lg border-l-2 px-3 py-2 text-[13px] leading-relaxed"
              style={{
                borderColor: i.status === "shipped" ? "var(--teal)" : "var(--amber)",
                background:
                  i.status === "shipped"
                    ? "rgba(93,212,190,0.05)"
                    : "rgba(245,177,60,0.04)",
                color: "var(--ink)",
              }}
            >
              <span
                className="mr-1 text-[10px] uppercase tracking-[0.22em]"
                style={{
                  color: i.status === "shipped" ? "var(--teal)" : "var(--amber)",
                }}
              >
                {i.status === "shipped" ? "shipped ·" : "fix ·"}
              </span>
              {i.fix}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusBadge({ status }: { status: Issue["status"] }) {
  if (status === "shipped") {
    return (
      <span
        className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
        style={{ color: "var(--teal)", background: "rgba(93,212,190,0.14)" }}
      >
        ● shipped
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
      style={{ color: "var(--ink-mute)", background: "rgba(233,228,214,0.06)" }}
    >
      ○ planned
    </span>
  );
}

function StatusInline({ kind }: { kind: "shipped" | "planned" }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]"
      style={
        kind === "shipped"
          ? { color: "var(--teal)", background: "rgba(93,212,190,0.14)" }
          : { color: "var(--ink-mute)", background: "rgba(233,228,214,0.06)" }
      }
    >
      {kind === "shipped" ? "● shipped" : "○ planned"}
    </span>
  );
}

function ShippedSummary() {
  const all = [...gameplayIssues, ...uiIssues];
  const shipped = all.filter((i) => i.status === "shipped").length;
  const total = all.length;
  const pct = Math.round((shipped / total) * 100);
  return (
    <div
      className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4"
      style={{
        borderColor: "rgba(93,212,190,0.35)",
        background: "rgba(93,212,190,0.05)",
      }}
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--teal)]">
          v2 ship progress
        </p>
        <p className="mt-1 font-mono text-[22px] font-semibold text-[color:var(--ink)]">
          {shipped} <span className="text-[color:var(--ink-mute)]">/ {total}</span>{" "}
          <span className="text-[color:var(--teal)]">· {pct}%</span>
        </p>
      </div>
      <div className="flex-1 min-w-[220px]">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--line)" }}
        >
          <div
            className="h-1.5 rounded-full"
            style={{
              width: `${pct}%`,
              background: "var(--teal)",
            }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ink-dim)]">
          All UI inefficiencies and every retention / onboarding / undo finding
          resolved. Remaining: scenario rotation across more maps.
        </p>
      </div>
    </div>
  );
}

function SeverityChip({ severity }: { severity: Issue["severity"] }) {
  const map = {
    critical: { c: "var(--red)", bg: "rgba(255,70,85,0.12)" },
    high: { c: "var(--amber)", bg: "rgba(245,177,60,0.12)" },
    medium: { c: "var(--inkDim)", bg: "rgba(233,228,214,0.06)" },
  } as const;
  const style = map[severity];
  return (
    <span
      className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
      style={{ color: style.c, background: style.bg }}
    >
      {severity}
    </span>
  );
}

// ─── Landing mockup ──────────────────────────────────────────────────────────

function LandingMockup() {
  return (
    <section className="mx-auto max-w-7xl px-6">
      <FrameBrowser url="retake.app" minWidth={1100}>
        <div
          className="grid gap-6 p-6"
          style={{
            background: "var(--bg)",
            minHeight: 640,
            gridTemplateColumns: "1.1fr 1fr",
          }}
        >
          {/* Hero left */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <BrandMark />
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ borderColor: "var(--line)", color: "var(--ink-dim)" }}
                >
                  Day 147
                </span>
              </div>

              <h1 className="mt-8 text-[56px] font-semibold leading-[1.02] tracking-tight">
                Defuse the round
                <br />
                <span style={{ color: "var(--amber)" }}>before it defuses you.</span>
              </h1>
              <p className="mt-4 max-w-[32rem] text-[15px] leading-relaxed text-[color:var(--ink-dim)]">
                One daily Valorant puzzle. You&apos;re the IGL — place the
                squad, spend utility, call the retake. Watch it play out.
                Compare with the world.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-end gap-6">
              <StatTile label="Current streak" value="12" accent="var(--red)" sub="days" />
              <StatTile label="Avg. grade" value="B+" sub="last 7 days" />
              <StatTile label="Global rank" value="#1,432" sub="of 18.4k" />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTA primary>Play today&apos;s puzzle →</CTA>
              <button
                className="rounded-lg border px-4 py-3 text-[13px] font-medium"
                style={{ borderColor: "var(--line)", color: "var(--ink-dim)" }}
              >
                Browse archive
              </button>
              <span className="ml-2 font-mono text-[11px] text-[color:var(--ink-mute)]">
                New puzzle in 13h 42m
              </span>
            </div>
          </div>

          {/* Scenario card right */}
          <div className="flex flex-col gap-4">
            <ScenarioCard />
            <WeekCalendar />
            <YesterdayTop3 />
          </div>
        </div>
      </FrameBrowser>
    </section>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
        {label}
      </p>
      <p
        className="mt-1 text-[34px] font-semibold leading-none tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] font-mono text-[color:var(--ink-mute)]">{sub}</p>
      )}
    </div>
  );
}

function CTA({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      className="rounded-lg px-5 py-3 text-[14px] font-semibold transition-transform active:scale-[0.98]"
      style={
        primary
          ? { background: "var(--red)", color: "#0B0D11" }
          : { background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)" }
      }
    >
      {children}
    </button>
  );
}

function ScenarioCard() {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
        <span>Today · scenario #147</span>
        <span style={{ color: "var(--amber)" }}>● live</span>
      </div>
      <div className="relative aspect-[5/3] w-full overflow-hidden">
        <Image
          src="/assets/minimaps/ascent.png"
          alt="Ascent minimap"
          fill
          sizes="(max-width: 1024px) 100vw, 600px"
          style={{ objectFit: "cover", objectPosition: "center 72%" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,13,17,0.0) 0%, rgba(11,13,17,0.65) 70%, rgba(11,13,17,0.92) 100%)",
          }}
        />
        <div className="absolute left-4 right-4 bottom-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--amber)]">
            Ascent · B Site · 3v2
          </p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-tight">
            Post-plant. 18 seconds. Spike is cooking.
          </h3>
        </div>

        <SiteMarker />
      </div>
      <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "var(--line)" }}>
        <SquadPreview />
        <div className="ml-auto flex items-center gap-2">
          <Tag>Difficulty · 3 / 5</Tag>
          <Tag>Avg grade B-</Tag>
        </div>
      </div>
    </div>
  );
}

function SiteMarker() {
  return (
    <div
      className="absolute"
      style={{
        left: "31%",
        top: "78%",
        transform: "translate(-50%,-50%)",
      }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold"
        style={{ borderColor: "var(--red)", background: "rgba(255,70,85,0.15)", color: "var(--red)" }}
      >
        B
      </div>
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 44,
          height: 44,
          border: "1px solid rgba(255,70,85,0.4)",
          borderRadius: "9999px",
          animation: "ping 2.4s ease-out infinite",
        }}
      />
      <style jsx>{`
        @keyframes ping {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
      style={{ borderColor: "var(--line)", color: "var(--ink-dim)" }}
    >
      {children}
    </span>
  );
}

function SquadPreview() {
  const squad = [
    { id: "sova", label: "Sova", alive: true },
    { id: "omen", label: "Omen", alive: true },
    { id: "jett", label: "Jett", alive: true },
    { id: "reyna", label: "Reyna", alive: false },
    { id: "sage", label: "Sage", alive: false },
  ];
  return (
    <div className="flex items-center gap-1">
      {squad.map((a) => (
        <div
          key={a.id}
          className="relative h-9 w-9 overflow-hidden rounded-full border"
          style={{
            borderColor: a.alive ? "rgba(245,177,60,0.4)" : "rgba(255,70,85,0.25)",
            filter: a.alive ? "none" : "grayscale(1) brightness(0.55)",
          }}
          title={`${a.label} · ${a.alive ? "Alive" : "KIA"}`}
        >
          <Image
            src={`/assets/agents/${a.id.charAt(0).toUpperCase() + a.id.slice(1)}_icon.webp`}
            alt={a.label}
            width={36}
            height={36}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
          {!a.alive && (
            <div
              className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold"
              style={{ background: "rgba(11,13,17,0.55)", color: "var(--red)" }}
            >
              ✕
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WeekCalendar() {
  // Last 7 days of grades
  const days = [
    { d: "Thu", g: "B" },
    { d: "Fri", g: "A" },
    { d: "Sat", g: "C" },
    { d: "Sun", g: "A" },
    { d: "Mon", g: "S" },
    { d: "Tue", g: "B" },
    { d: "Wed", g: "—", pending: true },
  ];
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
          This week
        </p>
        <p className="font-mono text-[10px] text-[color:var(--ink-mute)]">
          6 / 7 solved
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <div key={d.d} className="flex flex-col items-center gap-1">
            <div
              className="flex h-10 w-full items-center justify-center rounded-md border text-[13px] font-semibold"
              style={{
                borderColor: d.pending ? "var(--line)" : "transparent",
                background: d.pending ? "transparent" : gradeBg(d.g),
                color: d.pending ? "var(--ink-mute)" : gradeFg(d.g),
              }}
            >
              {d.g}
            </div>
            <span className="font-mono text-[9px] uppercase text-[color:var(--ink-mute)]">
              {d.d}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function gradeBg(g: string) {
  switch (g) {
    case "S":
      return "rgba(245,177,60,0.22)";
    case "A":
      return "rgba(93,212,190,0.18)";
    case "B":
      return "rgba(154,123,214,0.16)";
    case "C":
      return "rgba(233,228,214,0.08)";
    default:
      return "rgba(255,70,85,0.14)";
  }
}
function gradeFg(g: string) {
  switch (g) {
    case "S":
      return "var(--amber)";
    case "A":
      return "var(--teal)";
    case "B":
      return "var(--violet)";
    case "C":
      return "var(--ink-dim)";
    default:
      return "var(--red)";
  }
}

function YesterdayTop3() {
  const top = [
    { rank: 1, name: "@halo_igl", grade: "S", score: 94 },
    { rank: 2, name: "@neonwhisp", grade: "S", score: 91 },
    { rank: 3, name: "@bonk", grade: "A", score: 87 },
  ];
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
          Yesterday · top of the board
        </p>
        <button className="text-[11px] font-medium text-[color:var(--amber)] hover:underline">
          Watch all →
        </button>
      </div>
      <div className="space-y-1.5">
        {top.map((t) => (
          <div
            key={t.rank}
            className="flex items-center gap-3 rounded-md border px-3 py-2"
            style={{ borderColor: "var(--line-soft)", background: "var(--panel-soft)" }}
          >
            <span className="w-5 font-mono text-[12px] text-[color:var(--ink-mute)]">
              #{t.rank}
            </span>
            <span className="flex-1 text-[13px] font-medium">{t.name}</span>
            <span
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: gradeBg(t.grade), color: gradeFg(t.grade) }}
            >
              {t.grade}
            </span>
            <span className="w-10 text-right font-mono text-[12px] text-[color:var(--ink-dim)]">
              {t.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Planning mockup ─────────────────────────────────────────────────────────

function PlanningMockup() {
  return (
    <section className="mx-auto max-w-7xl px-6">
      <FrameBrowser url="retake.app/play" minWidth={1280}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: "260px minmax(640px, 1fr) 300px",
            gridTemplateRows: "auto 1fr auto",
            minHeight: 720,
            background: "var(--bg)",
          }}
        >
          {/* Top bar spans full width */}
          <div
            className="col-span-3 flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex items-center gap-4">
              <BrandMark />
              <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
                Ascent · B Site · 3v2
              </span>
            </div>
            <WizardProgress />
            <div className="flex items-center gap-2">
              <IconButton label="Undo">⤺</IconButton>
              <IconButton label="Redo">⤻</IconButton>
              <IconButton label="Help">?</IconButton>
            </div>
          </div>

          {/* Left rail — agents */}
          <AgentRail />

          {/* Center — map */}
          <div className="relative overflow-hidden" style={{ background: "var(--bg)" }}>
            <PlanningMap />
            <MapLegend />
            <LivePreviewBadge />
          </div>

          {/* Right rail — briefing */}
          <BriefingRail />

          {/* Bottom bar spans full width */}
          <div
            className="col-span-3 flex items-center justify-between border-t px-4 py-3"
            style={{ borderColor: "var(--line)" }}
          >
            <UtilityInventory />
            <button
              className="rounded-lg px-6 py-2.5 text-[13px] font-semibold"
              style={{ background: "var(--red)", color: "#0B0D11" }}
            >
              Run simulation →
            </button>
          </div>
        </div>
      </FrameBrowser>
    </section>
  );
}

function WizardProgress() {
  const steps = [
    { n: 1, label: "Place", done: true },
    { n: 2, label: "Utility", done: true },
    { n: 3, label: "Paths", active: true },
    { n: 4, label: "Simulate" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1.5">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              background: s.active
                ? "var(--amber)"
                : s.done
                ? "rgba(245,177,60,0.18)"
                : "transparent",
              color: s.active
                ? "#0B0D11"
                : s.done
                ? "var(--amber)"
                : "var(--ink-mute)",
              border: s.active || s.done ? "none" : "1px solid var(--line)",
            }}
          >
            {s.done ? "✓" : s.n}
          </div>
          <span
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: s.active
                ? "var(--ink)"
                : s.done
                ? "var(--ink-dim)"
                : "var(--ink-mute)",
            }}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span
              className="mx-1 h-px w-5"
              style={{
                background:
                  s.done || s.active ? "rgba(245,177,60,0.4)" : "var(--line)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border text-[13px] text-[color:var(--ink-dim)] hover:text-[color:var(--ink)]"
      style={{ borderColor: "var(--line)" }}
    >
      {children}
    </button>
  );
}

function AgentRail() {
  const roster = [
    { id: "sova", name: "Sova", role: "initiator", placed: true, abilities: ["Recon Dart", "Hunter's Fury", "Owl Drone"] },
    { id: "omen", name: "Omen", role: "controller", placed: true, abilities: ["Dark Cover", "Paranoia", "Shrouded Step"] },
    { id: "jett", name: "Jett", role: "duelist", placed: true, abilities: ["Updraft", "Tailwind", "Cloudburst"] },
    { id: "reyna", name: "Reyna", role: "duelist", eliminated: true },
    { id: "sage", name: "Sage", role: "sentinel", eliminated: true },
  ];

  return (
    <aside
      className="overflow-y-auto border-r"
      style={{
        borderColor: "var(--line)",
        background: "var(--panel)",
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
          Squad
        </p>
        <p className="mt-0.5 text-[11px] text-[color:var(--ink-dim)]">
          3 alive · 2 down
        </p>
      </div>

      <div className="space-y-1 px-2 pb-4">
        {roster.map((a) => (
          <AgentCard key={a.id} agent={a} active={a.id === "omen"} />
        ))}
      </div>
    </aside>
  );
}

interface AgentRow {
  id: string;
  name: string;
  role: string;
  placed?: boolean;
  eliminated?: boolean;
  abilities?: string[];
}

function AgentCard({ agent, active }: { agent: AgentRow; active?: boolean }) {
  if (agent.eliminated) {
    return (
      <div
        className="flex items-center gap-3 rounded-lg px-2 py-2 opacity-50"
        style={{ filter: "grayscale(1)" }}
      >
        <div className="relative h-10 w-10 overflow-hidden rounded-md">
          <Image
            src={`/assets/agents/${cap(agent.id)}_icon.webp`}
            alt={agent.name}
            width={40}
            height={40}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(11,13,17,0.55)" }}
          >
            <span className="font-mono text-[11px] font-bold" style={{ color: "var(--red)" }}>
              ✕
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{agent.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-mute)]">
            KIA · mid-round
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-2"
      style={{
        background: active ? "rgba(245,177,60,0.08)" : "transparent",
        border: active ? "1px solid rgba(245,177,60,0.35)" : "1px solid transparent",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 overflow-hidden rounded-md"
          style={{ border: `2px solid ${active ? "var(--amber)" : "var(--line)"}` }}
        >
          <Image
            src={`/assets/agents/${cap(agent.id)}_icon.webp`}
            alt={agent.name}
            width={40}
            height={40}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{agent.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-[color:var(--ink-mute)]">
            {agent.role} · placed
          </p>
        </div>
        <div className="text-[10px] font-mono text-[color:var(--ink-mute)]">
          <span style={{ color: "var(--teal)" }}>●</span> 5m
        </div>
      </div>

      {active && agent.abilities && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {agent.abilities.map((ab, i) => (
            <AbilityChip key={ab} name={ab} charges={i === 0 ? 1 : 1} used={i === 2} />
          ))}
        </div>
      )}
    </div>
  );
}

function AbilityChip({ name, charges, used }: { name: string; charges: number; used?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <button
      className="flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-center"
      style={{
        borderColor: used ? "var(--line-soft)" : "var(--line)",
        background: used ? "transparent" : "var(--panel-soft)",
        opacity: used ? 0.4 : 1,
      }}
      title={name}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded bg-[color:var(--bg)] text-[10px] font-bold"
        style={{ color: used ? "var(--ink-mute)" : "var(--amber)" }}
      >
        {initials}
      </div>
      <span className="truncate text-[9px] font-medium text-[color:var(--ink-dim)]">
        {name.split(" ")[0]}
      </span>
      <div className="flex gap-0.5">
        {Array.from({ length: charges }).map((_, i) => (
          <span
            key={i}
            className="h-1 w-3 rounded-full"
            style={{
              background: used ? "var(--line)" : "var(--amber)",
            }}
          />
        ))}
      </div>
    </button>
  );
}

function PlanningMap() {
  return (
    <div className="relative h-full w-full">
      <Image
        src="/assets/minimaps/ascent.png"
        alt="Ascent"
        fill
        sizes="(max-width: 1024px) 100vw, 720px"
        style={{ objectFit: "cover", objectPosition: "center" }}
      />

      {/* Warm dark vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 70%, rgba(11,13,17,0.0) 0%, rgba(11,13,17,0.55) 100%)",
        }}
      />

      {/* Agent tokens */}
      <AgentToken x="15%" y="22%" color="var(--teal)" letter="S" label="Sova" />
      <AgentToken x="9%" y="32%" color="var(--violet)" letter="O" label="Omen" active />
      <AgentToken x="21%" y="22%" color={amber} letter="J" label="Jett" />

      {/* Defenders */}
      <AgentToken x="31%" y="85%" color="var(--red)" letter="?" label="Unknown" enemy hidden />
      <AgentToken x="41%" y="67%" color="var(--red)" letter="?" label="Unknown" enemy />

      {/* Spike */}
      <div
        className="absolute flex items-center gap-1 rounded px-1.5 py-0.5"
        style={{
          left: "30%",
          top: "78%",
          background: "rgba(255,70,85,0.9)",
          color: "#0B0D11",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          transform: "translate(-50%,-50%)",
        }}
      >
        SPIKE · 14s
      </div>

      {/* Entry paths (chalk-style) */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <filter id="chalkBlur">
            <feGaussianBlur stdDeviation="0.3" />
          </filter>
        </defs>
        <path
          d="M 15% 22% Q 22% 45%, 28% 62% T 32% 78%"
          fill="none"
          stroke={amber}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 6"
          filter="url(#chalkBlur)"
          opacity="0.9"
        />
        <path
          d="M 9% 32% Q 18% 50%, 25% 66% T 30% 80%"
          fill="none"
          stroke={violet}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 6"
          filter="url(#chalkBlur)"
          opacity="0.9"
        />
        <path
          d="M 21% 22% Q 28% 42%, 33% 58% T 34% 76%"
          fill="none"
          stroke={teal}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 6"
          filter="url(#chalkBlur)"
          opacity="0.9"
        />
      </svg>

      {/* Smoke placement */}
      <div
        className="absolute flex items-center justify-center rounded-full"
        style={{
          left: "34%",
          top: "68%",
          width: 64,
          height: 64,
          transform: "translate(-50%,-50%)",
          background: "rgba(154,123,214,0.22)",
          border: "1px dashed rgba(154,123,214,0.6)",
        }}
      >
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: violet }}>
          Smoke
        </span>
      </div>

      {/* Flash cone */}
      <div
        className="absolute"
        style={{
          left: "21%",
          top: "40%",
          width: 90,
          height: 60,
          transform: "translate(-50%,-50%) rotate(35deg)",
          background: "linear-gradient(90deg, rgba(245,177,60,0.35), rgba(245,177,60,0))",
          clipPath: "polygon(0 45%, 100% 0, 100% 100%)",
        }}
      />

      {/* Reachable tile hint (for active agent omen) */}
      <div
        className="absolute rounded-full"
        style={{
          left: "9%",
          top: "32%",
          width: 180,
          height: 180,
          transform: "translate(-50%,-50%)",
          border: "1px dashed rgba(154,123,214,0.35)",
          background:
            "radial-gradient(circle, rgba(154,123,214,0.08) 0%, rgba(154,123,214,0) 70%)",
        }}
      />
    </div>
  );
}

function AgentToken({
  x,
  y,
  color,
  letter,
  label,
  enemy,
  hidden,
  active,
}: {
  x: string;
  y: string;
  color: string;
  letter: string;
  label: string;
  enemy?: boolean;
  hidden?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%,-50%)",
      }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
        style={{
          background: enemy ? "rgba(255,70,85,0.18)" : "var(--bg)",
          color,
          border: `2px solid ${color}`,
          boxShadow: active ? `0 0 0 3px ${color}33` : "none",
          opacity: hidden ? 0.55 : 1,
          borderStyle: hidden ? "dashed" : "solid",
        }}
      >
        {letter}
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider"
        style={{
          top: 32,
          color: enemy ? "var(--red)" : color,
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function MapLegend() {
  const items = [
    { color: teal, label: "Sova path" },
    { color: violet, label: "Omen path" },
    { color: amber, label: "Jett path" },
    { color: red, label: "Known enemy" },
  ];
  return (
    <div
      className="absolute bottom-4 left-4 rounded-lg border px-3 py-2"
      style={{
        borderColor: "var(--line)",
        background: "rgba(11,13,17,0.8)",
        backdropFilter: "blur(6px)",
      }}
    >
      <p className="mb-1.5 text-[9px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
        Legend
      </p>
      <div className="space-y-1">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-2 text-[11px]">
            <span
              className="h-1 w-4 rounded-full"
              style={{ background: i.color }}
            />
            <span className="text-[color:var(--ink-dim)]">{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LivePreviewBadge() {
  return (
    <div
      className="absolute top-4 right-4 flex items-center gap-2 rounded-full border px-3 py-1.5"
      style={{
        borderColor: "rgba(93,212,190,0.4)",
        background: "rgba(93,212,190,0.08)",
        backdropFilter: "blur(6px)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--teal)", boxShadow: "0 0 8px var(--teal)" }}
      />
      <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--teal)" }}>
        Live preview · your plan wins 62%
      </span>
    </div>
  );
}

function BriefingRail() {
  return (
    <aside
      className="overflow-y-auto border-l"
      style={{
        borderColor: "var(--line)",
        background: "var(--panel)",
      }}
    >
      <div className="px-4 pt-4">
        <Eyebrow>Briefing</Eyebrow>
        <h3 className="mt-2 text-[15px] font-semibold">Post-plant · 18s left</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--ink-dim)]">
          The spike is planted on default. Cypher was last spotted holding from
          CT, Killjoy from Market. Reyna and Sage died on the execute — you have
          what&apos;s left.
        </p>
      </div>

      <div className="mt-5 border-t px-4 py-4" style={{ borderColor: "var(--line)" }}>
        <Eyebrow>Scoring</Eyebrow>
        <ul className="mt-3 space-y-2 text-[12px]">
          <ScoreRule label="Defuse the spike" points={40} tier="critical" />
          <ScoreRule label="Keep your team alive" points={25} tier="important" />
          <ScoreRule label="Win gunfights" points={20} tier="important" />
          <ScoreRule label="Use utility efficiently" points={15} tier="minor" />
        </ul>
      </div>

      <div className="mt-2 border-t px-4 py-4" style={{ borderColor: "var(--line)" }}>
        <Eyebrow>What&apos;s next</Eyebrow>
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--ink-dim)]">
          Draw an entry path for{" "}
          <span className="font-medium text-[color:var(--ink)]">Jett</span>.
          Then press{" "}
          <span className="font-medium" style={{ color: "var(--amber)" }}>
            Run simulation
          </span>
          .
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--line)" }}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: "75%", background: "var(--amber)" }}
            />
          </div>
          <span className="font-mono text-[10px] text-[color:var(--ink-mute)]">3/4</span>
        </div>
      </div>
    </aside>
  );
}

function ScoreRule({
  label,
  points,
  tier,
}: {
  label: string;
  points: number;
  tier: "critical" | "important" | "minor";
}) {
  const color =
    tier === "critical" ? red : tier === "important" ? amber : inkDim;
  return (
    <li className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[color:var(--ink-dim)]">{label}</span>
      </div>
      <span className="font-mono text-[color:var(--ink)]">{points}</span>
    </li>
  );
}

function UtilityInventory() {
  const items = [
    { agent: "sova", name: "Recon Dart", remaining: 1, total: 1 },
    { agent: "sova", name: "Nanoswarm", remaining: 0, total: 1 },
    { agent: "omen", name: "Dark Cover", remaining: 0, total: 1 },
    { agent: "omen", name: "Paranoia", remaining: 1, total: 1 },
    { agent: "jett", name: "Cloudburst", remaining: 1, total: 1 },
    { agent: "jett", name: "Updraft", remaining: 1, total: 1 },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="mr-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
        Utility inventory
      </span>
      {items.map((it) => (
        <div
          key={it.agent + it.name}
          className="flex items-center gap-1.5 rounded-md border px-2 py-1"
          style={{
            borderColor: it.remaining === 0 ? "var(--line-soft)" : "var(--line)",
            opacity: it.remaining === 0 ? 0.45 : 1,
            background: it.remaining === 0 ? "transparent" : "var(--panel-soft)",
          }}
        >
          <div className="h-5 w-5 overflow-hidden rounded">
            <Image
              src={`/assets/agents/${cap(it.agent)}_icon.webp`}
              alt={it.agent}
              width={20}
              height={20}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          </div>
          <span className="text-[11px] text-[color:var(--ink-dim)]">
            {it.name.split(" ")[0]}
          </span>
          <span
            className="font-mono text-[10px]"
            style={{ color: it.remaining === 0 ? inkMute : amber }}
          >
            {it.remaining}/{it.total}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Results mockup ──────────────────────────────────────────────────────────

function ResultsMockup() {
  return (
    <section className="mx-auto max-w-7xl px-6">
      <FrameBrowser url="retake.app/results" minWidth={1200}>
        <div
          className="p-6"
          style={{ background: "var(--bg)", minHeight: 720 }}
        >
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
              Scenario #147 · Ascent B Site · 3v2
            </span>
          </div>

          <div className="mt-8 grid gap-6" style={{ gridTemplateColumns: "1.05fr 1fr" }}>
            {/* Grade hero */}
            <div
              className="relative flex flex-col justify-between overflow-hidden rounded-xl border p-8"
              style={{
                borderColor: "var(--line)",
                background:
                  "radial-gradient(circle at 20% 10%, rgba(245,177,60,0.12) 0%, rgba(245,177,60,0) 50%), var(--panel)",
                minHeight: 440,
              }}
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--amber)]">
                  Round won · spike defused
                </p>
                <h2 className="mt-2 text-[28px] font-semibold tracking-tight">
                  Clean retake — Jett clutched with 2s on the clock.
                </h2>
              </div>

              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
                    Grade
                  </p>
                  <div className="mt-1 flex items-end gap-3">
                    <span
                      className="leading-none font-semibold tracking-tighter"
                      style={{
                        color: "var(--amber)",
                        fontSize: 140,
                        lineHeight: 1,
                      }}
                    >
                      S
                    </span>
                    <div className="mb-4">
                      <p className="font-mono text-[28px] leading-none">91</p>
                      <p className="text-[11px] text-[color:var(--ink-mute)]">/ 100</p>
                    </div>
                  </div>
                </div>
                <PercentileArc percentile={97} />
              </div>
            </div>

            {/* Breakdown column */}
            <div className="space-y-4">
              <RuleBreakdown />
              <MomentsPanel />
            </div>
          </div>

          {/* Timeline */}
          <PhaseTimeline />

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <CTA primary>Share your grade →</CTA>
            <button
              className="rounded-lg border px-4 py-3 text-[13px] font-medium"
              style={{ borderColor: "var(--line)", color: "var(--ink-dim)" }}
            >
              Replay cinematic
            </button>
            <button
              className="rounded-lg border px-4 py-3 text-[13px] font-medium"
              style={{ borderColor: "var(--line)", color: "var(--ink-dim)" }}
            >
              Scrim mode · re-run with tweaks
            </button>
            <span className="ml-auto font-mono text-[11px] text-[color:var(--ink-mute)]">
              Next puzzle · 13h 42m
            </span>
          </div>
        </div>
      </FrameBrowser>
    </section>
  );
}

function PercentileArc({ percentile }: { percentile: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const off = c * (1 - percentile / 100);
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--amber)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[20px] font-semibold">{percentile}%</span>
        <span className="text-[9px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
          percentile
        </span>
      </div>
    </div>
  );
}

function RuleBreakdown() {
  const rules = [
    { label: "Spike defused", earned: 40, max: 40 },
    { label: "Team survived", earned: 20, max: 25 },
    { label: "Cleared defenders", earned: 20, max: 20 },
    { label: "Utility efficiency", earned: 11, max: 15 },
  ];
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <Eyebrow>Score breakdown</Eyebrow>
      <div className="mt-3 space-y-3">
        {rules.map((r) => {
          const pct = (r.earned / r.max) * 100;
          const perfect = r.earned === r.max;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[color:var(--ink-dim)]">{r.label}</span>
                <span className="font-mono">
                  <span style={{ color: perfect ? teal : ink }}>{r.earned}</span>
                  <span className="text-[color:var(--ink-mute)]"> / {r.max}</span>
                </span>
              </div>
              <div
                className="mt-1 h-1.5 rounded-full"
                style={{ background: "var(--line)" }}
              >
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: perfect ? teal : amber,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MomentsPanel() {
  const moments = [
    {
      t: "08s",
      color: teal,
      title: "Paranoia clears Heaven",
      body: "Omen blinded Killjoy through the wall, opening site for free.",
    },
    {
      t: "04s",
      color: amber,
      title: "Recon dart spotted lurker",
      body: "Sova revealed Raze in Market before the flank landed.",
    },
    {
      t: "02s",
      color: red,
      title: "Sage trade missed",
      body: "Jett died to Cypher off-angle. Could have swung with Updraft.",
    },
  ];
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="flex items-center justify-between">
        <Eyebrow>Key moments</Eyebrow>
        <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
          click to scrub
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {moments.map((m) => (
          <button
            key={m.t}
            className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-[color:var(--panel-soft)]"
            style={{ borderColor: "var(--line)", background: "var(--panel-soft)" }}
          >
            <span
              className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold"
              style={{
                background: `${m.color}22`,
                color: m.color,
              }}
            >
              {m.t}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{m.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[color:var(--ink-dim)]">
                {m.body}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PhaseTimeline() {
  const phases = [
    { key: "Setup", dur: 3, color: inkDim },
    { key: "Utility", dur: 6, color: violet },
    { key: "Move", dur: 8, color: amber },
    { key: "Fight", dur: 12, color: red },
    { key: "Defuse", dur: 7, color: teal },
  ];
  const total = phases.reduce((a, b) => a + b.dur, 0);
  return (
    <div
      className="mt-6 rounded-xl border p-5"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div className="flex items-center justify-between">
        <Eyebrow>Round timeline</Eyebrow>
        <span className="font-mono text-[11px] text-[color:var(--ink-mute)]">36s total</span>
      </div>

      <div className="mt-3 flex h-8 w-full overflow-hidden rounded-md">
        {phases.map((p) => (
          <div
            key={p.key}
            className="flex items-center justify-center text-[10px] uppercase tracking-wider"
            style={{
              flexBasis: `${(p.dur / total) * 100}%`,
              background: `${p.color}1f`,
              color: p.color,
              borderRight: "1px solid var(--bg)",
            }}
          >
            {p.key}
          </div>
        ))}
      </div>

      <div className="mt-2 flex text-[10px] font-mono text-[color:var(--ink-mute)]">
        {phases.map((p, i) => {
          const elapsed = phases.slice(0, i + 1).reduce((a, b) => a + b.dur, 0);
          return (
            <div
              key={p.key}
              className="text-right"
              style={{ flexBasis: `${(p.dur / total) * 100}%` }}
            >
              {elapsed}s
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Design system ───────────────────────────────────────────────────────────

function DesignSystem() {
  const swatches = [
    { name: "Base", hex: bg, role: "Backdrop" },
    { name: "Panel", hex: panel, role: "Cards & rails" },
    { name: "Panel soft", hex: panelSoft, role: "Nested surfaces" },
    { name: "Ink", hex: ink, role: "Primary text" },
    { name: "Ink dim", hex: inkDim, role: "Body copy" },
    { name: "Ink mute", hex: inkMute, role: "Captions, labels" },
    { name: "Red", hex: red, role: "Critical · primary CTA" },
    { name: "Amber", hex: amber, role: "Tactical accent · progress" },
    { name: "Teal", hex: teal, role: "Utility · success" },
    { name: "Violet", hex: violet, role: "Smokes · controllers" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6">
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Palette</Eyebrow>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {swatches.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div
                    className="h-8 w-8 shrink-0 rounded"
                    style={{
                      background: s.hex,
                      border: "1px solid var(--line)",
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium">{s.name}</p>
                    <p className="font-mono text-[10px] text-[color:var(--ink-mute)]">
                      {s.hex}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-[color:var(--ink-dim)]">
                    {s.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>Voice & type</Eyebrow>
            <div className="mt-3 space-y-3">
              <div
                className="rounded-md border p-4"
                style={{ borderColor: "var(--line)", background: "var(--panel-soft)" }}
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-mute)]">
                  Before
                </p>
                <p
                  className="mt-2 font-mono text-[15px] uppercase tracking-widest"
                  style={{ color: "#00ffff" }}
                >
                  EXECUTE PHASE 1
                </p>
              </div>
              <div
                className="rounded-md border p-4"
                style={{
                  borderColor: "rgba(245,177,60,0.4)",
                  background: "rgba(245,177,60,0.06)",
                }}
              >
                <p
                  className="text-[11px] uppercase tracking-[0.22em]"
                  style={{ color: "var(--amber)" }}
                >
                  After
                </p>
                <p className="mt-2 text-[18px] font-semibold">
                  Run simulation
                </p>
                <p className="mt-1 text-[12px] text-[color:var(--ink-dim)]">
                  Sentence-case, task-oriented. Monospace reserved for numbers,
                  timers and coordinates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

function FrameBrowser({
  url,
  children,
  minWidth = 1200,
}: {
  url: string;
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-2xl"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--line)", background: "var(--panel-soft)" }}
      >
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: "#FF5F57" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#FEBC2E" }} />
          <span className="h-3 w-3 rounded-full" style={{ background: "#28C840" }} />
        </div>
        <div
          className="ml-2 flex-1 rounded-md px-3 py-1 font-mono text-[11px]"
          style={{ background: "var(--bg)", color: "var(--ink-dim)" }}
        >
          {url}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
