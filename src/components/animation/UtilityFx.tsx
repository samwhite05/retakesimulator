"use client";

/**
 * UtilityFx — cinematic-grade utility animations for the sim playback.
 *
 * Unlike the planning glyphs (`UtilityGlyph`), these have a well-defined
 * lifecycle: spawn (dramatic entry) → sustain (gentle ambient) → decay (fade).
 * Age is driven by the parent's `now` prop so the whole cinematic shares one
 * RAF clock and FX pop / settle / fade in lock-step with the playback speed.
 *
 * Each FX component:
 *   - Accepts `age` (ms since spawn), `lifetimeMs`, and shape metrics.
 *   - Derives phase 0→1 and renders the matching Konva shapes.
 *   - Never mutates state — purely a function of its props.
 *
 * The parent (`CinematicPlayer`) is responsible for pushing new FX items on
 * sim events and pruning them once age > lifetimeMs + fadeMs.
 */

import { memo } from "react";
import { Group, Circle, Line, Ring, Arc } from "react-konva";

export type FxItem =
  | {
      id: string;
      kind: "smoke";
      bornAt: number;
      lifetimeMs: number;
      agentId: string;
      x: number;
      y: number;
      radius: number;
    }
  | {
      id: string;
      kind: "flash_travel";
      bornAt: number;
      lifetimeMs: number;
      agentId: string;
      path: { x: number; y: number }[];
    }
  | {
      id: string;
      kind: "flash_detonate";
      bornAt: number;
      lifetimeMs: number;
      agentId: string;
      x: number;
      y: number;
      angle: number;
      radius: number;
    }
  | {
      id: string;
      kind: "mollie";
      bornAt: number;
      lifetimeMs: number;
      agentId: string;
      x: number;
      y: number;
      radius: number;
    }
  | {
      id: string;
      kind: "dart_fire";
      bornAt: number;
      lifetimeMs: number;
      agentId: string;
      path: { x: number; y: number }[];
      scanRadius: number;
    }
  | {
      id: string;
      kind: "wall_raise";
      bornAt: number;
      lifetimeMs: number;
      agentId: string;
      tiles: { x: number; y: number }[];
      cellSize: number;
    }
  | {
      id: string;
      kind: "concussion";
      bornAt: number;
      lifetimeMs: number;
      x: number;
      y: number;
      radius: number;
    }
  | {
      id: string;
      kind: "reveal_ping";
      bornAt: number;
      lifetimeMs: number;
      x: number;
      y: number;
      radius: number;
    }
  | {
      id: string;
      kind: "trap_trigger";
      bornAt: number;
      lifetimeMs: number;
      x: number;
      y: number;
      radius: number;
    }
  | {
      id: string;
      kind: "heal_aura";
      bornAt: number;
      lifetimeMs: number;
      x: number;
      y: number;
      radius: number;
    };

type PaletteKey = "violet" | "amber" | "red" | "teal" | "iron" | "jett";

const PALETTE: Record<PaletteKey, { ring: string; fill: string; core: string; accent: string }> = {
  violet: { ring: "rgba(168,138,224,0.85)", fill: "rgba(130,100,200,0.22)", core: "rgba(196,172,240,0.85)", accent: "#c4acf0" },
  amber: { ring: "rgba(245,177,60,0.9)", fill: "rgba(245,177,60,0.22)", core: "rgba(255,225,150,0.9)", accent: "#f5b13c" },
  red: { ring: "rgba(255,110,80,0.9)", fill: "rgba(255,80,40,0.24)", core: "rgba(255,190,90,0.9)", accent: "#ff8a52" },
  teal: { ring: "rgba(93,212,190,0.9)", fill: "rgba(93,212,190,0.2)", core: "rgba(160,240,220,0.9)", accent: "#5dd4be" },
  iron: { ring: "rgba(200,210,230,0.85)", fill: "rgba(200,210,230,0.18)", core: "rgba(220,230,245,0.9)", accent: "#c8d2e6" },
  jett: { ring: "rgba(220,230,240,0.85)", fill: "rgba(220,230,240,0.2)", core: "rgba(240,250,255,0.9)", accent: "#dce6f0" },
};

