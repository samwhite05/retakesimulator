"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Line,
  Arrow,
  Text,
  Group,
  Rect,
} from "react-konva";
import type {
  UtilityItem,
  Arrow as MovementArrow,
  AgentPosition,
} from "@shared/types";
import { getAgentIconUrl } from "@shared/assets";
import {
  GRID_COLS,
  GRID_ROWS,
  posToTile,
  tileToPos,
  getCoverageTiles,
  UTILITY_COVERAGE,
  SMOKE_SIZES,
  ROLE_MOVEMENT,
} from "@shared/tileGrid";
import { getGrid, getMovementRange } from "@shared/mapGrids";

const VALO_BG_DARK = "#0A1118";
const VALO_BG_CARD = "#121D28";
const VALO_BORDER = "#2A3A4A";
const VALO_BORDER_ACCENT = "#FF4655";
const VALO_TEXT = "#ECE8E1";
const VALO_TEXT_DIM = "#6B7D8E";
const VALO_CORNER = "#FF4655";

// Tile colors
const TILE_COLORS: Record<string, string> = {
  wall: "rgba(20, 30, 40, 0.8)",
  chokepoint: "rgba(255, 185, 0, 0.1)",
  cover: "rgba(91, 206, 250, 0.08)",
  exposed: "rgba(255, 70, 85, 0.08)",
  high_ground: "rgba(139, 92, 246, 0.08)",
  spike_zone: "rgba(29, 245, 160, 0.06)",
};

const UTILITY_COLORS: Record<string, string> = {
  smoke: "#5BCEFA",
  flash: "#FFB900",
  mollie: "#FF4655",
  dart: "#1DF5A0",
  concussion: "#FF6B9D",
  decoy: "#C084FC",
  dash: "#A78BFA",
  gravity_well: "#F97316",
  nanoswarm: "#EAB308",
  tripwire: "#06B6D4",
  trap: "#6B7280",
  heal: "#34D399",
  revive: "#10B981",
  wall: "#8B5CF6",
  turret: "#F59E0B",
  sensor: "#0EA5E9",
  alarm: "#EF4444",
};

const UTILITY_ICONS: Record<string, string> = {
  smoke: "●", flash: "✦", mollie: "▲", dart: "◆", concussion: "◉",
  decoy: "◇", dash: "»", gravity_well: "◎", nanoswarm: "⬡",
  tripwire: "⚡", trap: "⚠", heal: "+", revive: "★",
  wall: "▮", turret: "⊕", sensor: "◉", alarm: "!",
};

// ========================================
// MinimapBackground
// ========================================

interface MinimapBackgroundProps {
  width: number;
  height: number;
  minimapImage: string;
  padding: number;
}

function MinimapBackground({ width, height, minimapImage, padding }: MinimapBackgroundProps) {
  const [minimapImg, setMinimapImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { if (!cancelled) setMinimapImg(img); };
    img.onerror = () => { console.warn("[MinimapCanvas] Failed to load minimap:", minimapImage); };
    img.src = minimapImage;
    return () => { cancelled = true; };
  }, [minimapImage]);

  const mapArea = { x: padding, y: padding, w: width - padding * 2, h: height - padding * 2 };

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} fill={VALO_BG_CARD} cornerRadius={4} />
      <Rect x={1} y={1} width={width - 2} height={height - 2} stroke={VALO_BORDER} strokeWidth={1} cornerRadius={3} fill="transparent" />
      <Line points={[padding, 2, width - padding, 2]} stroke={VALO_BORDER_ACCENT} strokeWidth={2} />
      <Rect x={mapArea.x} y={mapArea.y} width={mapArea.w} height={mapArea.h} fill={VALO_BG_DARK} />

      {minimapImg && <KonvaImage image={minimapImg} x={mapArea.x} y={mapArea.y} width={mapArea.w} height={mapArea.h} />}

      {!minimapImg && <Text x={mapArea.x + mapArea.w / 2 - 40} y={mapArea.y + mapArea.h / 2} text="Loading map..." fontSize={12} fill={VALO_TEXT_DIM} fontFamily="Inter, sans-serif" />}

      <Group x={mapArea.x + mapArea.w - 20} y={mapArea.y + 18}>
        <Text text="N" fontSize={10} fill={VALO_TEXT_DIM} fontFamily="Oswald, sans-serif" fontStyle="bold" align="center" offsetX={5} />
        <Line points={[0, 10, 0, 0]} stroke={VALO_TEXT_DIM} strokeWidth={1} />
        <Line points={[-3, 4, 0, 0, 3, 4]} stroke={VALO_TEXT_DIM} strokeWidth={1} />
      </Group>
    </Group>
  );
}

