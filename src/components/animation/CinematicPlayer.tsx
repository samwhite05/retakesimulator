"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Stage, Layer, Image, Circle, Text, Group } from "react-konva";
import useImage from "use-image";
import { SimulationLog, Scenario, GameEvent, SimulationPhase, UtilityType } from "@/types";
import { GRID_COLS, getAbilityDisplayInfo, getAgentDef } from "@/lib/constants";
import { getAgentIconUrl } from "@/lib/assets";
import { useAnimationClock } from "@/lib/useAnimationClock";
import { UtilityFxLayer, type FxItem } from "@/components/animation/UtilityFx";

/** Distributive Omit so unions like `FxItem` still narrow on `kind` after stripping id/bornAt. */
type DistributiveOmit<T, K extends keyof FxItem> = T extends unknown ? Omit<T, K> : never;

const PHASE_ORDER: SimulationPhase[] = [
  "setup",
  "utility",
  "movement",
  "movement_entry",
  "movement_reposition",
  "combat",
  "spike",
];

function phaseOrderIndex(phase: SimulationPhase): number {
  const i = PHASE_ORDER.indexOf(phase);
  return i === -1 ? 999 : i;
}

function isTurboForPhase(phase: SimulationPhase, turboUntilPhase: SimulationPhase | undefined): boolean {
  if (!turboUntilPhase) return false;
  return phaseOrderIndex(phase) < phaseOrderIndex(turboUntilPhase);
}

interface CinematicPlayerProps {
  log: SimulationLog;
  scenario: Scenario;
  width: number;
  height: number;
  onComplete?: () => void;
  /** Phases strictly before this play with shortened delays. */
  turboUntilPhase?: SimulationPhase;
}

type AgentState = {
  x: number;
  y: number;
  alive: boolean;
  blinded: boolean;
};

type PhaseLabel = "Utility" | "Entry" | "Combat" | "Defuse" | "Spike";

function phaseChyron(phase: SimulationPhase): PhaseLabel | null {
  if (phase === "setup") return null;
  if (phase === "utility") return "Utility";
  if (phase === "movement" || phase === "movement_entry" || phase === "movement_reposition") return "Entry";
  if (phase === "combat") return "Combat";
  if (phase === "spike") return "Spike";
  return null;
}

type FeedEntry = {
  id: string;
  tone: "teal" | "red" | "amber" | "violet" | "ink";
  icon: string;
  text: string;
};

