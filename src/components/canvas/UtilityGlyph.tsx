"use client";

/**
 * UtilityGlyph — the animated planning-map representation of a single placed
 * utility (smoke, flash, mollie, wall, etc.).
 *
 * Design goals:
 *   - Each util type reads instantly from across the map without color overlap
 *     with paths, enemy cones, or agent pips. Palette is tied to
 *     `getUtilityTone()` so the whole UI stays coherent.
 *   - Motion is ambient and subtle (breathing, slow spin, ember drift) — never
 *     distracting while the player is planning. Cinematic bursts live in
 *     `UtilityFx` during simulation playback, not here.
 *   - Each glyph is built out of small, clearly-named primitives (cloud,
 *     shockRings, capsule, chevronMarch, sonar) so mechanics can swap shapes
 *     without rewriting render logic.
 */

import { memo, useMemo } from "react";
import { Group, Circle, Line, Rect, Ring, Arc } from "react-konva";
import { UtilityType } from "@/types";
import { getUtilityTone, UtilityTone } from "@/lib/constants";
import { useAnimationClock } from "@/lib/useAnimationClock";

type ToneColors = {
  ring: string;
  ringSoft: string;
  fill: string;
  fillSoft: string;
  core: string;
  accent: string;
};

const TONE_COLORS: Record<UtilityTone, ToneColors> = {
  violet: {
    ring: "rgba(168,138,224,0.85)",
    ringSoft: "rgba(168,138,224,0.45)",
    fill: "rgba(130,100,200,0.18)",
    fillSoft: "rgba(130,100,200,0.08)",
    core: "rgba(196,172,240,0.75)",
    accent: "#c4acf0",
  },
  amber: {
    ring: "rgba(245,177,60,0.9)",
    ringSoft: "rgba(245,177,60,0.45)",
    fill: "rgba(245,177,60,0.16)",
    fillSoft: "rgba(245,177,60,0.06)",
    core: "rgba(255,220,140,0.85)",
    accent: "#f5b13c",
  },
  red: {
    ring: "rgba(255,110,80,0.9)",
    ringSoft: "rgba(255,110,80,0.5)",
    fill: "rgba(255,80,40,0.2)",
    fillSoft: "rgba(255,80,40,0.08)",
    core: "rgba(255,180,80,0.85)",
    accent: "#ff8a52",
  },
  teal: {
    ring: "rgba(93,212,190,0.85)",
    ringSoft: "rgba(93,212,190,0.45)",
    fill: "rgba(93,212,190,0.14)",
    fillSoft: "rgba(93,212,190,0.06)",
    core: "rgba(160,240,220,0.85)",
    accent: "#5dd4be",
  },
  iron: {
    ring: "rgba(200,210,230,0.85)",
    ringSoft: "rgba(200,210,230,0.4)",
    fill: "rgba(200,210,230,0.12)",
    fillSoft: "rgba(200,210,230,0.05)",
    core: "rgba(220,230,245,0.85)",
    accent: "#c8d2e6",
  },
};

/** Lets a per-agent tweak override the baseline tone (e.g. Viper = toxic green, Jett = cold white). */
function getAgentTint(type: UtilityType, agentId: string): Partial<ToneColors> | null {
  if (type === "smoke") {
    if (agentId === "jett")
      return { ring: "rgba(220,230,240,0.85)", ringSoft: "rgba(220,230,240,0.4)", fill: "rgba(220,230,240,0.16)", fillSoft: "rgba(220,230,240,0.06)", core: "rgba(240,250,255,0.85)", accent: "#dce6f0" };
    if (agentId === "viper")
      return { ring: "rgba(140,230,120,0.9)", ringSoft: "rgba(140,230,120,0.45)", fill: "rgba(110,200,90,0.2)", fillSoft: "rgba(110,200,90,0.08)", core: "rgba(180,250,140,0.85)", accent: "#8ce678" };
    if (agentId === "harbor")
      return { ring: "rgba(90,170,240,0.85)", ringSoft: "rgba(90,170,240,0.45)", fill: "rgba(70,150,220,0.18)", fillSoft: "rgba(70,150,220,0.07)", core: "rgba(160,220,255,0.85)", accent: "#5aaaf0" };
  }
  if (type === "wall") {
    if (agentId === "phoenix")
      return { ring: "rgba(255,120,60,0.9)", accent: "#ff783c" };
    if (agentId === "sage")
      return { ring: "rgba(150,220,255,0.9)", accent: "#96dcff" };
    if (agentId === "viper")
      return { ring: "rgba(140,230,120,0.85)", accent: "#8ce678" };
    if (agentId === "harbor")
      return { ring: "rgba(80,160,240,0.85)", accent: "#50a0f0" };
    if (agentId === "neon")
      return { ring: "rgba(120,180,255,0.95)", accent: "#78b4ff" };
  }
  return null;
}