// ========================================
// Tile Grid Overlay
// ========================================

function TileGridOverlay({
  width,
  height,
  padding,
  mapId,
  showGrid = false,
  highlightedTiles = [],
  coverageTiles = [],
}: {
  width: number;
  height: number;
  padding: number;
  mapId: string;
  showGrid?: boolean;
  highlightedTiles?: { col: number; row: number; color?: string }[];
  coverageTiles?: { tiles: { col: number; row: number }[]; color: string; opacity: number }[];
}) {
  const mapW = width - padding * 2;
  const mapH = height - padding * 2;
  const tileW = mapW / GRID_COLS;
  const tileH = mapH / GRID_ROWS;

  const grid = useMemo(() => getGrid(mapId), [mapId]);

  // Highlight set for fast lookup
  const highlightMap = new Map<string, string>();
  for (const h of highlightedTiles) {
    highlightMap.set(`${h.col},${h.row}`, h.color || "rgba(29, 245, 160, 0.2)");
  }

  return (
    <Group>
      {/* Tile backgrounds */}
      {grid.tiles.map((row) =>
        row.map((tile) => {
          const x = padding + tile.col * tileW;
          const y = padding + tile.row * tileH;
          const color = TILE_COLORS[tile.type] || "transparent";
          const highlight = highlightMap.get(`${tile.col},${tile.row}`);

          return (
            <Group key={`${tile.col}-${tile.row}`}>
              {/* Base tile */}
              <Rect x={x} y={y} width={tileW} height={tileH} fill={color} />

              {/* Highlight overlay */}
              {highlight && (
                <Rect x={x} y={y} width={tileW} height={tileH} fill={highlight} />
              )}

              {/* Grid lines */}
              {showGrid && (
                <Rect
                  x={x}
                  y={y}
                  width={tileW}
                  height={tileH}
                  stroke="rgba(42, 58, 74, 0.15)"
                  strokeWidth={0.5}
                  fill="transparent"
                />
              )}

              {/* Chokepoint indicator */}
              {tile.type === "chokepoint" && (
                <Line
                  points={[x, y, x + tileW, y + tileH]}
                  stroke="rgba(255, 185, 0, 0.3)"
                  strokeWidth={1}
                />
              )}

              {/* Cover indicator */}
              {tile.type === "cover" && (
                <Rect
                  x={x + 2}
                  y={y + 2}
                  width={tileW - 4}
                  height={tileH - 4}
                  stroke="rgba(91, 206, 250, 0.15)"
                  strokeWidth={0.5}
                  fill="transparent"
                  cornerRadius={2}
                />
              )}
            </Group>
          );
        })
      )}

      {/* Coverage overlays (utility areas) */}
      {coverageTiles.map((coverage, idx) =>
        coverage.tiles.map((tile) => {
          const x = padding + tile.col * tileW;
          const y = padding + tile.row * tileH;
          return (
            <Rect
              key={`cov-${idx}-${tile.col}-${tile.row}`}
              x={x}
              y={y}
              width={tileW}
              height={tileH}
              fill={coverage.color}
              opacity={coverage.opacity}
            />
          );
        })
      )}
    </Group>
  );
}

// ========================================
// Agent Bubble (circular face crop)
// ========================================

