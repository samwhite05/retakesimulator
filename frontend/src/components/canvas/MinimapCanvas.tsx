"use client";

import { useRef, useState, useCallback, useEffect } from "react";
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
  Transformer,
} from "react-konva";
import type {
  UtilityItem,
  Arrow as MovementArrow,
  AgentPosition,
} from "@shared/types";
import { getAgentIconUrl } from "@shared/assets";

const VALO_BG_DARK = "#0A1118";
const VALO_BG_CARD = "#121D28";
const VALO_BORDER = "#2A3A4A";
const VALO_BORDER_ACCENT = "#FF4655";
const VALO_TEXT = "#ECE8E1";
const VALO_TEXT_DIM = "#6B7D8E";
const VALO_CORNER = "#FF4655";
const GRID_COLOR = "rgba(42, 58, 74, 0.15)";
const GRID_HEAVY = "rgba(42, 58, 74, 0.3)";

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
  smoke: "●",
  flash: "✦",
  mollie: "▲",
  dart: "◆",
  concussion: "◉",
  decoy: "◇",
  dash: "»",
  gravity_well: "◎",
  nanoswarm: "⬡",
  tripwire: "⚡",
  trap: "⚠",
  heal: "+",
  revive: "★",
  wall: "▮",
  turret: "⊕",
  sensor: "◉",
  alarm: "!",
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

function MinimapBackground({
  width,
  height,
  minimapImage,
  padding,
}: MinimapBackgroundProps) {
  const [minimapImg, setMinimapImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setMinimapImg(img);
    };
    img.onerror = () => {
      console.warn("[MinimapCanvas] Failed to load minimap:", minimapImage);
    };
    img.src = minimapImage;
    return () => {
      cancelled = true;
    };
  }, [minimapImage]);

  const mapArea = {
    x: padding,
    y: padding,
    w: width - padding * 2,
    h: height - padding * 2,
  };

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} fill={VALO_BG_CARD} cornerRadius={4} />
      <Rect x={1} y={1} width={width - 2} height={height - 2} stroke={VALO_BORDER} strokeWidth={1} cornerRadius={3} fill="transparent" />
      <Line points={[padding, 2, width - padding, 2]} stroke={VALO_BORDER_ACCENT} strokeWidth={2} />
      <Rect x={mapArea.x} y={mapArea.y} width={mapArea.w} height={mapArea.h} fill={VALO_BG_DARK} />

      {Array.from({ length: 9 }).map((_, i) => {
        const x = mapArea.x + ((i + 1) / 10) * mapArea.w;
        const isCenter = i === 4;
        return <Line key={`vg-${i}`} points={[x, mapArea.y, x, mapArea.y + mapArea.h]} stroke={isCenter ? GRID_HEAVY : GRID_COLOR} strokeWidth={isCenter ? 1 : 0.5} />;
      })}
      {Array.from({ length: 9 }).map((_, i) => {
        const y = mapArea.y + ((i + 1) / 10) * mapArea.h;
        const isCenter = i === 4;
        return <Line key={`hg-${i}`} points={[mapArea.x, y, mapArea.x + mapArea.w, y]} stroke={isCenter ? GRID_HEAVY : GRID_COLOR} strokeWidth={isCenter ? 1 : 0.5} />;
      })}

      <Group>
        <Line points={[mapArea.x - 6, mapArea.y - 6, mapArea.x + 12, mapArea.y - 6]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x - 6, mapArea.y - 6, mapArea.x - 6, mapArea.y + 12]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x + mapArea.w - 12, mapArea.y - 6, mapArea.x + mapArea.w + 6, mapArea.y - 6]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x + mapArea.w + 6, mapArea.y - 6, mapArea.x + mapArea.w + 6, mapArea.y + 12]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x - 6, mapArea.y + mapArea.h - 12, mapArea.x - 6, mapArea.y + mapArea.h + 6]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x - 6, mapArea.y + mapArea.h + 6, mapArea.x + 12, mapArea.y + mapArea.h + 6]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x + mapArea.w - 12, mapArea.y + mapArea.h + 6, mapArea.x + mapArea.w + 6, mapArea.y + mapArea.h + 6]} stroke={VALO_CORNER} strokeWidth={2} />
        <Line points={[mapArea.x + mapArea.w + 6, mapArea.y + mapArea.h - 12, mapArea.x + mapArea.w + 6, mapArea.y + mapArea.h + 6]} stroke={VALO_CORNER} strokeWidth={2} />
      </Group>

      {minimapImg && (
        <KonvaImage image={minimapImg} x={mapArea.x} y={mapArea.y} width={mapArea.w} height={mapArea.h} />
      )}

      {!minimapImg && (
        <Text x={mapArea.x + mapArea.w / 2 - 40} y={mapArea.y + mapArea.h / 2} text="Loading map..." fontSize={12} fill={VALO_TEXT_DIM} fontFamily="Inter, sans-serif" />
      )}

      <Group x={mapArea.x + mapArea.w - 20} y={mapArea.y + 18}>
        <Text text="N" fontSize={10} fill={VALO_TEXT_DIM} fontFamily="Oswald, sans-serif" fontStyle="bold" align="center" offsetX={5} />
        <Line points={[0, 10, 0, 0]} stroke={VALO_TEXT_DIM} strokeWidth={1} />
        <Line points={[-3, 4, 0, 0, 3, 4]} stroke={VALO_TEXT_DIM} strokeWidth={1} />
      </Group>
    </Group>
  );
}