function resolveColors(type: UtilityType, agentId: string): ToneColors {
  const base = TONE_COLORS[getUtilityTone(type)];
  const tint = getAgentTint(type, agentId);
  return { ...base, ...(tint ?? {}) };
}

/** Sine eased 0→1→0 for ambient breathing, phase offset in radians. */
function breathe(t: number, periodMs: number, phase = 0): number {
  const theta = (t / periodMs) * Math.PI * 2 + phase;
  return (Math.sin(theta) + 1) / 2;
}

/** Normalised 0→1 sawtooth at the given period, for marching lines / rings. */
function march(t: number, periodMs: number, phase = 0): number {
  return (((t / periodMs) + phase) % 1 + 1) % 1;
}

export interface UtilityGlyphProps {
  type: UtilityType;
  agentId: string;
  center: { x: number; y: number };
  target?: { x: number; y: number } | null;
  path?: { x: number; y: number }[] | null;
  /** Primary pixel radius for circle-shaped utility (already scaled for the minimap). */
  radiusPx?: number;
  /** Pixel width/length/gap for capsule and wall shapes. */
  widthPx?: number;
  lengthPx?: number;
  gapPx?: number;
  /** Used as a fallback size unit for tiny glyphs (traps, tripwires). */
  cellSizePx: number;
  selected?: boolean;
}

function UtilityGlyphImpl(props: UtilityGlyphProps) {
  const { type, agentId, center, target, path, cellSizePx, selected } = props;
  const c = useMemo(() => resolveColors(type, agentId), [type, agentId]);
  const t = useAnimationClock();

  const selectedBoost = selected ? 1.08 : 1;

  switch (type) {
    case "smoke":
      return (
        <SmokeGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 2) * selectedBoost} colors={c} t={t} dashed={agentId === "jett"} />
      );
    case "flash": {
      if (props.widthPx && props.lengthPx) {
        return (
          <CapsuleFlashGlyph
            center={center}
            target={target ?? null}
            widthPx={props.widthPx}
            lengthPx={props.lengthPx}
            colors={c}
            t={t}
          />
        );
      }
      return <FlashGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 1.7) * selectedBoost} colors={c} t={t} />;
    }
    case "mollie":
    case "nanoswarm": {
      if (props.widthPx && props.lengthPx) {
        return (
          <CapsuleMollieGlyph
            center={center}
            target={target ?? null}
            widthPx={props.widthPx}
            lengthPx={props.lengthPx}
            colors={c}
            t={t}
          />
        );
      }
      return <MollieGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 1.4) * selectedBoost} colors={c} t={t} />;
    }
    case "dart":
      return <DartGlyph center={center} target={target ?? null} radiusPx={(props.radiusPx ?? cellSizePx * 2) * selectedBoost} colors={c} t={t} />;
    case "concussion": {
      if (props.widthPx && props.lengthPx) {
        return (
          <CapsuleConcussionGlyph
            center={center}
            target={target ?? null}
            widthPx={props.widthPx}
            lengthPx={props.lengthPx}
            colors={c}
            t={t}
          />
        );
      }
      return <ConcussionGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 1.8) * selectedBoost} colors={c} t={t} />;
    }
    case "wall":
      return (
        <WallGlyph
          center={center}
          target={target ?? null}
          widthPx={props.widthPx ?? cellSizePx * 0.35}
          lengthPx={props.lengthPx ?? cellSizePx * 8}
          colors={c}
          t={t}
        />
      );
    case "tripwire":
      return <TripwireGlyph path={path ?? null} colors={c} t={t} cellSizePx={cellSizePx} />;
    case "trap":
    case "alarm":
      return <TrapGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 1.2) * selectedBoost} colors={c} t={t} />;
    case "sensor":
    case "turret":
      return <SensorGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 1.6) * selectedBoost} colors={c} t={t} />;
    case "gravity_well":
      return <GravityWellGlyph center={center} radiusPx={(props.radiusPx ?? cellSizePx * 2) * selectedBoost} colors={c} t={t} />;
    default:
      return null;
  }
}