function AgentBubble({
  agentId,
  x,
  y,
  radius,
  isEnemy = false,
  draggable = false,
  onDragEnd,
  isDragging,
}: {
  agentId: string;
  x: number;
  y: number;
  radius: number;
  isEnemy?: boolean;
  draggable?: boolean;
  onDragEnd?: (pos: { x: number; y: number }) => void;
  isDragging?: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const groupRef = useRef<any>(null);
  const strokeColor = isEnemy ? "#FF4655" : "#5BCEFA";

  useEffect(() => {
    const url = getAgentIconUrl(agentId);
    if (!url) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled) setImg(image); };
    image.src = url;
    return () => { cancelled = true; };
  }, [agentId]);

  const drawCircle = (context: any) => {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.closePath();
  };

  const drawImg = (context: any) => {
    if (!img) return;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    const imgRatio = img.width / img.height;
    let dw, dh, dx, dy;
    if (imgRatio > 1) {
      dh = radius * 2; dw = dh * imgRatio; dx = x - dw / 2; dy = y - radius;
    } else {
      dw = radius * 2; dh = dw / imgRatio; dx = x - radius; dy = y - dh / 2;
    }
    context.drawImage(img, dx, dy, dw, dh);
    context.restore();
  };

  return (
    <Group
      ref={groupRef}
      x={x} y={y}
      draggable={draggable}
      onDragEnd={(e: any) => {
        if (onDragEnd) onDragEnd({ x: e.target.x(), y: e.target.y() });
      }}
      onClick={(e: any) => { if (draggable) e.cancelBubble = true; }}
    >
      <Circle x={0} y={0} radius={radius + 1.5} fill={isEnemy ? "rgba(255,70,85,0.15)" : "rgba(91,206,250,0.15)"} stroke={strokeColor} strokeWidth={isDragging ? 3 : 2} opacity={isDragging ? 0.7 : 1} />
      {img && <KonvaImage image={img} x={-radius} y={-radius} width={radius * 2} height={radius * 2} clipFunc={drawCircle} customDrawFunc={drawImg} />}
      {!img && <Text x={-5} y={-7} text={agentId[0]?.toUpperCase() || "A"} fontSize={11} fill={strokeColor} fontFamily="Oswald, sans-serif" fontStyle="bold" />}
      {isDragging && <Circle x={0} y={0} radius={radius + 5} stroke={strokeColor} strokeWidth={1} dash={[3, 3]} opacity={0.5} />}
    </Group>
  );
}

// ========================================
// Utility Dot with coverage shape
// ========================================

function UtilityDot({
  type,
  x,
  y,
  radius,
  coverageColor,
}: {
  type: string;
  x: number;
  y: number;
  radius: number;
  coverageColor?: string;
}) {
  const color = UTILITY_COLORS[type] || "#FFFFFF";
  const icon = UTILITY_ICONS[type] || "?";

  return (
    <Group>
      {coverageColor && (
        <Circle x={x} y={y} radius={radius * 3} fill={coverageColor} opacity={0.15} />
      )}
      <Circle x={x} y={y} radius={radius + 2} fill={`${color}15`} />
      <Circle x={x} y={y} radius={radius} fill={`${color}30`} stroke={color} strokeWidth={2} />
      <Text x={x - 4} y={y - 6} text={icon} fontSize={9} fill={color} />
    </Group>
  );
}

// ========================================
// Main Minimap Canvas
// ========================================

interface MinimapCanvasProps {
  minimapImage?: string;
  mapId?: string;
  enemyAgents: Array<{ id: string; position: { x: number; y: number }; agent?: string }>;
  friendlyAgents: Array<{ id: string; position: { x: number; y: number }; displayName: string; role: string }>;
  spikeSite: { x: number; y: number };
  utilityPlacements: UtilityItem[];
  movementArrows: MovementArrow[];
  agentPositions: AgentPosition[];
  onAgentMove?: (agentId: string, position: { x: number; y: number }) => void;
  arrowStart: { x: number; y: number } | null;
  onCanvasTap: (position: { x: number; y: number }) => void;
  drawingArrow: boolean;
  showGrid?: boolean;
  selectedAgentId?: string;
}

const MAP_PADDING = 32;