// ========================================
// Circular Agent Icon (cropped face bubble)
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
    image.onload = () => {
      if (!cancelled) setImg(image);
    };
    image.src = url;
    return () => { cancelled = true; };
  }, [agentId]);

  // Clip image to circle
  const clipFunc = (ctx: any) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
  };

  const drawImage = (context: any) => {
    if (!img) return;
    context.save();
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.closePath();
    context.clip();

    // Draw image covering the circle (center-crop)
    const imgRatio = img.width / img.height;
    let drawW, drawH, drawX, drawY;
    if (imgRatio > 1) {
      // Landscape: crop width
      drawH = radius * 2;
      drawW = drawH * imgRatio;
      drawX = x - drawW / 2;
      drawY = y - radius;
    } else {
      // Portrait: crop height
      drawW = radius * 2;
      drawH = drawW / imgRatio;
      drawX = x - radius;
      drawY = y - drawH / 2;
    }
    context.drawImage(img, drawX, drawY, drawW, drawH);
    context.restore();
  };

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      draggable={draggable}
      onDragEnd={(e: any) => {
        if (onDragEnd) {
          onDragEnd({ x: e.target.x(), y: e.target.y() });
        }
      }}
      onClick={(e: any) => {
        if (draggable) e.cancelBubble = true;
      }}
    >
      {/* Border circle */}
      <Circle
        x={0}
        y={0}
        radius={radius + 1.5}
        fill={isEnemy ? "rgba(255,70,85,0.15)" : "rgba(91,206,250,0.15)"}
        stroke={strokeColor}
        strokeWidth={isDragging ? 3 : 2}
        opacity={isDragging ? 0.7 : 1}
      />
      {/* Clipped agent face */}
      {img && (
        <KonvaImage
          image={img}
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          clipFunc={clipFunc}
          customDrawFunc={drawImage}
        />
      )}
      {/* Fallback initial */}
      {!img && (
        <Text
          x={-5}
          y={-7}
          text={agentId[0]?.toUpperCase() || "A"}
          fontSize={11}
          fill={strokeColor}
          fontFamily="Oswald, sans-serif"
          fontStyle="bold"
        />
      )}
      {/* Selection ring when dragging */}
      {isDragging && (
        <Circle x={0} y={0} radius={radius + 5} stroke={strokeColor} strokeWidth={1} dash={[3, 3]} opacity={0.5} />
      )}
    </Group>
  );
}

// ========================================
// Utility Dot with ability icon
// ========================================

function UtilityDot({
  type,
  x,
  y,
  radius,
}: {
  type: string;
  x: number;
  y: number;
  radius: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const color = UTILITY_COLORS[type] || "#FFFFFF";

  // Try to find the actual ability icon
  useEffect(() => {
    // The toolbar handles real icons; here we use the dot style
  }, [type]);

  const icon = UTILITY_ICONS[type] || "?";

  return (
    <Group>
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
}

const MAP_PADDING = 32;

export default function MinimapCanvas({
  minimapImage,
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

  const handleStageClick = useCallback(
    (e: any) => {
      if (!stageRef.current) return;
      // Don't place utility if we just finished dragging
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
              <AgentBubble
                key={enemy.id}
                agentId={enemy.agent || "unknown"}
                x={pos.x}
                y={pos.y}
                radius={agentTokenRadius}
                isEnemy
              />
            );
          })}

          {/* Friendly agents — draggable */}
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
                  const clamped = {
                    x: Math.max(0, Math.min(1, norm.x)),
                    y: Math.max(0, Math.min(1, norm.y)),
                  };
                  setDraggingAgent(null);
                  if (onAgentMove) {
                    onAgentMove(agent.agentId, clamped);
                  }
                }}
              />
            );
          })}

          {/* Utility placements */}
          {utilityPlacements.map((util) => {
            const pos = toCanvas(util.position);
            return (
              <UtilityDot
                key={util.id}
                type={util.type}
                x={pos.x}
                y={pos.y}
                radius={utilityDotRadius}
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