export const UtilityGlyph = memo(UtilityGlyphImpl);

// ─── Individual glyphs ────────────────────────────────────────────────────

/** Layered cloud that breathes and drifts. Reads as "vision denial" at any zoom. */
function SmokeGlyph({
  center,
  radiusPx,
  colors,
  t,
  dashed,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
  dashed?: boolean;
}) {
  const puffs = useMemo(() => {
    const out: { angle: number; dist: number; size: number; phase: number }[] = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      out.push({
        angle: (i / count) * Math.PI * 2,
        dist: 0.52,
        size: 0.62 + (i % 2) * 0.07,
        phase: i * 0.7,
      });
    }
    return out;
  }, []);

  const breath = breathe(t, 3600);

  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx * (1 + breath * 0.02)} fill={colors.fillSoft} />
      {puffs.map((p, i) => {
        const pb = breathe(t, 3200 + i * 140, p.phase);
        const px = Math.cos(p.angle + t * 0.00008) * radiusPx * p.dist;
        const py = Math.sin(p.angle + t * 0.00008) * radiusPx * p.dist;
        return (
          <Circle
            key={`puff-${i}`}
            x={px}
            y={py}
            radius={radiusPx * p.size * (0.96 + pb * 0.08)}
            fill={colors.fill}
            opacity={0.7 + pb * 0.3}
          />
        );
      })}
      <Circle
        radius={radiusPx}
        stroke={colors.ring}
        strokeWidth={1.5}
        dash={dashed ? [5, 4] : undefined}
        opacity={0.85}
      />
      <Circle radius={radiusPx * 0.3} fill={colors.core} opacity={0.2 + breath * 0.1} />
    </Group>
  );
}

/** Flash pop — bright core with pulsing outer radius + four emanating rays. */
function FlashGlyph({
  center,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const pulse = breathe(t, 1100);
  const rays = 8;
  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx} fill={colors.fill} stroke={colors.ring} strokeWidth={1.4} />
      {Array.from({ length: rays }).map((_, i) => {
        const angle = (i / rays) * Math.PI * 2 + t * 0.0004;
        const inner = radiusPx * (0.55 + pulse * 0.05);
        const outer = radiusPx * (1.05 + pulse * 0.08);
        return (
          <Line
            key={`ray-${i}`}
            points={[Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer]}
            stroke={colors.ringSoft}
            strokeWidth={1.25}
            opacity={0.55 + pulse * 0.35}
          />
        );
      })}
      <Circle radius={radiusPx * (0.38 + pulse * 0.08)} fill={colors.core} opacity={0.5 + pulse * 0.35} />
      <Circle radius={radiusPx * 0.18} fill="#fff" opacity={0.55 + pulse * 0.4} />
    </Group>
  );
}

/** Long flash capsule (Omen Paranoia, Breach Flashpoint, Tejo Special Delivery). */
function CapsuleFlashGlyph({
  center,
  target,
  widthPx,
  lengthPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  target: { x: number; y: number } | null;
  widthPx: number;
  lengthPx: number;
  colors: ToneColors;
  t: number;
}) {
  const { ux, uy, endX, endY } = useMemo(() => {
    const dx = (target?.x ?? center.x + lengthPx) - center.x;
    const dy = (target?.y ?? center.y) - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const uxv = dx / dist;
    const uyv = dy / dist;
    return { ux: uxv, uy: uyv, endX: center.x + uxv * lengthPx, endY: center.y + uyv * lengthPx };
  }, [center.x, center.y, target, lengthPx]);
  const pulse = breathe(t, 1200);
  const chev = march(t, 1500);
  const chevCount = 4;

  return (
    <Group listening={false}>
      <Line
        points={[center.x, center.y, endX, endY]}
        stroke={colors.fill}
        strokeWidth={widthPx}
        lineCap="round"
      />
      <Line
        points={[center.x, center.y, endX, endY]}
        stroke={colors.ring}
        strokeWidth={1.75}
        lineCap="round"
        opacity={0.9}
      />
      {Array.from({ length: chevCount }).map((_, i) => {
        const s = ((i / chevCount) + chev) % 1;
        const cx = center.x + ux * lengthPx * s;
        const cy = center.y + uy * lengthPx * s;
        const size = widthPx * 0.35;
        const px = -uy;
        const py = ux;
        return (
          <Line
            key={`chev-${i}`}
            points={[
              cx - ux * size + px * size,
              cy - uy * size + py * size,
              cx + ux * size,
              cy + uy * size,
              cx - ux * size - px * size,
              cy - uy * size - py * size,
            ]}
            stroke={colors.accent}
            strokeWidth={1.25}
            opacity={0.7 + Math.sin(s * Math.PI) * 0.3}
          />
        );
      })}
      <Circle x={center.x} y={center.y} radius={widthPx * 0.3} fill={colors.core} opacity={0.5 + pulse * 0.3} />
    </Group>
  );
}