export default function MinimapCanvas({
  minimapImage,
  mapId = "ascent",
  enemyAgents,
  friendlyAgents,
  spikeSite,
  utilityPlacements,
  movementArrows,
  agentPositions,
  onAgentMove,
  arrowStart,
  onCanvasTap,
  drawingArrow,
  showGrid = false,
  selectedAgentId,
}: MinimapCanvasProps) {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [draggingAgent, setDraggingAgent] = useState<string | null>(null);

  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      setContainerSize({ width: size, height: size });
    }
  }, []);

  useEffect(() => {
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [updateSize]);

  // Calculate movement range for selected agent
  const movementRangeTiles = useMemo(() => {
    if (!selectedAgentId) return [];
    const agent = agentPositions.find((a) => a.agentId === selectedAgentId);
    if (!agent) return [];

    const agentDef = friendlyAgents.find((f) => f.id === selectedAgentId);
    const rules = ROLE_MOVEMENT[agentDef?.role || "duelist"];

    const startTile = posToTile(agent.position, GRID_COLS, GRID_ROWS);
    return getMovementRange(mapId, startTile.col, startTile.row, rules.maxMoves, rules.canDiagonal);
  }, [selectedAgentId, agentPositions, friendlyAgents, mapId]);

  // Calculate utility coverage tiles
  const coverageOverlays = useMemo(() => {
    return utilityPlacements.map((util) => {
      const tilePos = posToTile(util.position, GRID_COLS, GRID_ROWS);
      const coverage = UTILITY_COVERAGE[util.type as keyof typeof UTILITY_COVERAGE];
      if (!coverage) return null;

      // Agent-specific smoke size
      let size = coverage.size;
      if (util.type === "smoke" && SMOKE_SIZES[util.agentId]) {
        size = SMOKE_SIZES[util.agentId];
      }

      const tiles = getCoverageTiles(
        { ...coverage, size },
        tilePos.col,
        tilePos.row
      );

      return {
        tiles,
        color: UTILITY_COLORS[util.type] || "#FFF",
        opacity: coverage.opacity,
      };
    }).filter(Boolean) as Array<{ tiles: { col: number; row: number }[]; color: string; opacity: number }>;
  }, [utilityPlacements]);

  const handleStageClick = useCallback(
    (e: any) => {
      if (!stageRef.current) return;
      if (draggingAgent) {
        setDraggingAgent(null);
        return;
      }
      const stage = stageRef.current;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const mapX = (pos.x - MAP_PADDING) / (containerSize.width - MAP_PADDING * 2);
      const mapY = (pos.y - MAP_PADDING) / (containerSize.height - MAP_PADDING * 2);
      const normalizedX = Math.max(0, Math.min(1, mapX));
      const normalizedY = Math.max(0, Math.min(1, mapY));
      onCanvasTap({ x: normalizedX, y: normalizedY });
    },
    [containerSize, onCanvasTap, draggingAgent]
  );

  const toCanvas = (pos: { x: number; y: number }) => ({
    x: MAP_PADDING + pos.x * (containerSize.width - MAP_PADDING * 2),
    y: MAP_PADDING + pos.y * (containerSize.height - MAP_PADDING * 2),
  });

  const toNormalized = (canvasPos: { x: number; y: number }) => ({
    x: (canvasPos.x - MAP_PADDING) / (containerSize.width - MAP_PADDING * 2),
    y: (canvasPos.y - MAP_PADDING) / (containerSize.height - MAP_PADDING * 2),
  });

  // Snap position to tile center
  const snapToTile = (pos: { x: number; y: number }) => {
    const tile = posToTile(pos, GRID_COLS, GRID_ROWS);
    return tileToPos(tile.col, tile.row, GRID_COLS, GRID_ROWS);
  };

  const agentTokenRadius = containerSize.width * 0.028;
  const utilityDotRadius = containerSize.width * 0.018;
  const minimapUrl = minimapImage || "/assets/minimaps/ascent.png";

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] flex items-center justify-center bg-vdark p-4">
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        onClick={handleStageClick}
        onTap={handleStageClick}
        className={drawingArrow ? "cursor-crosshair" : "cursor-default"}
      >
        <Layer>
          <MinimapBackground width={containerSize.width} height={containerSize.height} minimapImage={minimapUrl} padding={MAP_PADDING} />
        </Layer>

        <Layer>
          {/* Tile grid overlay */}
          <TileGridOverlay
            width={containerSize.width}
            height={containerSize.height}
            padding={MAP_PADDING}
            mapId={mapId}
            showGrid={showGrid}
            highlightedTiles={movementRangeTiles.map((t) => ({
              col: t.col,
              row: t.row,
              color: "rgba(29, 245, 160, 0.12)",
            }))}
            coverageTiles={coverageOverlays}
          />
        </Layer>

        <Layer listening={true}>
          {/* Spike site */}
          <Group>
            <Circle x={toCanvas(spikeSite).x} y={toCanvas(spikeSite).y} radius={containerSize.width * 0.035} fill="rgba(255, 70, 85, 0.08)" stroke="#FF4655" strokeWidth={1.5} dash={[4, 4]} />
            <Text x={toCanvas(spikeSite).x - 6} y={toCanvas(spikeSite).y - 8} text="▲" fontSize={12} fill="#FF4655" fontFamily="sans-serif" />
            <Text x={toCanvas(spikeSite).x - 14} y={toCanvas(spikeSite).y + 12} text="SPIKE" fontSize={8} fill="#FF4655" fontFamily="Oswald, sans-serif" letterSpacing={1} />
          </Group>

          {/* Enemy agents */}
          {enemyAgents.map((enemy) => {
            const pos = toCanvas(enemy.position);
            return (
              <AgentBubble key={enemy.id} agentId={enemy.agent || "unknown"} x={pos.x} y={pos.y} radius={agentTokenRadius} isEnemy />
            );
          })}

          {/* Friendly agents — draggable, snap to tiles */}
          {agentPositions.map((agent) => {
            const pos = toCanvas(agent.position);
            return (
              <AgentBubble
                key={agent.agentId}
                agentId={agent.agentId}
                x={pos.x}
                y={pos.y}
                radius={agentTokenRadius}
                isEnemy={false}
                draggable
                isDragging={draggingAgent === agent.agentId}
                onDragEnd={(canvasPos) => {
                  const norm = toNormalized(canvasPos);
                  const snapped = snapToTile(norm);
                  const clamped = {
                    x: Math.max(0, Math.min(1, snapped.x)),
                    y: Math.max(0, Math.min(1, snapped.y)),
                  };
                  setDraggingAgent(null);
                  if (onAgentMove) onAgentMove(agent.agentId, clamped);
                }}
              />
            );
          })}

          {/* Utility placements with coverage */}
          {utilityPlacements.map((util) => {
            const pos = toCanvas(util.position);
            const coverage = UTILITY_COVERAGE[util.type as keyof typeof UTILITY_COVERAGE];
            return (
              <UtilityDot
                key={util.id}
                type={util.type}
                x={pos.x}
                y={pos.y}
                radius={utilityDotRadius}
                coverageColor={coverage ? UTILITY_COLORS[util.type] : undefined}
              />
            );
          })}

          {/* Movement arrows */}
          {movementArrows.map((arrow, i) => (
            <Arrow
              key={`arrow-${i}`}
              points={arrow.path.flatMap((p) => {
                const c = toCanvas(p);
                return [c.x, c.y];
              })}
              stroke="#1DF5A0"
              strokeWidth={2.5}
              fill="#1DF5A0"
              pointerLength={8}
              pointerWidth={6}
              opacity={0.85}
            />
          ))}

          {drawingArrow && arrowStart && (
            <Group>
              <Circle x={toCanvas(arrowStart).x} y={toCanvas(arrowStart).y} radius={3} fill="#1DF5A0" opacity={0.8} />
            </Group>
          )}
        </Layer>
      </Stage>

      {drawingArrow && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-vr/90 backdrop-blur-sm text-white px-4 py-2 rounded text-xs font-medium tracking-wide whitespace-nowrap z-10">
          🎯 Tap destination to draw movement path
        </div>
      )}
    </div>
  );
}
