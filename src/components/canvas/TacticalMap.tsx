"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Stage, Layer, Image, Rect, Line, Circle, Text, Group } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { Scenario, AgentPosition, UtilityItem, MovementPath, Position } from "@/types";
import { GRID_COLS, GRID_ROWS } from "@/lib/constants";
import {
  posToTile,
  tileToPos,
  isSpawnable,
  findPath,
} from "@/engine/simulation/grid";
import { getAgentDef, getUtilityRenderSpec, METERS_PER_TILE } from "@/lib/constants";
import { getAgentIconUrl } from "@/lib/assets";
import {
  buildEnemyVisionPolygon,
  visionBlockerTilesFromPlacements,
} from "@/engine/simulation/visionCone";
import { buildVisionPolygonFromBitmap } from "@/engine/simulation/minimapVision";
import { useWallBitmap } from "@/lib/useWallBitmap";
import { computePathExposure, exposureColor } from "@/engine/simulation/exposure";
import { buildCellInteriorFractions } from "@/lib/mapFootprint";
import { UtilityGlyph } from "@/components/canvas/UtilityGlyph";

/** Faint grid strokes only where the cell is mostly real map art (client mask; sim uses server tiles). */
const GRID_VISUAL_INTERIOR_MIN = 0.19;
const AXIS_LABEL_INTERIOR_MIN = 0.055;

interface TacticalMapProps {
  scenario: Scenario;
  agentPositions: AgentPosition[];
  utilityPlacements: UtilityItem[];
  movementPaths: MovementPath[];
  selectedAgentId: string | null;
  selectedAbilityKey: string | null;
  mode: "none" | "ability" | "move" | "hold" | "place";
  onCanvasTap: (position: Position) => void;
  onAgentSelect?: (agentId: string) => void;
  onDropAgent?: (agentId: string, position: Position, valid: boolean) => void;
  onDragAgent?: (agentId: string, position: Position, valid: boolean) => void;
  onTogglePathHold?: (agentId: string, pathIndex: number) => void;
  showEnemies?: boolean;
  showAgentLabels?: boolean;
}