/** Fire circle with ember rotation + flame flicker. */
function MollieGlyph({
  center,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const flicker = breathe(t, 220) * 0.15 + breathe(t, 540, 0.3) * 0.15;
  const rot = (t * 0.00012) % (Math.PI * 2);
  const embers = 6;

  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx} fill={colors.fill} stroke={colors.ringSoft} strokeWidth={1.25} />
      <Group rotation={(rot * 180) / Math.PI}>
        {Array.from({ length: embers }).map((_, i) => {
          const angle = (i / embers) * Math.PI * 2;
          const r1 = radiusPx * 0.55;
          const r2 = radiusPx * 0.98;
          return (
            <Line
              key={`ember-${i}`}
              points={[Math.cos(angle) * r1, Math.sin(angle) * r1, Math.cos(angle) * r2, Math.sin(angle) * r2]}
              stroke={colors.ring}
              strokeWidth={1.1}
              opacity={0.55 + Math.sin(t * 0.005 + i) * 0.25}
            />
          );
        })}
      </Group>
      <Circle radius={radiusPx * (0.52 + flicker)} fill={colors.fill} opacity={0.5} />
      <Circle radius={radiusPx * (0.35 + flicker * 0.6)} fill={colors.core} opacity={0.7 + flicker} />
      <Circle radius={radiusPx * 0.14} fill="#fff4d0" opacity={0.5 + flicker * 0.4} />
    </Group>
  );
}

/** Capsule damage field (Breach Aftershock). Three pulsing hit points along the length. */
function CapsuleMollieGlyph({
  center,
  target,
  widthPx,
  lengthPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  target: { x: number; y: number } | null;
  widthPx: number;
  lengthPx: number;
  colors: ToneColors;
  t: number;
}) {
  const { ux, uy, endX, endY } = useMemo(() => {
    const dx = (target?.x ?? center.x + lengthPx) - center.x;
    const dy = (target?.y ?? center.y) - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const uxv = dx / dist;
    const uyv = dy / dist;
    return { ux: uxv, uy: uyv, endX: center.x + uxv * lengthPx, endY: center.y + uyv * lengthPx };
  }, [center, target, lengthPx]);

  const hits = [0.2, 0.55, 0.9];
  return (
    <Group listening={false}>
      <Line
        points={[center.x, center.y, endX, endY]}
        stroke={colors.fill}
        strokeWidth={widthPx * 0.9}
        lineCap="round"
      />
      <Line
        points={[center.x, center.y, endX, endY]}
        stroke={colors.ring}
        strokeWidth={1.25}
        dash={[5, 4]}
        lineCap="round"
        opacity={0.75}
      />
      {hits.map((s, i) => {
        const b = breathe(t, 700, i * 1.5);
        const hx = center.x + ux * lengthPx * s;
        const hy = center.y + uy * lengthPx * s;
        return (
          <Group key={`cap-hit-${i}`} x={hx} y={hy}>
            <Circle radius={widthPx * 0.55 * (0.8 + b * 0.3)} fill={colors.fill} opacity={0.6 + b * 0.35} />
            <Circle radius={widthPx * 0.28 * (0.8 + b * 0.3)} fill={colors.core} opacity={0.75 + b * 0.2} />
          </Group>
        );
      })}
    </Group>
  );
}