function smokePalette(agentId: string) {
  if (agentId === "jett") return PALETTE.jett;
  if (agentId === "viper") return { ring: "rgba(140,230,120,0.9)", fill: "rgba(110,200,90,0.25)", core: "rgba(180,250,140,0.9)", accent: "#8ce678" };
  if (agentId === "harbor") return { ring: "rgba(90,170,240,0.9)", fill: "rgba(70,150,220,0.22)", core: "rgba(160,220,255,0.9)", accent: "#5aaaf0" };
  return PALETTE.violet;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function lerpPathPoint(path: { x: number; y: number }[], t: number) {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  const scaled = clamp01(t) * (path.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(path.length - 1, i0 + 1);
  const f = scaled - i0;
  const a = path[i0];
  const b = path[i1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function pathHeading(path: { x: number; y: number }[], t: number) {
  if (path.length < 2) return 0;
  const scaled = clamp01(t) * (path.length - 1);
  const i0 = Math.max(0, Math.min(path.length - 2, Math.floor(scaled)));
  const a = path[i0];
  const b = path[i0 + 1];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// ─── Individual cinematic effects ───────────────────────────────────────

/** Expanding billow. Punches up in 650ms, breathes, then fades over the last 900ms of its life. */
const SmokeFx = memo(function SmokeFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "smoke" }>;
}) {
  const age = now - item.bornAt;
  const spawnMs = 650;
  const fadeMs = 900;
  const expand = easeOutCubic(clamp01(age / spawnMs));
  const deathT = clamp01((age - (item.lifetimeMs - fadeMs)) / fadeMs);
  const fade = 1 - deathT;
  const r = item.radius * expand;
  const pal = smokePalette(item.agentId);
  const breath = Math.sin((age / 1800) * Math.PI * 2) * 0.03 + 1;
  const puffs = 6;

  return (
    <Group x={item.x} y={item.y} opacity={fade} listening={false}>
      <Circle radius={r * 1.05 * breath} fill={pal.fill} opacity={0.35} />
      {Array.from({ length: puffs }).map((_, i) => {
        const ang = (i / puffs) * Math.PI * 2 + age * 0.0001;
        const pr = r * 0.52;
        const px = Math.cos(ang) * pr;
        const py = Math.sin(ang) * pr;
        const pb = Math.sin((age / 1600) * Math.PI * 2 + i) * 0.05 + 1;
        return (
          <Circle
            key={`p-${i}`}
            x={px}
            y={py}
            radius={r * 0.62 * pb}
            fill={pal.fill}
            opacity={0.75}
          />
        );
      })}
      <Circle radius={r} stroke={pal.ring} strokeWidth={1.5} opacity={0.75} dash={item.agentId === "jett" ? [5, 4] : undefined} />
      <Circle radius={r * 0.25} fill={pal.core} opacity={0.35} />
    </Group>
  );
});

/** Small glowing orb that tracks the thrown path + trail of dimmer copies. */
const FlashTravelFx = memo(function FlashTravelFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "flash_travel" }>;
}) {
  const age = now - item.bornAt;
  const t = clamp01(age / item.lifetimeMs);
  const p = lerpPathPoint(item.path, t);
  const heading = pathHeading(item.path, t);
  const trail = 4;
  return (
    <Group listening={false}>
      {Array.from({ length: trail }).map((_, i) => {
        const bt = clamp01(t - (i + 1) * 0.05);
        const tp = lerpPathPoint(item.path, bt);
        return (
          <Circle key={`trail-${i}`} x={tp.x} y={tp.y} radius={4 - i * 0.6} fill={PALETTE.amber.core} opacity={(1 - i / trail) * 0.4} />
        );
      })}
      <Circle x={p.x} y={p.y} radius={5} fill={PALETTE.amber.core} opacity={0.95} shadowColor={PALETTE.amber.ring} shadowBlur={10} />
      <Line
        points={[p.x - Math.cos(heading) * 6, p.y - Math.sin(heading) * 6, p.x + Math.cos(heading) * 8, p.y + Math.sin(heading) * 8]}
        stroke={PALETTE.amber.ring}
        strokeWidth={1.5}
        opacity={0.7}
      />
    </Group>
  );
});

/** White-hot burst + radial rays + secondary shock ring. */
const FlashDetonateFx = memo(function FlashDetonateFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "flash_detonate" }>;
}) {
  const age = now - item.bornAt;
  const t = clamp01(age / item.lifetimeMs);
  const ease = easeOutQuint(t);
  const rays = 16;
  const coreR = item.radius * (0.2 + ease * 0.8);
  const ringR = item.radius * (0.4 + ease * 1.15);
  const fade = 1 - t;

  return (
    <Group x={item.x} y={item.y} opacity={fade} listening={false}>
      {Array.from({ length: rays }).map((_, i) => {
        const ang = (i / rays) * Math.PI * 2;
        const r1 = coreR * 0.7;
        const r2 = item.radius * (0.5 + ease * 1.3);
        return (
          <Line
            key={`ray-${i}`}
            points={[Math.cos(ang) * r1, Math.sin(ang) * r1, Math.cos(ang) * r2, Math.sin(ang) * r2]}
            stroke={PALETTE.amber.core}
            strokeWidth={1.4}
            opacity={fade * 0.9}
          />
        );
      })}
      <Circle radius={ringR} stroke={PALETTE.amber.ring} strokeWidth={2} opacity={fade * 0.9} />
      <Circle radius={coreR} fill={PALETTE.amber.core} opacity={fade * 0.85} />
      <Circle radius={coreR * 0.55} fill="#ffffff" opacity={fade * 0.95} />
    </Group>
  );
});