export default function TacticalMap({
  scenario,
  agentPositions,
  utilityPlacements,
  movementPaths,
  selectedAgentId,
  selectedAbilityKey,
  mode,
  onCanvasTap,
  onAgentSelect,
  onDropAgent,
  onDragAgent,
  onTogglePathHold,
  showEnemies = true,
  showAgentLabels = true,
}: TacticalMapProps) {
  void selectedAbilityKey;
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [minimapImage] = useImage(scenario.minimapImage);
  const [hoverPos, setHoverPos] = useState<Position | null>(null);

  const gridInteriorFrac = useMemo(() => {
    const img = minimapImage;
    if (!img || img.naturalWidth < 2 || img.naturalHeight < 2) return null;

    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const maxDim = 640;
    let rw = w0;
    let rh = h0;
    if (Math.max(rw, rh) > maxDim) {
      const s = maxDim / Math.max(rw, rh);
      rw = Math.max(2, Math.round(w0 * s));
      rh = Math.max(2, Math.round(h0 * s));
    }

    const canvas = document.createElement("canvas");
    canvas.width = rw;
    canvas.height = rh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, rw, rh);
    let data: ImageData;
    try {
      data = ctx.getImageData(0, 0, rw, rh);
    } catch {
      return null;
    }

    return buildCellInteriorFractions(data.data, rw, rh, GRID_COLS, GRID_ROWS);
  }, [minimapImage]);

  const wallBitmap = useWallBitmap(scenario.minimapImage);

  const targetZoom = (scenario.camera?.zoom ?? 1) * 1.15;
  const targetCenter = scenario.camera?.center ?? { x: 0.5, y: 0.5 };
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraCenter, setCameraCenter] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    let rafId = 0;
    const startZoom = 1;
    const startCenter = { x: 0.5, y: 0.5 };
    const duration = 1200;
    const delay = 600;
    const startTime = performance.now() + delay;

    function tick(now: number) {
      if (now < startTime) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      setCameraZoom(startZoom + (targetZoom - startZoom) * ease);
      setCameraCenter({
        x: startCenter.x + (targetCenter.x - startCenter.x) * ease,
        y: startCenter.y + (targetCenter.y - startCenter.y) * ease,
      });

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [targetZoom, targetCenter]);

  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const zoom = manualZoom ?? cameraZoom;
  const center = manualZoom ? { x: cameraCenter.x, y: cameraCenter.y } : cameraCenter;

  const handleZoomIn = useCallback(() => {
    setManualZoom((prev) => {
      const current = prev ?? cameraZoom;
      return Math.min(current + 0.3, 3);
    });
  }, [cameraZoom]);

  const handleZoomOut = useCallback(() => {
    setManualZoom((prev) => {
      const current = prev ?? cameraZoom;
      const next = Math.max(current - 0.3, 1);
      return next <= 1.01 ? null : next;
    });
  }, [cameraZoom]);

  const handleResetZoom = useCallback(() => {
    setManualZoom(null);
  }, []);

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
  }, []);

  const mapSize = Math.min(size.width, size.height);
  const paddingX = (size.width - mapSize) / 2;
  const paddingY = (size.height - mapSize) / 2;

  const contentSize = mapSize * zoom;
  const contentOffsetX = paddingX + mapSize / 2 - center.x * contentSize;
  const contentOffsetY = paddingY + mapSize / 2 - center.y * contentSize;
  const cellSize = contentSize / GRID_COLS;
  const agentRadius = cellSize * 0.56;

  const toCanvas = (pos: Position) => ({
    x: contentOffsetX + pos.x * contentSize,
    y: contentOffsetY + pos.y * contentSize,
  });

  const toNormalized = (x: number, y: number) => ({
    x: Math.max(0, Math.min(1, (x - contentOffsetX) / contentSize)),
    y: Math.max(0, Math.min(1, (y - contentOffsetY) / contentSize)),
  });

  const handleTap = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const pos = toNormalized(pointer.x, pointer.y);
    onCanvasTap(pos);
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    setHoverPos(toNormalized(pointer.x, pointer.y));
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const [konvaDragAgentId, setKonvaDragAgentId] = useState<string | null>(null);

  const showSpawnZones = isDragOver || konvaDragAgentId !== null;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDragOver(false);
      const agentId = e.dataTransfer.getData("text/plain");
      if (!agentId || !onDropAgent || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - contentOffsetX) / contentSize;
      const y = (e.clientY - rect.top - contentOffsetY) / contentSize;
      const normalized = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
      const tile = posToTile(normalized);
      const valid = isSpawnable(scenario.grid, tile, scenario.spikeSite, 3.5, scenario.spawnZones);
      onDropAgent(agentId, normalized, valid);
    },
    [contentOffsetX, contentOffsetY, contentSize, onDropAgent, scenario]
  );

  const isMoveMode = mode === "move";
  const isHoldMode = mode === "hold";

  const spawnForSelected = useMemo(() => {
    if (!selectedAgentId) return null;
    return agentPositions.find((a) => a.agentId === selectedAgentId)?.position ?? null;
  }, [selectedAgentId, agentPositions]);

  /** Ghost path from spawn to hover position (no budget cap). */
  const ghostPath = useMemo(() => {
    if (!isMoveMode || !selectedAgentId || !hoverPos || !spawnForSelected) return null;
    const def = getAgentDef(selectedAgentId);
    if (!def) return null;
    const start = posToTile(spawnForSelected);
    const end = posToTile(hoverPos);
    const path = findPath(scenario.grid, start, end, def.role, undefined, {
      maxCost: 9999,
      wallBitmap,
    });
    if (!path || path.length <= 1) return null;
    return { path, agentPos: spawnForSelected };
  }, [isMoveMode, selectedAgentId, hoverPos, spawnForSelected, scenario.grid, wallBitmap]);

  const nonVoidGridBounds = useMemo(() => {
    const g = scenario.grid.tiles;
    let minC = GRID_COLS;
    let maxC = -1;
    let minR = GRID_ROWS;
    let maxR = -1;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (g[row]?.[col]?.type === "void") continue;
        const f = gridInteriorFrac?.[row * GRID_COLS + col];
        if (f != null && f < AXIS_LABEL_INTERIOR_MIN) continue;
        minC = Math.min(minC, col);
        maxC = Math.max(maxC, col);
        minR = Math.min(minR, row);
        maxR = Math.max(maxR, row);
      }
    }
    if (maxC < 0) return null;
    return { minC, maxC, minR, maxR };
  }, [scenario.grid, gridInteriorFrac]);

  const spikePos = toCanvas(scenario.spikeSite);

  const visionBlockerTiles = useMemo(
    () => visionBlockerTilesFromPlacements(utilityPlacements),
    [utilityPlacements]
  );

  const enemyVisionFans = useMemo(() => {
    if (!showEnemies) return [] as { id: string; eye: Position; rim: Position[] }[];
    return scenario.enemyAgents
      .filter((e) => !e.isHidden)
      .map((enemy) => {
        const lookAt = enemy.lookAt ?? scenario.spikeSite;
        const fan = wallBitmap
          ? buildVisionPolygonFromBitmap(
              wallBitmap,
              visionBlockerTiles,
              enemy.position,
              lookAt,
              { offAngle: enemy.offAngle }
            )
          : buildEnemyVisionPolygon(
              scenario.grid,
              visionBlockerTiles,
              enemy.position,
              lookAt,
              { offAngle: enemy.offAngle }
            );
        return { id: enemy.id, eye: fan.eye, rim: fan.rim };
      });
  }, [
    scenario.enemyAgents,
    scenario.grid,
    scenario.spikeSite,
    visionBlockerTiles,
    showEnemies,
    wallBitmap,
  ]);

  /**
   * Per-path exposure reports, keyed by agentId. Memoized so we only recompute
   * when paths, smokes, or defender positions change.
   */
  const pathReports = useMemo(() => {
    const out: Record<string, ReturnType<typeof computePathExposure>> = {};
    for (const mp of movementPaths) {
      const start = agentPositions.find((a) => a.agentId === mp.agentId)?.position;
      if (!start || mp.path.length < 2) continue;
      out[mp.agentId] = computePathExposure(
        scenario,
        start,
        mp.path,
        utilityPlacements,
        wallBitmap
      );
    }
    return out;
  }, [movementPaths, agentPositions, scenario, utilityPlacements, wallBitmap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`absolute inset-0 pointer-events-none z-[5] transition-opacity duration-150 ${
          isDragOver ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 border-2 border-amber/40 rounded-xl" />
        <div className="absolute inset-0 bg-amber/5" />
      </div>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onTap={handleTap}
        onClick={handleTap}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Layer>
          {minimapImage && (
            <Image
              image={minimapImage}
              x={contentOffsetX}
              y={contentOffsetY}
              width={contentSize}
              height={contentSize}
              opacity={0.95}
            />
          )}

          {scenario.plantableArea && (
            <Rect
              x={toCanvas({ x: scenario.plantableArea.x, y: scenario.plantableArea.y }).x}
              y={toCanvas({ x: scenario.plantableArea.x, y: scenario.plantableArea.y }).y}
              width={scenario.plantableArea.width * contentSize}
              height={scenario.plantableArea.height * contentSize}
              fill="rgba(255, 200, 100, 0.06)"
              stroke="rgba(255, 200, 100, 0.4)"
              strokeWidth={1.5}
              dash={[6, 4]}
              listening={false}
            />
          )}

          {Array.from({ length: GRID_ROWS }).map((_, row) =>
            Array.from({ length: GRID_COLS }).map((_, col) => {
              const tile = scenario.grid.tiles[row]?.[col];
              if (!tile || tile.type === "void") return null;
              const interiorFrac = gridInteriorFrac?.[row * GRID_COLS + col] ?? 1;
              const showGridChrome = interiorFrac >= GRID_VISUAL_INTERIOR_MIN;
              if (!showGridChrome) return null;
              const pos = toCanvas({ x: col / GRID_COLS, y: row / GRID_ROWS });

              return (
                <Rect
                  key={`cell-${col}-${row}`}
                  x={pos.x}
                  y={pos.y}
                  width={cellSize}
                  height={cellSize}
                  fill="transparent"
                  stroke="rgba(255,255,255,0.024)"
                  strokeWidth={0.85}
                  listening={false}
                />
              );
            })
          )}

          {nonVoidGridBounds &&
            Array.from(
              { length: nonVoidGridBounds.maxC - nonVoidGridBounds.minC + 1 },
              (_, k) => nonVoidGridBounds.minC + k
            ).map((i) => (
              <Text
                key={`col-label-${i}`}
                x={contentOffsetX + i * cellSize + cellSize / 2 - 4}
                y={contentOffsetY + contentSize + 4}
                text={String.fromCharCode(65 + i)}
                fontSize={10}
                fill="rgba(255,255,255,0.3)"
                fontFamily="var(--font-mono)"
              />
            ))}
          {nonVoidGridBounds &&
            Array.from(
              { length: nonVoidGridBounds.maxR - nonVoidGridBounds.minR + 1 },
              (_, k) => nonVoidGridBounds.minR + k
            ).map((i) => (
              <Text
                key={`row-label-${i}`}
                x={contentOffsetX - 14}
                y={contentOffsetY + i * cellSize + cellSize / 2 - 5}
                text={String(i + 1)}
                fontSize={10}
                fill="rgba(255,255,255,0.3)"
                fontFamily="var(--font-mono)"
              />
            ))}
        </Layer>

        {/* Utility Layer */}
        <Layer>
          {utilityPlacements.map((u) => {
            const pos = toCanvas(u.position);
            const spec = getUtilityRenderSpec(u.agentId, u.type);
            const UTILITY_VISUAL_SCALE = 0.5;
            const mToPx = (m: number) => m * (cellSize / METERS_PER_TILE) * UTILITY_VISUAL_SCALE;

            if (spec.shape === "none") return null;

            const fastlaneGap =
              spec.shape === "fastlane" && spec.gapMeters ? mToPx(spec.gapMeters) : undefined;
            const glyphProps = {
              type: u.type,
              agentId: u.agentId,
              center: pos,
              target: u.target ? toCanvas(u.target) : null,
              path: u.path ? u.path.map(toCanvas) : null,
              cellSizePx: cellSize,
              radiusPx: spec.radiusMeters ? mToPx(spec.radiusMeters) : undefined,
              widthPx: spec.widthMeters ? mToPx(spec.widthMeters) : undefined,
              lengthPx: spec.lengthMeters ? mToPx(spec.lengthMeters) : undefined,
              gapPx: fastlaneGap,
              selected: selectedAgentId === u.agentId,
            };

            if (spec.shape === "fastlane" && spec.gapMeters && spec.lengthMeters && spec.widthMeters) {
              // Neon's two parallel bars — render as two offset glyphs so we reuse the
              // wall's marching highlight for both rails.
              const startPos = u.target ? toCanvas(u.target) : pos;
              const dx = pos.x - startPos.x;
              const dy = pos.y - startPos.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const perpX = -dy / dist;
              const perpY = dx / dist;
              const half = (spec.gapMeters / 2) * (cellSize / METERS_PER_TILE) * UTILITY_VISUAL_SCALE;
              return (
                <Group key={u.id}>
                  <UtilityGlyph
                    {...glyphProps}
                    center={{ x: pos.x + perpX * half, y: pos.y + perpY * half }}
                    type="wall"
                  />
                  <UtilityGlyph
                    {...glyphProps}
                    center={{ x: pos.x - perpX * half, y: pos.y - perpY * half }}
                    type="wall"
                  />
                </Group>
              );
            }

            return <UtilityGlyph key={u.id} {...glyphProps} />;
          })}
        </Layer>

        {/* Spike marker */}
        <Layer>
          <Group x={spikePos.x} y={spikePos.y} listening={false}>
            <Circle radius={cellSize * 0.28} fill="rgba(255, 200, 100, 0.15)" />
            <Circle radius={cellSize * 0.18} fill="#ffc800" stroke="#fff" strokeWidth={1} />
            <Text text="✦" x={-4} y={-5} fontSize={10} fill="#1a1a1a" fontStyle="bold" align="center" />
          </Group>
        </Layer>

        {/* Enemy vision wedges — radial gradient from eye, faded rim. Rims are
            built in map-normalized space then projected through toCanvas so zoom
            and pan stay pixel-locked. */}
        {showEnemies && enemyVisionFans.length > 0 && (
          <Layer listening={false}>
            {enemyVisionFans.map((fan) => {
              const eyeCanvas = toCanvas(fan.eye);
              const rimCanvas = fan.rim.map((p) => toCanvas(p));
              if (rimCanvas.length < 2) return null;
              const pts: number[] = [eyeCanvas.x, eyeCanvas.y];
              let maxR = 0;
              for (const c of rimCanvas) {
                pts.push(c.x, c.y);
                const d = Math.hypot(c.x - eyeCanvas.x, c.y - eyeCanvas.y);
                if (d > maxR) maxR = d;
              }
              pts.push(eyeCanvas.x, eyeCanvas.y);
              const gradientR = Math.max(maxR, cellSize);
              return (
                <Group key={`fov-${fan.id}`}>
                  <Line
                    points={pts}
                    closed
                    fillRadialGradientStartPoint={eyeCanvas}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndPoint={eyeCanvas}
                    fillRadialGradientEndRadius={gradientR}
                    fillRadialGradientColorStops={[
                      0, "rgba(255, 70, 85, 0.55)",
                      0.35, "rgba(255, 70, 85, 0.28)",
                      0.75, "rgba(255, 70, 85, 0.12)",
                      1, "rgba(255, 70, 85, 0.02)",
                    ]}
                    stroke="rgba(255, 70, 85, 0.38)"
                    strokeWidth={0.6}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.05}
                    listening={false}
                  />
                </Group>
              );
            })}
          </Layer>
        )}

        {/* Paths layer — exposure-colored segments */}
        <Layer>
          {movementPaths.map((mp) => {
            const agent = agentPositions.find((a) => a.agentId === mp.agentId);
            if (!agent || mp.path.length === 0) return null;
            const report = pathReports[mp.agentId];
            const startCanvas = toCanvas(agent.position);
            const pathCanvas = mp.path.map((p) => toCanvas(p));
            const isSelected = selectedAgentId === mp.agentId;
            const emphasis = isSelected ? 1 : 0.8;

            const segments = report?.segments ?? [];

            return (
              <Group key={`path-${mp.agentId}`} opacity={emphasis}>
                {/* Drop-shadow halo */}
                <Line
                  points={[startCanvas.x, startCanvas.y, ...pathCanvas.flatMap((p) => [p.x, p.y])]}
                  stroke="#000"
                  strokeWidth={5}
                  opacity={0.22}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
                {/* Per-segment colored path */}
                {segments.map((seg, i) => {
                  const a = toCanvas(seg.start);
                  const b = toCanvas(seg.end);
                  const color = exposureColor(seg.exposure);
                  return (
                    <Line
                      key={`seg-${mp.agentId}-${i}`}
                      points={[a.x, a.y, b.x, b.y]}
                      stroke={color.stroke}
                      strokeWidth={isSelected ? 3 : 2.25}
                      lineCap="round"
                      lineJoin="round"
                      opacity={0.95}
                      listening={false}
                    />
                  );
                })}
                {/* Fallback if exposure hasn't computed yet */}
                {segments.length === 0 && pathCanvas.length >= 1 && (
                  <Line
                    points={[startCanvas.x, startCanvas.y, ...pathCanvas.flatMap((p) => [p.x, p.y])]}
                    stroke="#5dd4be"
                    strokeWidth={2}
                    dash={[5, 4]}
                    opacity={0.85}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                  />
                )}

                {/* Hold waypoints — amber diamonds at the given path indices. */}
                {(mp.holds ?? []).map((idx) => {
                  if (idx < 0 || idx >= mp.path.length) return null;
                  const c = toCanvas(mp.path[idx]);
                  const r = cellSize * 0.28;
                  return (
                    <Group
                      key={`hold-${mp.agentId}-${idx}`}
                      x={c.x}
                      y={c.y}
                      onClick={(e) => {
                        if (!isHoldMode || selectedAgentId !== mp.agentId) return;
                        e.cancelBubble = true;
                        onTogglePathHold?.(mp.agentId, idx);
                      }}
                      onTap={(e) => {
                        if (!isHoldMode || selectedAgentId !== mp.agentId) return;
                        e.cancelBubble = true;
                        onTogglePathHold?.(mp.agentId, idx);
                      }}
                      listening={isHoldMode && selectedAgentId === mp.agentId}
                    >
                      <Line
                        points={[0, -r, r, 0, 0, r, -r, 0]}
                        closed
                        fill="rgba(245,177,60,0.25)"
                        stroke="#f5b13c"
                        strokeWidth={1.5}
                      />
                      <Circle radius={2.5} fill="#f5b13c" />
                    </Group>
                  );
                })}

                {/* Hold-pickable dots along the path */}
                {isHoldMode && isSelected &&
                  mp.path.map((p, i) => {
                    const holds = mp.holds ?? [];
                    if (holds.includes(i)) return null;
                    const c = toCanvas(p);
                    return (
                      <Circle
                        key={`hold-pick-${mp.agentId}-${i}`}
                        x={c.x}
                        y={c.y}
                        radius={cellSize * 0.18}
                        fill="rgba(245,177,60,0.0)"
                        stroke="rgba(245,177,60,0.5)"
                        strokeWidth={1}
                        dash={[2, 2]}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          onTogglePathHold?.(mp.agentId, i);
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          onTogglePathHold?.(mp.agentId, i);
                        }}
                      />
                    );
                  })}

                {/* Arrow head at endpoint */}
                {pathCanvas.length >= 1 && (() => {
                  const last = pathCanvas[pathCanvas.length - 1];
                  const prev = pathCanvas.length > 1 ? pathCanvas[pathCanvas.length - 2] : startCanvas;
                  const adx = last.x - prev.x;
                  const ady = last.y - prev.y;
                  const angle = Math.atan2(ady, adx);
                  const arrowSize = 7;
                  const endColor = segments.length > 0 ? exposureColor(segments[segments.length - 1].exposure).stroke : "#5dd4be";
                  return (
                    <Line
                      points={[
                        last.x - Math.cos(angle - Math.PI / 6) * arrowSize,
                        last.y - Math.sin(angle - Math.PI / 6) * arrowSize,
                        last.x,
                        last.y,
                        last.x - Math.cos(angle + Math.PI / 6) * arrowSize,
                        last.y - Math.sin(angle + Math.PI / 6) * arrowSize,
                      ]}
                      stroke={endColor}
                      strokeWidth={2.5}
                      lineCap="round"
                      lineJoin="round"
                      listening={false}
                    />
                  );
                })()}
              </Group>
            );
          })}

          {/* Ghost path (move-mode preview) */}
          {ghostPath && (() => {
            const startCanvas = toCanvas(ghostPath.agentPos);
            const pathCanvas = ghostPath.path.map(tileToPos).map((p) => toCanvas(p));
            if (pathCanvas.length === 0) return null;
            const points = [startCanvas, ...pathCanvas].flatMap((p) => [p.x, p.y]);
            return (
              <Line
                key="ghost-path"
                points={points}
                stroke="#f5b13c"
                strokeWidth={2}
                dash={[4, 4]}
                opacity={0.55}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            );
          })()}
        </Layer>

        {/* Agents Layer */}
        <Layer>
          {showEnemies &&
            scenario.enemyAgents.map((enemy) => {
              const pos = toCanvas(enemy.position);
              const isHidden = enemy.isHidden;
              return (
                <AgentCircle
                  key={enemy.id}
                  x={pos.x}
                  y={pos.y}
                  radius={agentRadius}
                  color="#ff4655"
                  iconUrl={getAgentIconUrl(enemy.agentId)}
                  outline={isHidden}
                  label={isHidden ? "?" : undefined}
                />
              );
            })}
          {agentPositions.map((ap) => {
            const pos = toCanvas(ap.position);
            const isSelected = selectedAgentId === ap.agentId;
            const def = getAgentDef(ap.agentId);
            return (
              <Group key={ap.agentId}>
                <AgentCircle
                  x={pos.x}
                  y={pos.y}
                  radius={agentRadius}
                  color={isSelected ? "#f5b13c" : "#5dd4be"}
                  iconUrl={getAgentIconUrl(ap.agentId)}
                  listening={mode !== "place"}
                  draggable={mode === "none"}
                  onDragStart={() => setKonvaDragAgentId(ap.agentId)}
                  onDragEnd={(e) => {
                    setKonvaDragAgentId(null);
                    const node = e.target;
                    const normalized = toNormalized(node.x(), node.y());
                    const tile = posToTile(normalized);
                    const valid = isSpawnable(scenario.grid, tile, scenario.spikeSite, 3.5, scenario.spawnZones);
                    if (!valid) {
                      node.position({ x: pos.x, y: pos.y });
                    } else {
                      const snapped = toCanvas(tileToPos(tile));
                      node.position({ x: snapped.x, y: snapped.y });
                    }
                    onDragAgent?.(ap.agentId, tileToPos(tile), valid);
                  }}
                  onTap={() => {
                    if (mode === "none" || isMoveMode || isHoldMode) {
                      onAgentSelect?.(ap.agentId);
                    }
                  }}
                  glow={isSelected}
                />
                {showAgentLabels && def && (
                  <Text
                    x={pos.x - 40}
                    y={pos.y + agentRadius + 2}
                    width={80}
                    align="center"
                    text={def.displayName.toUpperCase()}
                    fontSize={9}
                    fontStyle="600"
                    fill={isSelected ? "#f5b13c" : "#e9e4d6"}
                    shadowColor="#000"
                    shadowBlur={4}
                    shadowOpacity={0.9}
                    listening={false}
                    fontFamily="var(--font-sans)"
                  />
                )}
              </Group>
            );
          })}
        </Layer>

        {showSpawnZones && scenario.spawnZones && (
          <Layer listening={false}>
            {scenario.spawnZones.map((z, i) => {
              const p1 = toCanvas({ x: z.x, y: z.y });
              const p2 = toCanvas({ x: z.x + z.width, y: z.y + z.height });
              return (
                <Rect
                  key={`spawn-zone-${i}`}
                  x={p1.x}
                  y={p1.y}
                  width={p2.x - p1.x}
                  height={p2.y - p1.y}
                  fill="rgba(93, 212, 190, 0.10)"
                  stroke="#5dd4be"
                  strokeWidth={1.5}
                  dash={[4, 3]}
                  cornerRadius={4}
                  opacity={0.85}
                />
              );
            })}
          </Layer>
        )}

        <Layer listening={false}>
          <Rect
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            fillRadialGradientStartPoint={{ x: size.width / 2, y: size.height / 2 }}
            fillRadialGradientStartRadius={mapSize * 0.25}
            fillRadialGradientEndPoint={{ x: size.width / 2, y: size.height / 2 }}
            fillRadialGradientEndRadius={mapSize * 0.65}
            fillRadialGradientColorStops={[0, "rgba(0,0,0,0)", 1, "rgba(0,0,0,0.45)"]}
          />
        </Layer>
      </Stage>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center bg-pure-black/80 backdrop-blur-sm border border-border-10 text-ink hover:text-amber hover:border-amber/30 rounded text-sm font-mono transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleResetZoom}
          className="w-8 h-8 flex items-center justify-center bg-pure-black/80 backdrop-blur-sm border border-border-10 text-ink-mute hover:text-ink hover:border-border-10 rounded text-[10px] font-mono transition-colors"
          title="Reset zoom"
        >
          ⊙
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center bg-pure-black/80 backdrop-blur-sm border border-border-10 text-ink hover:text-amber hover:border-amber/30 rounded text-sm font-mono transition-colors"
          title="Zoom out"
        >
          −
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
  outline,
  label,
  onTap,
  onDragStart,
  onDragEnd,
  glow,
  listening = true,
  draggable = false,
}: {
  x: number;
  y: number;
  radius: number;
  color: string;
  iconUrl: string | null;
  outline?: boolean;
  label?: string;
  onTap?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  glow?: boolean;
  listening?: boolean;
  draggable?: boolean;
}) {
  const [img] = useImage(iconUrl || "");

  return (
    <Group
      x={x}
      y={y}
      listening={listening}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (!onTap) return;
        e.cancelBubble = true;
        onTap();
      }}
      onTap={(e) => {
        if (!onTap) return;
        e.cancelBubble = true;
        onTap();
      }}
    >
      <Circle
        radius={radius + (glow ? 4 : 0)}
        fill={color}
        opacity={glow ? 0.25 : 0}
        listening={false}
      />
      <Circle
        radius={radius}
        fill="#1a1a1a"
        stroke={color}
        strokeWidth={outline ? 2 : 2}
        dash={outline ? [4, 2] : undefined}
      />
      {img && (
        <Group clipFunc={(ctx) => {
          ctx.arc(0, 0, Math.max(1, radius - 2), 0, Math.PI * 2);
          ctx.closePath();
        }}>
          <Image
            image={img}
            x={-radius}
            y={-radius}
            width={radius * 2}
            height={radius * 2}
            crop={(() => {
              const iw = img.width || radius * 2;
              const ih = img.height || radius * 2;
              const s = Math.min(iw, ih);
              return { x: (iw - s) / 2, y: (ih - s) / 2, width: s, height: s };
            })()}
          />
        </Group>
      )}
      {label && (
        <Text
          text={label}
          x={-6}
          y={-6}
          fontSize={12}
          fill="#fff"
          fontFamily="var(--font-mono)"
          fontStyle="bold"
        />
      )}
    </Group>
  );
}