/** Sonar ping (Sova dart, Fade haunt). Expanding rings from a target arrow. */
function DartGlyph({
  center,
  target,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  target: { x: number; y: number } | null;
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const rings = 3;
  const pulse = breathe(t, 1200);
  const arrowAngle = useMemo(() => {
    if (!target) return 0;
    return Math.atan2(target.y - center.y, target.x - center.x);
  }, [center, target]);

  return (
    <Group x={center.x} y={center.y} listening={false}>
      {Array.from({ length: rings }).map((_, i) => {
        const p = march(t, 2200, i / rings);
        return (
          <Circle
            key={`sonar-${i}`}
            radius={radiusPx * (0.2 + p * 0.9)}
            stroke={colors.ring}
            strokeWidth={1.25}
            opacity={(1 - p) * 0.6}
          />
        );
      })}
      <Circle radius={radiusPx * (0.22 + pulse * 0.05)} fill={colors.fill} stroke={colors.ring} strokeWidth={1} />
      <Group rotation={(arrowAngle * 180) / Math.PI}>
        <Line
          points={[-radiusPx * 0.14, -radiusPx * 0.12, radiusPx * 0.22, 0, -radiusPx * 0.14, radiusPx * 0.12]}
          closed
          fill={colors.accent}
          opacity={0.9}
        />
      </Group>
    </Group>
  );
}

/** Amber shockwave (Breach's in capsule form, everyone else radial). */
function ConcussionGlyph({
  center,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const waves = 3;
  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx} fill={colors.fillSoft} />
      {Array.from({ length: waves }).map((_, i) => {
        const p = march(t, 1400, i / waves);
        return (
          <Circle
            key={`cshock-${i}`}
            radius={radiusPx * (0.3 + p * 0.75)}
            stroke={colors.ring}
            strokeWidth={1.5}
            opacity={(1 - p) * 0.65}
          />
        );
      })}
      <Circle radius={radiusPx * 0.18} fill={colors.core} opacity={0.7} />
    </Group>
  );
}

function CapsuleConcussionGlyph({
  center,
  target,
  widthPx,
  lengthPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  target: { x: number; y: number } | null;
  widthPx: number;
  lengthPx: number;
  colors: ToneColors;
  t: number;
}) {
  const { ux, uy, endX, endY } = useMemo(() => {
    const dx = (target?.x ?? center.x + lengthPx) - center.x;
    const dy = (target?.y ?? center.y) - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const uxv = dx / dist;
    const uyv = dy / dist;
    return { ux: uxv, uy: uyv, endX: center.x + uxv * lengthPx, endY: center.y + uyv * lengthPx };
  }, [center, target, lengthPx]);

  const wave = march(t, 900);
  const wavelets = 5;
  return (
    <Group listening={false}>
      <Line
        points={[center.x, center.y, endX, endY]}
        stroke={colors.fill}
        strokeWidth={widthPx}
        lineCap="round"
      />
      <Line
        points={[center.x, center.y, endX, endY]}
        stroke={colors.ring}
        strokeWidth={1.5}
        lineCap="round"
        opacity={0.9}
      />
      {Array.from({ length: wavelets }).map((_, i) => {
        const s = ((i / wavelets) + wave) % 1;
        const wx = center.x + ux * lengthPx * s;
        const wy = center.y + uy * lengthPx * s;
        return (
          <Circle
            key={`capwave-${i}`}
            x={wx}
            y={wy}
            radius={widthPx * (0.2 + (1 - s) * 0.3)}
            fill={colors.accent}
            opacity={(1 - s) * 0.7}
          />
        );
      })}
    </Group>
  );
}

/** Solid barrier with marching highlight. Neon's fastlane renders two parallel bars. */
function WallGlyph({
  center,
  target,
  widthPx,
  lengthPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  target: { x: number; y: number } | null;
  widthPx: number;
  lengthPx: number;
  colors: ToneColors;
  t: number;
}) {
  const { px, py } = useMemo(() => {
    if (!target) return { px: 0, py: -1 };
    const dx = center.x - target.x;
    const dy = center.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { px: -dy / dist, py: dx / dist };
  }, [center, target]);

  const halfLen = lengthPx / 2;
  const marchP = march(t, 2600);
  const highlightStart = -halfLen + marchP * lengthPx;
  const highlightEnd = Math.min(halfLen, highlightStart + lengthPx * 0.25);

  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Line
        points={[px * halfLen, py * halfLen, -px * halfLen, -py * halfLen]}
        stroke={colors.ring}
        strokeWidth={widthPx}
        lineCap="round"
        opacity={0.9}
      />
      <Line
        points={[px * highlightStart, py * highlightStart, px * highlightEnd, py * highlightEnd]}
        stroke={colors.core}
        strokeWidth={widthPx * 0.55}
        lineCap="round"
        opacity={0.85}
      />
    </Group>
  );
}