/** Erupting flames with radial embers + flicker. Fades over last 800ms. */
const MollieFx = memo(function MollieFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "mollie" }>;
}) {
  const age = now - item.bornAt;
  const spawnMs = 350;
  const fadeMs = 800;
  const expand = easeOutCubic(clamp01(age / spawnMs));
  const deathT = clamp01((age - (item.lifetimeMs - fadeMs)) / fadeMs);
  const fade = 1 - deathT;
  const r = item.radius * expand;
  const flicker = Math.sin(age * 0.03) * 0.12 + Math.sin(age * 0.055 + 1.2) * 0.08 + 1;
  const embers = 7;
  const rot = age * 0.0006;

  return (
    <Group x={item.x} y={item.y} opacity={fade} listening={false}>
      <Circle radius={r} fill={PALETTE.red.fill} stroke={PALETTE.red.ring} strokeWidth={1.25} />
      <Group rotation={(rot * 180) / Math.PI}>
        {Array.from({ length: embers }).map((_, i) => {
          const ang = (i / embers) * Math.PI * 2;
          const r1 = r * 0.55;
          const r2 = r * (0.95 + Math.sin(age * 0.008 + i) * 0.06);
          return (
            <Line
              key={`ember-${i}`}
              points={[Math.cos(ang) * r1, Math.sin(ang) * r1, Math.cos(ang) * r2, Math.sin(ang) * r2]}
              stroke={PALETTE.red.ring}
              strokeWidth={1.2}
              opacity={0.65}
            />
          );
        })}
      </Group>
      <Circle radius={r * 0.5 * flicker} fill={PALETTE.red.fill} opacity={0.6} />
      <Circle radius={r * 0.32 * flicker} fill={PALETTE.red.core} opacity={0.85} />
      <Circle radius={r * 0.14 * flicker} fill="#fff4d0" opacity={0.75} />
    </Group>
  );
});

/** Arrow travels along the throw path, then pings 3 sonar waves at the endpoint. */
const DartFx = memo(function DartFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "dart_fire" }>;
}) {
  const age = now - item.bornAt;
  const travelMs = Math.min(500, item.lifetimeMs * 0.3);
  const travelT = clamp01(age / travelMs);
  const arrowPos = lerpPathPoint(item.path, travelT);
  const heading = pathHeading(item.path, travelT);
  const end = item.path[item.path.length - 1] ?? arrowPos;
  const pingAge = Math.max(0, age - travelMs);
  const pingLifetime = item.lifetimeMs - travelMs;

  return (
    <Group listening={false}>
      {travelT < 1 && (
        <Group x={arrowPos.x} y={arrowPos.y} rotation={(heading * 180) / Math.PI}>
          <Line points={[-6, -3, 8, 0, -6, 3]} closed fill={PALETTE.teal.core} opacity={0.95} />
        </Group>
      )}
      {travelT >= 1 && (
        <Group x={end.x} y={end.y}>
          {[0, 0.33, 0.66].map((offset, i) => {
            const t = clamp01((pingAge / pingLifetime) - offset);
            if (t <= 0) return null;
            const e = easeOutCubic(t);
            return (
              <Circle
                key={`dartring-${i}`}
                radius={item.scanRadius * e}
                stroke={PALETTE.teal.ring}
                strokeWidth={1.5}
                opacity={(1 - t) * 0.7}
              />
            );
          })}
          <Circle radius={4} fill={PALETTE.teal.core} opacity={0.9} />
        </Group>
      )}
    </Group>
  );
});

/** Segmented wall that raises across its length, then sustains for lifetime. */
const WallFx = memo(function WallFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "wall_raise" }>;
}) {
  const age = now - item.bornAt;
  const spawnMs = 450;
  const fadeMs = 600;
  const spawnT = clamp01(age / spawnMs);
  const deathT = clamp01((age - (item.lifetimeMs - fadeMs)) / fadeMs);
  const fade = 1 - deathT;
  const revealCount = Math.ceil(item.tiles.length * spawnT);

  return (
    <Group opacity={fade} listening={false}>
      {item.tiles.slice(0, revealCount).map((tile, i) => {
        const tileT = clamp01((age - (i / item.tiles.length) * spawnMs) / 200);
        const scale = easeOutCubic(tileT);
        return (
          <Group key={`w-${i}`} x={tile.x} y={tile.y}>
            <Circle radius={item.cellSize * 0.6 * scale} fill={PALETTE.teal.fill} opacity={0.5} />
            <Circle radius={item.cellSize * 0.4 * scale} fill={PALETTE.teal.ring} opacity={0.55} />
            <Circle radius={item.cellSize * 0.22 * scale} fill={PALETTE.teal.core} opacity={0.75} />
          </Group>
        );
      })}
    </Group>
  );
});