function displayName(agentId: string): string {
  const def = getAgentDef(agentId);
  if (def) return def.displayName;
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

export default function CinematicPlayer({
  log,
  scenario,
  width,
  height,
  onComplete,
  turboUntilPhase,
}: CinematicPlayerProps) {
  const [minimapImage] = useImage(scenario.minimapImage);
  const [phaseText, setPhaseText] = useState<PhaseLabel | null>(null);
  const [beatTone, setBeatTone] = useState<"neutral" | "violet" | "amber" | "red" | "teal">("neutral");
  const [damageNumbers, setDamageNumbers] = useState<{ x: number; y: number; value: number; id: string }[]>([]);
  const [deaths, setDeaths] = useState<{ x: number; y: number; id: string }[]>([]);
  const [fx, setFx] = useState<FxItem[]>([]);
  const fxCounterRef = useRef(0);
  const fxNow = useAnimationClock();
  const [defusePulse, setDefusePulse] = useState(false);
  const [spikeFlash, setSpikeFlash] = useState(false);

  const pushFx = useCallback((item: DistributiveOmit<FxItem, "id" | "bornAt">) => {
    fxCounterRef.current += 1;
    const id = `fx-${fxCounterRef.current}`;
    const bornAt = performance.now();
    setFx((prev) => [...prev, { ...item, id, bornAt } as FxItem]);
  }, []);

  // Prune finished FX so the layer stays small. Gives a comfortable 300ms tail
  // past stated lifetime so fade-outs finish cleanly at any playback speed.
  useEffect(() => {
    if (fx.length === 0) return;
    const id = setInterval(() => {
      const now = performance.now();
      setFx((prev) => prev.filter((it) => now - it.bornAt < it.lifetimeMs + 300));
    }, 250);
    return () => clearInterval(id);
  }, [fx.length]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [spikeSecondsLeft, setSpikeSecondsLeft] = useState<number>(45);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [skipRequested, setSkipRequested] = useState(false);
  const [completed, setCompleted] = useState(false);

  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  const skipRef = useRef(skipRequested);
  useEffect(() => {
    skipRef.current = skipRequested;
  }, [skipRequested]);

  const mapSize = Math.min(width, height);
  const paddingX = (width - mapSize) / 2;
  const paddingY = (height - mapSize) / 2;
  const cellSize = mapSize / GRID_COLS;

  const [agents, setAgents] = useState<Record<string, AgentState>>(() => {
    const ms = Math.min(width, height);
    const px = (width - ms) / 2;
    const py = (height - ms) / 2;
    const initial: Record<string, AgentState> = {};
    for (const turn of log.turns) {
      for (const evt of turn.events) {
        if (evt.type === "agent_spawn") {
          const c = { x: px + evt.position.x * ms, y: py + evt.position.y * ms };
          initial[evt.agentId] = { x: c.x, y: c.y, alive: true, blinded: false };
        }
      }
    }
    return initial;
  });

  const agentsRef = useRef(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const mergeAgents = (next: Record<string, AgentState>) => {
    agentsRef.current = next;
    setAgents(next);
  };

  const defenderIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of scenario.enemyAgents) s.add(e.id);
    for (const e of scenario.hiddenEnemies) s.add(e.id);
    return s;
  }, [scenario]);

  const aliveAttackers = useMemo(
    () => Object.entries(agents).filter(([id, s]) => s.alive && !defenderIdSet.has(id)).length,
    [agents, defenderIdSet]
  );
  const aliveDefenders = useMemo(
    () => Object.entries(agents).filter(([id, s]) => s.alive && defenderIdSet.has(id)).length,
    [agents, defenderIdSet]
  );
  const totalAttackers = useMemo(
    () => Object.keys(agents).filter((id) => !defenderIdSet.has(id)).length,
    [agents, defenderIdSet]
  );
  const totalDefenders = useMemo(
    () => Object.keys(agents).filter((id) => defenderIdSet.has(id)).length,
    [agents, defenderIdSet]
  );

  const pushFeed = useCallback((entry: Omit<FeedEntry, "id">) => {
    setFeed((prev) => {
      const next = [...prev, { ...entry, id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }];
      return next.slice(-6);
    });
  }, []);

  const dimsRef = useRef({ width, height });
  useEffect(() => {
    dimsRef.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    let cancelled = false;
    const { width: w, height: h } = dimsRef.current;
    const ms = Math.min(w, h);

    const tc = (pos: { x: number; y: number }) => ({
      x: (w - ms) / 2 + pos.x * ms,
      y: (h - ms) / 2 + pos.y * ms,
    });
    const cs = ms / GRID_COLS;

    /** Sleep adjusted for playback speed, pause and skip. */
    const wait = async (ms: number): Promise<void> => {
      if (skipRef.current) return;
      const adjusted = Math.max(4, ms / speedRef.current);
      const start = Date.now();
      let remaining = adjusted;
      while (remaining > 0) {
        if (cancelled || skipRef.current) return;
        const slice = Math.min(remaining, 40);
        await new Promise<void>((res) => setTimeout(res, slice));
        if (pausedRef.current) {
          // Freeze time while paused: reset the clock.
          while (pausedRef.current && !cancelled && !skipRef.current) {
            await new Promise<void>((res) => setTimeout(res, 50));
          }
          remaining = adjusted - (Date.now() - start);
        } else {
          remaining -= slice;
        }
      }
    };

    async function animateAgentMove(
      agentId: string,
      path: { x: number; y: number }[],
      duration: number
    ) {
      if (path.length < 2) return;
      const stepDuration = duration / (path.length - 1);
      for (let i = 1; i < path.length; i++) {
        if (cancelled || skipRef.current) return;
        const prev = agentsRef.current[agentId];
        const base = prev || { x: path[0].x, y: path[0].y, alive: true, blinded: false };
        mergeAgents({
          ...agentsRef.current,
          [agentId]: { ...base, x: path[i].x, y: path[i].y },
        });
        await wait(stepDuration);
      }
    }

    async function processEvent(evt: GameEvent) {
      switch (evt.type) {
        case "agent_spawn": {
          const c = tc(evt.position);
          mergeAgents({
            ...agentsRef.current,
            [evt.agentId]: { x: c.x, y: c.y, alive: true, blinded: false },
          });
          await wait(90);
          break;
        }
        case "smoke_expand": {
          const c = tc(evt.position);
          const info = getAbilityDisplayInfo(evt.agentId, "smoke");
          const radiusPx = evt.radius * cs * 1.0;
          pushFx({
            kind: "smoke",
            agentId: evt.agentId,
            lifetimeMs: info.durationSec * 1000,
            x: c.x,
            y: c.y,
            radius: radiusPx,
          });
          pushFeed({ tone: "violet", icon: "◎", text: `${displayName(evt.agentId)} · ${info.name}` });
          await wait(460);
          break;
        }
        case "flash_travel": {
          const path = evt.path.map(tc);
          if (path.length >= 2) {
            pushFx({
              kind: "flash_travel",
              agentId: evt.agentId,
              lifetimeMs: 260,
              path,
            });
          }
          await wait(260);
          break;
        }
        case "flash_detonate": {
          const c = tc(evt.position);
          const info = getAbilityDisplayInfo(evt.agentId, "flash");
          const radiusPx = cs * 3.5;
          pushFx({
            kind: "flash_detonate",
            agentId: evt.agentId,
            lifetimeMs: 600,
            x: c.x,
            y: c.y,
            angle: evt.angle,
            radius: radiusPx,
          });
          pushFeed({ tone: "amber", icon: "✷", text: `${displayName(evt.agentId)} · ${info.name}` });
          await wait(360);
          break;
        }
        case "mollie_erupt": {
          const c = tc(evt.position);
          const type: UtilityType = evt.agentId === "killjoy" ? "nanoswarm" : "mollie";
          const info = getAbilityDisplayInfo(evt.agentId, type);
          const radiusPx = evt.radius * cs;
          pushFx({
            kind: "mollie",
            agentId: evt.agentId,
            lifetimeMs: info.durationSec * 1000,
            x: c.x,
            y: c.y,
            radius: radiusPx,
          });
          pushFeed({ tone: "red", icon: "✹", text: `${displayName(evt.agentId)} · ${info.name}` });
          await wait(400);
          break;
        }
        case "dart_fire": {
          const path = evt.path.map(tc);
          const info = getAbilityDisplayInfo(evt.agentId, "dart");
          const scanRadius = cs * 4;
          pushFx({
            kind: "dart_fire",
            agentId: evt.agentId,
            lifetimeMs: info.durationSec * 1000,
            path,
            scanRadius,
          });
          pushFeed({ tone: "teal", icon: "◊", text: `${displayName(evt.agentId)} · ${info.name}` });
          await wait(520);
          break;
        }
        case "reveal": {
          const c = tc(evt.position);
          pushFx({
            kind: "reveal_ping",
            lifetimeMs: 900,
            x: c.x,
            y: c.y,
            radius: cs * 1.4,
          });
          pushFeed({ tone: "teal", icon: "◉", text: `${displayName(evt.revealedEnemy)} spotted` });
          await wait(200);
          break;
        }
        case "wall_raise": {
          const pts = evt.tiles.map(tc);
          const info = getAbilityDisplayInfo(evt.agentId, "wall");
          pushFx({
            kind: "wall_raise",
            agentId: evt.agentId,
            lifetimeMs: info.durationSec * 1000,
            tiles: pts,
            cellSize: cs,
          });
          pushFeed({ tone: "teal", icon: "▤", text: `${displayName(evt.agentId)} · ${info.name}` });
          await wait(420);
          break;
        }
        case "trap_trigger": {
          const c = tc(evt.position);
          pushFx({
            kind: "trap_trigger",
            lifetimeMs: 750,
            x: c.x,
            y: c.y,
            radius: cs * 2.5,
          });
          pushFeed({ tone: "red", icon: "✕", text: `${displayName(evt.agentId)} trap hits ${displayName(evt.victim)}` });
          await wait(300);
          break;
        }
        case "heal": {
          const target = agentsRef.current[evt.target];
          if (target) {
            pushFx({
              kind: "heal_aura",
              lifetimeMs: 900,
              x: target.x,
              y: target.y,
              radius: cs * 1.4,
            });
          }
          pushFeed({ tone: "teal", icon: "✚", text: `${displayName(evt.agentId)} heals ${displayName(evt.target)} +${evt.amount}` });
          await wait(280);
          break;
        }
        case "agent_move": {
          const path = evt.path.map(tc);
          const duration = evt.speed === "dash" ? 380 : 720;
          await animateAgentMove(evt.agentId, path, duration);
          break;
        }
        case "duel": {
          const loserId = evt.winner === evt.attacker ? evt.defender : evt.attacker;
          const st = agentsRef.current[loserId];
          const id = `dmg-${Date.now()}`;
          if (st) {
            setDamageNumbers((prev) => [...prev, { x: st.x, y: st.y - 22, value: evt.damage, id }]);
            setTimeout(() => {
              setDamageNumbers((prev) => prev.filter((d) => d.id !== id));
            }, 900);
          }
          await wait(300);
          break;
        }
        case "kill": {
          const c = tc(evt.position);
          setDeaths((prev) => [...prev, { x: c.x, y: c.y, id: `death-${Date.now()}` }]);
          mergeAgents({
            ...agentsRef.current,
            [evt.victim]: { ...agentsRef.current[evt.victim], alive: false },
          });
          const victimIsDefender = defenderIdSet.has(evt.victim);
          pushFeed({
            tone: victimIsDefender ? "teal" : "red",
            icon: "✕",
            text: `${displayName(evt.victim)} down`,
          });
          await wait(340);
          break;
        }
        case "defuse_start": {
          setDefusePulse(true);
          pushFeed({ tone: "teal", icon: "◈", text: `${displayName(evt.agentId)} defusing…` });
          await wait(520);
          break;
        }
        case "defuse_complete": {
          pushFeed({ tone: "teal", icon: "✔", text: `Spike defused` });
          await wait(400);
          setDefusePulse(false);
          break;
        }
        case "spike_explosion": {
          setSpikeFlash(true);
          pushFeed({ tone: "red", icon: "☢", text: `Spike detonates` });
          await wait(700);
          setSpikeFlash(false);
          break;
        }
        default:
          await wait(100);
      }
    }

    async function run() {
      // Seed a countdown: spike clock starts at 45 and ticks down on combat+spike phases.
      let clockTicker: ReturnType<typeof setInterval> | null = null;
      const startClock = () => {
        if (clockTicker) return;
        clockTicker = setInterval(() => {
          if (pausedRef.current || skipRef.current || cancelled) return;
          setSpikeSecondsLeft((s) => Math.max(0, s - 1 * speedRef.current));
        }, 1000);
      };

      for (const turn of log.turns) {
        if (cancelled) break;
        const turbo = isTurboForPhase(turn.phase, turboUntilPhase);
        const label = phaseChyron(turn.phase);

        if (turn.phase === "combat" || turn.phase === "spike") startClock();

        if (label && !turbo) {
          if (turn.phase === "utility") setBeatTone("violet");
          else if (turn.phase === "combat") setBeatTone("red");
          else if (turn.phase === "spike") setBeatTone("red");
          else setBeatTone("amber");
          setPhaseText(label);
          await wait(turn.phase === "utility" ? 380 : 260);
          setPhaseText(null);
        }

        for (const evt of turn.events) {
          if (cancelled) break;
          if (turbo) {
            // In turbo we still want persistent sim state (positions, deaths) and
            // any util with a lasting footprint (smokes, walls) to exist when the
            // user lands on the first real phase. Skip short-lived flashes + pings.
            if (
              evt.type === "agent_spawn" ||
              evt.type === "agent_move" ||
              evt.type === "kill" ||
              evt.type === "smoke_expand" ||
              evt.type === "wall_raise" ||
              evt.type === "mollie_erupt"
            ) {
              await processEvent(evt);
            }
            continue;
          }
          await processEvent(evt);
        }
      }

      if (clockTicker) clearInterval(clockTicker);

      if (!cancelled) {
        setCompleted(true);
        // Small hold before notifying parent so the final frame lands.
        await new Promise<void>((res) => setTimeout(res, 600));
        if (!cancelled) onComplete?.();
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [log, scenario, onComplete, turboUntilPhase, defenderIdSet, pushFeed, pushFx]);

  const beatToneClasses: Record<string, string> = {
    violet: "border-violet/40 bg-violet/10 text-violet",
    amber: "border-amber/40 bg-amber/10 text-amber",
    red: "border-valorant-red/40 bg-valorant-red/10 text-valorant-red",
    teal: "border-teal/40 bg-teal/10 text-teal",
    neutral: "border-border-12 bg-pure-black/75 text-ink",
  };

  const clockColor =
    spikeSecondsLeft <= 10
      ? "text-valorant-red"
      : spikeSecondsLeft <= 20
        ? "text-amber"
        : "text-ink";

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {/* Radial atmosphere overlays */}
      <div
        className={`pointer-events-none absolute inset-0 z-[15] transition-opacity duration-500 ${
          defusePulse ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(93,212,190,0.14) 0%, transparent 55%), radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 z-[16] bg-valorant-red/25 transition-opacity duration-300 ${
          spikeFlash ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* ── HUD: top bar ───────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-6 pt-5">
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border-10 bg-pure-black/70 px-3 py-2 backdrop-blur-md">
          <div className="h-6 w-1 rounded-sm bg-teal" />
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-mute">Attackers</div>
            <div className="flex items-baseline gap-1 font-mono text-[15px] font-semibold text-ink">
              {aliveAttackers}
              <span className="text-[11px] text-ink-mute">/ {totalAttackers}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full border border-border-10 bg-pure-black/70 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-dim backdrop-blur-md">
            {scenario.name} · <span className="text-ink-mute">{scenario.map}</span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border-12 bg-pure-black/85 px-4 py-1.5 backdrop-blur-md">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-valorant-red">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span className={`font-mono text-[16px] font-bold tabular-nums ${clockColor}`}>
              {Math.max(0, Math.floor(spikeSecondsLeft)).toString().padStart(2, "0")}
              <span className="text-ink-mute">.0</span>
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border-10 bg-pure-black/70 px-3 py-2 backdrop-blur-md">
          <div>
            <div className="text-right text-[9px] font-semibold uppercase tracking-[0.22em] text-ink-mute">Defenders</div>
            <div className="flex items-baseline justify-end gap-1 font-mono text-[15px] font-semibold text-ink">
              {aliveDefenders}
              <span className="text-[11px] text-ink-mute">/ {totalDefenders}</span>
            </div>
          </div>
          <div className="h-6 w-1 rounded-sm bg-valorant-red" />
        </div>
      </div>

      {/* ── Event feed ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute right-6 top-24 z-30 flex w-[240px] flex-col gap-1.5">
        {feed.map((entry) => {
          const toneClass: Record<FeedEntry["tone"], string> = {
            teal: "border-teal/30 bg-teal/10 text-teal",
            red: "border-valorant-red/30 bg-valorant-red/10 text-valorant-red",
            amber: "border-amber/30 bg-amber/10 text-amber",
            violet: "border-violet/30 bg-violet/10 text-violet",
            ink: "border-border-10 bg-pure-black/60 text-ink-dim",
          };
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] backdrop-blur-md ${toneClass[entry.tone]}`}
              style={{ animation: "fadeInFeed 180ms ease-out both" }}
            >
              <span className="font-mono text-[12px] leading-none">{entry.icon}</span>
              <span className="font-medium uppercase tracking-wide">{entry.text}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeInFeed {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <Stage width={width} height={height}>
        <Layer>
          {minimapImage && (
            <Image
              image={minimapImage}
              x={paddingX}
              y={paddingY}
              width={mapSize}
              height={mapSize}
              opacity={0.85}
            />
          )}
        </Layer>

        <Layer listening={false}>
          <UtilityFxLayer items={fx} now={fxNow} />
        </Layer>

        <Layer>
          {Object.entries(agents).map(([id, state]) => {
            if (!state.alive) return null;
            const isAttacker = !defenderIdSet.has(id);
            const def = getAgentDef(id);
            const name = def?.displayName ?? id;
            return (
              <AgentCircle
                key={id}
                x={state.x}
                y={state.y}
                radius={cellSize * 0.42}
                color={isAttacker ? "#5dd4be" : "#ff4655"}
                iconUrl={getAgentIconUrl(id)}
                label={name}
              />
            );
          })}
        </Layer>

        <Layer>
          {deaths.map((d) => (
            <Text key={d.id} x={d.x - 8} y={d.y - 8} text="✕" fontSize={16} fill="#ff4655" fontStyle="bold" />
          ))}
          {damageNumbers.map((d) => (
            <Text
              key={d.id}
              x={d.x}
              y={d.y}
              text={`-${d.value}`}
              fontSize={13}
              fill="#f5b13c"
              fontStyle="bold"
            />
          ))}
        </Layer>
      </Stage>

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          boxShadow: "inset 0 0 140px rgba(0,0,0,0.65)",
        }}
      />

      {/* ── Phase chyron (bottom) ──────────────────────────────────────── */}
      {phaseText && (
        <div className="pointer-events-none absolute bottom-24 left-0 right-0 z-30 flex justify-center px-4">
          <div
            className={`rounded-full border px-6 py-2 backdrop-blur-md transition-all ${beatToneClasses[beatTone]}`}
            style={{ animation: "fadeInFeed 260ms ease-out both" }}
          >
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.4em]">{phaseText}</span>
          </div>
        </div>
      )}

      {/* ── Playback controls ──────────────────────────────────────────── */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border-12 bg-pure-black/85 px-2 py-1.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Resume" : "Pause"}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface hover:text-ink"
        >
          {paused ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          )}
        </button>

        <div className="mx-1 flex items-center gap-0.5 rounded-full bg-surface/60 p-0.5">
          {([0.5, 1, 2] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                speed === s ? "bg-amber text-pure-black" : "text-ink-dim hover:text-ink"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSkipRequested(true)}
          disabled={completed}
          aria-label="Skip to end"
          className="flex h-8 items-center gap-1 rounded-full px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-dim transition-colors hover:bg-surface hover:text-ink disabled:opacity-40"
        >
          Skip
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 4 15 12 5 20 5 4" />
            <rect x="17" y="4" width="2.5" height="16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AgentCircle({
  x,
  y,
  radius,
  color,
  iconUrl,
  label,
}: {
  x: number;
  y: number;
  radius: number;
  color: string;
  iconUrl: string | null;
  label: string;
}) {
  const [img] = useImage(iconUrl || "");
  return (
    <Group x={x} y={y}>
      <Circle radius={radius + 2} fill={color} opacity={0.22} />
      <Circle radius={radius} fill="#0b0d11" stroke={color} strokeWidth={2.2} shadowBlur={10} shadowColor="rgba(0,0,0,0.6)" />
      {img && (
        <Group
          clipFunc={(ctx) => {
            ctx.arc(0, 0, Math.max(1, radius - 2), 0, Math.PI * 2);
            ctx.closePath();
          }}
        >
          <Image image={img} x={-radius} y={-radius} width={radius * 2} height={radius * 2} />
        </Group>
      )}
      <Text
        text={label}
        x={-40}
        y={radius + 4}
        width={80}
        align="center"
        fontSize={9}
        fontStyle="600"
        fill="#e9e4d6"
        shadowBlur={4}
        shadowColor="rgba(0,0,0,0.85)"
        shadowOpacity={0.9}
      />
    </Group>
  );
}