/** Two-endpoint laser wire with breathing dots at each end. */
function TripwireGlyph({
  path,
  colors,
  t,
  cellSizePx,
}: {
  path: { x: number; y: number }[] | null;
  colors: ToneColors;
  t: number;
  cellSizePx: number;
}) {
  if (!path || path.length < 2) return null;
  const [a, b] = path;
  const pulse = breathe(t, 1600);
  const dashOffset = march(t, 2400) * 10;
  return (
    <Group listening={false}>
      <Line
        points={[a.x, a.y, b.x, b.y]}
        stroke={colors.ring}
        strokeWidth={1.5}
        dash={[5, 4]}
        dashOffset={-dashOffset}
        opacity={0.9}
      />
      {[a, b].map((p, i) => (
        <Group key={`tw-${i}`} x={p.x} y={p.y}>
          <Circle radius={cellSizePx * 0.2 * (0.9 + pulse * 0.2)} fill={colors.fill} />
          <Circle radius={cellSizePx * 0.09} fill={colors.accent} opacity={0.7 + pulse * 0.3} />
        </Group>
      ))}
    </Group>
  );
}

/** Trap (Killjoy alarmbot, Cypher trapwire, Chamber trademark). Radar ring expanding outward. */
function TrapGlyph({
  center,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const ping = march(t, 2200);
  const pulse = breathe(t, 1100);
  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx * (0.3 + ping * 0.8)} stroke={colors.ring} strokeWidth={1.2} opacity={(1 - ping) * 0.5} />
      <Rect x={-radiusPx * 0.25} y={-radiusPx * 0.25} width={radiusPx * 0.5} height={radiusPx * 0.5} cornerRadius={radiusPx * 0.12} fill={colors.fill} stroke={colors.ring} strokeWidth={1.25} />
      <Circle radius={radiusPx * 0.14 * (0.85 + pulse * 0.25)} fill={colors.accent} />
    </Group>
  );
}

/** Sensor / sentry with sweeping arc — feels like a radar dish. */
function SensorGlyph({
  center,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const sweep = (t * 0.0008) % (Math.PI * 2);
  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx} fill={colors.fillSoft} stroke={colors.ringSoft} strokeWidth={1} />
      <Arc
        innerRadius={0}
        outerRadius={radiusPx}
        angle={42}
        rotation={(sweep * 180) / Math.PI - 21}
        fill={colors.fill}
        opacity={0.9}
      />
      <Circle radius={radiusPx * 0.18} fill={colors.accent} />
    </Group>
  );
}

/** Astra Gravity Well — counter-rotating rings + inner spiral. */
function GravityWellGlyph({
  center,
  radiusPx,
  colors,
  t,
}: {
  center: { x: number; y: number };
  radiusPx: number;
  colors: ToneColors;
  t: number;
}) {
  const rot = (t * 0.0006) % (Math.PI * 2);
  return (
    <Group x={center.x} y={center.y} listening={false}>
      <Circle radius={radiusPx} fill={colors.fill} />
      <Ring
        innerRadius={radiusPx * 0.78}
        outerRadius={radiusPx * 0.86}
        stroke={colors.ring}
        strokeWidth={1}
        rotation={(rot * 180) / Math.PI}
        opacity={0.85}
      />
      <Ring
        innerRadius={radiusPx * 0.5}
        outerRadius={radiusPx * 0.56}
        stroke={colors.ring}
        strokeWidth={1}
        rotation={(-rot * 180) / Math.PI}
        opacity={0.85}
      />
      <Circle radius={radiusPx * 0.22} fill={colors.core} opacity={0.55} />
      <Circle radius={radiusPx * 0.1} fill={colors.accent} />
    </Group>
  );
}