/** Radial shockwave for concussions + grav-wells + trap triggers — same shape, different palette. */
function ShockwaveFx({
  now,
  item,
  palette,
}: {
  now: number;
  item: { bornAt: number; lifetimeMs: number; x: number; y: number; radius: number };
  palette: { ring: string; fill: string; core: string };
}) {
  const age = now - item.bornAt;
  const t = clamp01(age / item.lifetimeMs);
  const waves = 3;
  return (
    <Group x={item.x} y={item.y} opacity={1 - t} listening={false}>
      {Array.from({ length: waves }).map((_, i) => {
        const wt = clamp01((t - i * 0.15) * 1.3);
        if (wt <= 0) return null;
        const e = easeOutCubic(wt);
        return (
          <Ring
            key={`shock-${i}`}
            innerRadius={item.radius * e * 0.9}
            outerRadius={item.radius * e}
            fill={palette.ring}
            opacity={(1 - wt) * 0.8}
          />
        );
      })}
      <Circle radius={item.radius * 0.12} fill={palette.core} opacity={0.9} />
    </Group>
  );
}

/** Short blue sweep above a revealed enemy. */
const RevealPingFx = memo(function RevealPingFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "reveal_ping" }>;
}) {
  const age = now - item.bornAt;
  const t = clamp01(age / item.lifetimeMs);
  const e = easeOutCubic(t);
  const pal = PALETTE.teal;
  return (
    <Group x={item.x} y={item.y} opacity={1 - t} listening={false}>
      <Circle radius={item.radius * e} stroke={pal.ring} strokeWidth={1.75} opacity={0.85} />
      <Arc
        innerRadius={item.radius * e * 0.5}
        outerRadius={item.radius * e * 0.55}
        angle={360 * e}
        rotation={-90}
        stroke={pal.core}
        strokeWidth={1}
      />
      <Circle radius={3} fill={pal.core} opacity={0.9} />
    </Group>
  );
});

const HealAuraFx = memo(function HealAuraFx({
  now,
  item,
}: {
  now: number;
  item: Extract<FxItem, { kind: "heal_aura" }>;
}) {
  const age = now - item.bornAt;
  const t = clamp01(age / item.lifetimeMs);
  const pal = PALETTE.teal;
  return (
    <Group x={item.x} y={item.y} opacity={1 - t * 0.6} listening={false}>
      <Circle radius={item.radius * (0.4 + t * 0.7)} stroke={pal.ring} strokeWidth={1.5} opacity={(1 - t) * 0.6} />
      {[0, 1, 2].map((i) => {
        const crossT = clamp01(t * 1.3 - i * 0.15);
        const off = -item.radius * 0.4 * crossT;
        return (
          <Group key={`hp-${i}`} x={i * 4 - 4} y={off}>
            <Line points={[-3, 0, 3, 0]} stroke={pal.core} strokeWidth={1.5} />
            <Line points={[0, -3, 0, 3]} stroke={pal.core} strokeWidth={1.5} />
          </Group>
        );
      })}
    </Group>
  );
});

// ─── Public layer component ─────────────────────────────────────────────

/** Renders the full list of active effects. Called every frame from CinematicPlayer. */
export const UtilityFxLayer = memo(function UtilityFxLayer({
  items,
  now,
}: {
  items: FxItem[];
  now: number;
}) {
  return (
    <>
      {items.map((item) => {
        switch (item.kind) {
          case "smoke":
            return <SmokeFx key={item.id} now={now} item={item} />;
          case "flash_travel":
            return <FlashTravelFx key={item.id} now={now} item={item} />;
          case "flash_detonate":
            return <FlashDetonateFx key={item.id} now={now} item={item} />;
          case "mollie":
            return <MollieFx key={item.id} now={now} item={item} />;
          case "dart_fire":
            return <DartFx key={item.id} now={now} item={item} />;
          case "wall_raise":
            return <WallFx key={item.id} now={now} item={item} />;
          case "concussion":
            return <ShockwaveFx key={item.id} now={now} item={item} palette={PALETTE.amber} />;
          case "trap_trigger":
            return <ShockwaveFx key={item.id} now={now} item={item} palette={PALETTE.red} />;
          case "reveal_ping":
            return <RevealPingFx key={item.id} now={now} item={item} />;
          case "heal_aura":
            return <HealAuraFx key={item.id} now={now} item={item} />;
        }
      })}
    </>
  );
});
