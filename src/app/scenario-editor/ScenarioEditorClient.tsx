"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { Scenario, ScenarioResponse, TileDef, TileType } from "@/types";
import { GRID_COLS, GRID_ROWS } from "@/lib/constants";
import { useWallBitmap } from "@/lib/useWallBitmap";
import { buildVisionPolygonFromBitmap } from "@/engine/simulation/minimapVision";

/* ────────────────────────────────────────────────────────────────────────────
 * Tile palette — warm, high-contrast swatches matching the rebrand.
 * Each tile has a bold accent colour and a muted fill; the bold accent is used
 * in the palette chip + legend, the fill renders on the canvas.
 * ──────────────────────────────────────────────────────────────────────────── */

const TILE_META: Record<
  TileType,
  { label: string; accent: string; fill: string; short: string }
> = {
  walkable: {
    label: "Walkable",
    accent: "#5dd4be",
    fill: "rgba(93, 212, 190, 0.18)",
    short: "Walk",
  },
  wall: {
    label: "Wall",
    accent: "#ff4655",
    fill: "rgba(255, 70, 85, 0.40)",
    short: "Wall",
  },
  void: {
    label: "Void",
    accent: "#1b2029",
    fill: "rgba(8, 10, 14, 0.55)",
    short: "Void",
  },
  chokepoint: {
    label: "Chokepoint",
    accent: "#f5b13c",
    fill: "rgba(245, 177, 60, 0.32)",
    short: "Choke",
  },
  cover: {
    label: "Cover",
    accent: "#9a7bd6",
    fill: "rgba(154, 123, 214, 0.30)",
    short: "Cover",
  },
  exposed: {
    label: "Exposed",
    accent: "#fddf7a",
    fill: "rgba(253, 223, 122, 0.22)",
    short: "Open",
  },
  high_ground: {
    label: "High ground",
    accent: "#f0a679",
    fill: "rgba(240, 166, 121, 0.28)",
    short: "High",
  },
  spike_zone: {
    label: "Spike zone",
    accent: "#ff4b9a",
    fill: "rgba(255, 75, 154, 0.40)",
    short: "Spike",
  },
};

const PAINT_TYPES: TileType[] = [
  "walkable",
  "wall",
  "void",
  "chokepoint",
  "cover",
  "exposed",
  "high_ground",
  "spike_zone",
];

/* ────────────────────────────────────────────────────────────────────────────
 * Tools and shortcuts
 * ──────────────────────────────────────────────────────────────────────────── */

type Tool = "paint" | "fill" | "eraser" | "plantable" | "spawn" | "camera";

const TOOL_META: Record<Tool, { label: string; shortcut: string; icon: string; hint: string }> = {
  paint: { label: "Paint", shortcut: "B", icon: "✎", hint: "Click / drag to paint the active tile type." },
  fill: { label: "Fill", shortcut: "F", icon: "▣", hint: "Click a tile to flood-fill its region with the active type." },
  eraser: { label: "Eraser", shortcut: "E", icon: "◼", hint: "Click / drag to set tiles back to walkable." },
  plantable: { label: "Plantable", shortcut: "P", icon: "◈", hint: "Drag on the canvas to redraw the plantable rectangle." },
  spawn: { label: "Spawn zones", shortcut: "S", icon: "⬚", hint: "Drag spawn rect bodies to move; pull their corners to resize." },
  camera: { label: "Camera", shortcut: "C", icon: "◎", hint: "Click to re-center camera; use zoom controls in the right panel." },
};

const STORAGE_PREFIX = "retake-scenario-editor:";

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const STORAGE_VERSION = 1;

function cloneTilesFromScenario(s: Scenario): TileDef[][] {
  return s.grid.tiles.map((row) => row.map((t) => ({ ...t })));
}

function cloneTiles(tiles: TileDef[][]): TileDef[][] {
  return tiles.map((row) => row.map((t) => ({ ...t })));
}

function floodFillTiles(tiles: TileDef[][], row: number, col: number, newType: TileType): TileDef[][] {
  const oldType = tiles[row]?.[col]?.type;
  if (oldType === undefined || oldType === newType) return tiles;
  const next = cloneTiles(tiles);
  const q: { row: number; col: number }[] = [{ row, col }];
  const seen = new Set<string>();
  while (q.length > 0) {
    const cur = q.pop()!;
    const k = `${cur.row},${cur.col}`;
    if (seen.has(k)) continue;
    if (cur.row < 0 || cur.row >= GRID_ROWS || cur.col < 0 || cur.col >= GRID_COLS) continue;
    if (next[cur.row][cur.col].type !== oldType) continue;
    seen.add(k);
    next[cur.row][cur.col] = { ...next[cur.row][cur.col], type: newType };
    q.push(
      { row: cur.row + 1, col: cur.col },
      { row: cur.row - 1, col: cur.col },
      { row: cur.row, col: cur.col + 1 },
      { row: cur.row, col: cur.col - 1 }
    );
  }
  return next;
}

type Rect = { x: number; y: number; width: number; height: number };
type CornerHandle = "nw" | "ne" | "sw" | "se";
const ZONE_MIN = 0.03;

function clampRect(r: Rect, minW = ZONE_MIN, minH = ZONE_MIN): Rect {
  let { x, y, width, height } = r;
  width = Math.max(minW, Math.min(1, width));
  height = Math.max(minH, Math.min(1, height));
  x = Math.max(0, Math.min(1 - width, x));
  y = Math.max(0, Math.min(1 - height, y));
  return { x, y, width, height };
}

function resizeRectFromCorner(orig: Rect, handle: CornerHandle, nx: number, ny: number): Rect {
  const nx1 = Math.max(0, Math.min(1, nx));
  const ny1 = Math.max(0, Math.min(1, ny));
  const r = orig.x + orig.width;
  const b = orig.y + orig.height;
  switch (handle) {
    case "se":
      return clampRect({ x: orig.x, y: orig.y, width: nx1 - orig.x, height: ny1 - orig.y });
    case "nw":
      return clampRect({ x: nx1, y: ny1, width: r - nx1, height: b - ny1 });
    case "ne": {
      const y = Math.min(orig.y, ny1);
      return clampRect({ x: orig.x, y, width: nx1 - orig.x, height: b - y });
    }
    case "sw":
      return clampRect({ x: nx1, y: orig.y, width: r - nx1, height: ny1 - orig.y });
  }
}

function handlePx(cssW: number, cssH: number): number {
  return Math.max(7, Math.min(14, Math.min(cssW, cssH) * 0.022));
}

function hitSpawnCorner(px: number, py: number, z: Rect, cssW: number, cssH: number, h: number): CornerHandle | null {
  const l = z.x * cssW;
  const t = z.y * cssH;
  const r = l + z.width * cssW;
  const b = t + z.height * cssH;
  const near = (ax: number, ay: number) => Math.abs(px - ax) <= h && Math.abs(py - ay) <= h;
  if (near(l, t)) return "nw";
  if (near(r, t)) return "ne";
  if (near(l, b)) return "sw";
  if (near(r, b)) return "se";
  return null;
}

function hitSpawnBodyMove(px: number, py: number, z: Rect, cssW: number, cssH: number, h: number): boolean {
  const l = z.x * cssW;
  const t = z.y * cssH;
  const r = l + z.width * cssW;
  const b = t + z.height * cssH;
  if (px < l || px > r || py < t || py > b) return false;
  return hitSpawnCorner(px, py, z, cssW, cssH, h) === null;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Editor state
 * ──────────────────────────────────────────────────────────────────────────── */

interface EditorState {
  tiles: TileDef[][];
  plantable: Rect | null;
  spawnZones: Rect[];
  camera: { center: { x: number; y: number }; zoom: number };
}

interface SpawnZoneDrag {
  kind: "move" | "resize";
  index: number;
  handle?: CornerHandle;
  ptr0?: { nx: number; ny: number };
  rect0: Rect;
}

interface ToastMessage {
  id: number;
  tone: "success" | "error" | "info";
  text: string;
}

export default function ScenarioEditorClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  /* ── Editor state ── */
  const [tiles, setTiles] = useState<TileDef[][] | null>(null);
  const [plantable, setPlantable] = useState<Rect | null>(null);
  const [spawnZones, setSpawnZones] = useState<Rect[]>([]);
  const [camera, setCamera] = useState<{ center: { x: number; y: number }; zoom: number }>({
    center: { x: 0.5, y: 0.5 },
    zoom: 1,
  });

  /* ── Tool state ── */
  const [tool, setTool] = useState<Tool>("paint");
  const [brush, setBrush] = useState<TileType>("walkable");
  const [brushSize, setBrushSize] = useState<1 | 3 | 5>(1);

  /* ── View state ── */
  const [showCones, setShowCones] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showTilePaint, setShowTilePaint] = useState(true);
  const [showWallBitmap, setShowWallBitmap] = useState(false);

  /* ── Interaction ── */
  const [painting, setPainting] = useState(false);
  const [canvasCursor, setCanvasCursor] = useState("crosshair");
  type SpawnWin = { drag: SpawnZoneDrag; move: (e: MouseEvent) => void; up: () => void };
  const spawnWinRef = useRef<SpawnWin | null>(null);

  /* ── Save + toast ── */
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(1);

  const pushToast = useCallback((tone: ToastMessage["tone"], text: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, tone, text }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  /* ── Undo/redo ── */
  const undoStack = useRef<EditorState[]>([]);
  const redoStack = useRef<EditorState[]>([]);
  const [undoSize, setUndoSize] = useState(0);
  const [redoSize, setRedoSize] = useState(0);

  const snapshot = useCallback((): EditorState | null => {
    if (!tiles) return null;
    return {
      tiles: cloneTiles(tiles),
      plantable: plantable ? { ...plantable } : null,
      spawnZones: spawnZones.map((z) => ({ ...z })),
      camera: { center: { ...camera.center }, zoom: camera.zoom },
    };
  }, [tiles, plantable, spawnZones, camera]);

  const pushUndo = useCallback(() => {
    const s = snapshot();
    if (!s) return;
    undoStack.current.push(s);
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
    setUndoSize(undoStack.current.length);
    setRedoSize(0);
  }, [snapshot]);

  const applyState = useCallback((s: EditorState) => {
    setTiles(s.tiles);
    setPlantable(s.plantable);
    setSpawnZones(s.spawnZones);
    setCamera(s.camera);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    const cur = snapshot();
    if (cur) redoStack.current.push(cur);
    applyState(prev);
    setUndoSize(undoStack.current.length);
    setRedoSize(redoStack.current.length);
  }, [snapshot, applyState]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    const cur = snapshot();
    if (cur) undoStack.current.push(cur);
    applyState(next);
    setUndoSize(undoStack.current.length);
    setRedoSize(redoStack.current.length);
  }, [snapshot, applyState]);

  /* ── Scenario fetch ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scenarios/today");
        const json = (await res.json()) as { success: boolean; data?: ScenarioResponse; error?: string };
        if (!json.success || !json.data) {
          if (!cancelled) setLoadErr(json.error || "Failed to load scenario");
          return;
        }
        const s = json.data.scenario;
        if (!cancelled) {
          setScenario(s);
          setTiles(cloneTilesFromScenario(s));
          setPlantable(s.plantableArea ? { ...s.plantableArea } : { x: 0, y: 0, width: 0.08, height: 0.08 });
          setSpawnZones(s.spawnZones?.map((z) => ({ ...z })) ?? []);
          setCamera(
            s.camera
              ? { center: { ...s.camera.center }, zoom: s.camera.zoom }
              : { center: { x: 0.5, y: 0.5 }, zoom: 1 }
          );
        }
      } catch {
        if (!cancelled) setLoadErr("Network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Minimap + wall bitmap for vision cone preview ── */
  const [minimap, setMinimap] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!scenario) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setMinimap(img);
    img.onerror = () => setMinimap(null);
    img.src = scenario.minimapImage;
  }, [scenario]);

  const wallBitmap = useWallBitmap(scenario?.minimapImage);

  const enemyFans = useMemo(() => {
    if (!showCones || !scenario || !wallBitmap) return null;
    return scenario.enemyAgents
      .filter((e) => !e.isHidden)
      .map((e) => ({
        id: e.id,
        position: e.position,
        fan: buildVisionPolygonFromBitmap(
          wallBitmap,
          null,
          e.position,
          e.lookAt ?? scenario.spikeSite,
          { offAngle: e.offAngle }
        ),
      }));
  }, [showCones, scenario, wallBitmap]);

  /* ── Canvas draw ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tiles) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 640;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#080a0e";
    ctx.fillRect(0, 0, cssW, cssH);

    if (minimap && minimap.complete && minimap.naturalWidth > 0) {
      ctx.drawImage(minimap, 0, 0, cssW, cssH);
    }

    // Optional: show the raw wall bitmap so authors can see where the raycaster
    // thinks walls are (useful when tuning the cone preview).
    if (showWallBitmap && wallBitmap) {
      const W = wallBitmap.width;
      const H = wallBitmap.height;
      const tmp = document.createElement("canvas");
      tmp.width = W;
      tmp.height = H;
      const tctx = tmp.getContext("2d");
      if (tctx) {
        const img = tctx.createImageData(W, H);
        for (let i = 0; i < wallBitmap.data.length; i++) {
          const wall = wallBitmap.data[i] === 1;
          const o = i * 4;
          img.data[o] = wall ? 255 : 0;
          img.data[o + 1] = wall ? 70 : 0;
          img.data[o + 2] = wall ? 85 : 0;
          img.data[o + 3] = wall ? 140 : 0;
        }
        tctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, cssW, cssH);
        ctx.imageSmoothingEnabled = true;
      }
    }

    const cw = cssW / GRID_COLS;
    const ch = cssH / GRID_ROWS;

    if (showTilePaint) {
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const t = tiles[row][col]?.type ?? "void";
          ctx.fillStyle = TILE_META[t].fill;
          ctx.fillRect(col * cw, row * ch, cw + 0.5, ch + 0.5);
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(233, 228, 214, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cw, 0);
        ctx.lineTo(i * cw, cssH);
        ctx.stroke();
      }
      for (let j = 0; j <= GRID_ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * ch);
        ctx.lineTo(cssW, j * ch);
        ctx.stroke();
      }
    }

    // Vision cones (rendered above tile paint, below zone chrome)
    if (enemyFans) {
      for (const e of enemyFans) {
        const eyePx = { x: e.fan.eye.x * cssW, y: e.fan.eye.y * cssH };
        ctx.fillStyle = "rgba(255, 70, 85, 0.18)";
        ctx.beginPath();
        ctx.moveTo(eyePx.x, eyePx.y);
        for (const p of e.fan.rim) ctx.lineTo(p.x * cssW, p.y * cssH);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ff4655";
        ctx.beginPath();
        ctx.arc(e.position.x * cssW, e.position.y * cssH, Math.max(3, cssW * 0.006), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Plantable zone (amber)
    if (plantable && plantable.width > 0 && plantable.height > 0) {
      ctx.strokeStyle = "rgba(245, 177, 60, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(
        plantable.x * cssW,
        plantable.y * cssH,
        plantable.width * cssW,
        plantable.height * cssH
      );
      ctx.fillStyle = "rgba(245, 177, 60, 0.08)";
      ctx.fillRect(
        plantable.x * cssW,
        plantable.y * cssH,
        plantable.width * cssW,
        plantable.height * cssH
      );
    }

    // Spawn zones (teal)
    const hPx = handlePx(cssW, cssH);
    ctx.strokeStyle = "rgba(93, 212, 190, 0.85)";
    ctx.lineWidth = 2;
    for (const z of spawnZones) {
      if (z.width <= 0 || z.height <= 0) continue;
      const l = z.x * cssW;
      const t = z.y * cssH;
      const rw = z.width * cssW;
      const rh = z.height * cssH;
      ctx.fillStyle = "rgba(93, 212, 190, 0.06)";
      ctx.fillRect(l, t, rw, rh);
      ctx.strokeRect(l, t, rw, rh);
      ctx.save();
      ctx.fillStyle = "rgba(93, 212, 190, 0.92)";
      ctx.strokeStyle = "rgba(10, 28, 26, 0.95)";
      ctx.lineWidth = 1;
      for (const [cx, cy] of [
        [l, t],
        [l + rw, t],
        [l, t + rh],
        [l + rw, t + rh],
      ] as const) {
        ctx.fillRect(cx - hPx / 2, cy - hPx / 2, hPx, hPx);
        ctx.strokeRect(cx - hPx / 2, cy - hPx / 2, hPx, hPx);
      }
      ctx.restore();
    }

    // Camera hint (dashed)
    ctx.strokeStyle = "rgba(233, 228, 214, 0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    const zx = camera.center.x * cssW;
    const zy = camera.center.y * cssH;
    const zr = (cssW * 0.08) / camera.zoom;
    ctx.beginPath();
    ctx.arc(zx, zy, zr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Camera center cross
    ctx.fillStyle = "rgba(233, 228, 214, 0.55)";
    ctx.beginPath();
    ctx.arc(zx, zy, 3, 0, Math.PI * 2);
    ctx.fill();
  }, [
    tiles,
    minimap,
    plantable,
    spawnZones,
    camera,
    enemyFans,
    showGrid,
    showTilePaint,
    showWallBitmap,
    wallBitmap,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    const el = canvasRef.current;
    if (el?.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  /* ── Event helpers ── */
  const eventToTile = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor((x / rect.width) * GRID_COLS)));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((y / rect.height) * GRID_ROWS)));
    return { row, col };
  }, []);

  const eventToCanvasPx = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
      cssW: rect.width,
      cssH: rect.height,
      nx: (e.clientX - rect.left) / rect.width,
      ny: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  /* ── Painting ── */
  const paintAt = useCallback(
    (row: number, col: number, type: TileType) => {
      setTiles((prev) => {
        if (!prev) return prev;
        const radius = (brushSize - 1) / 2;
        let mutated = false;
        const next = prev.map((r) => r.map((c) => ({ ...c })));
        for (let dr = -radius; dr <= radius; dr++) {
          for (let dc = -radius; dc <= radius; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
            if (next[r][c].type !== type) {
              next[r][c] = { ...next[r][c], type };
              mutated = true;
            }
          }
        }
        return mutated ? next : prev;
      });
    },
    [brushSize]
  );

  const endSpawnWindowDrag = useCallback(() => {
    const w = spawnWinRef.current;
    if (!w) return;
    window.removeEventListener("mousemove", w.move);
    window.removeEventListener("mouseup", w.up);
    spawnWinRef.current = null;
  }, []);

  const beginSpawnDrag = useCallback(
    (drag: SpawnZoneDrag) => {
      const move = (ev: MouseEvent) => {
        const d = spawnWinRef.current?.drag;
        if (!d) return;
        const c = canvasRef.current;
        if (!c) return;
        const r = c.getBoundingClientRect();
        const ex = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        const ey = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
        if (d.kind === "resize" && d.handle) {
          setSpawnZones((prev) => prev.map((zz, j) =>
            j === d.index ? resizeRectFromCorner(d.rect0, d.handle!, ex, ey) : zz
          ));
        } else if (d.kind === "move" && d.ptr0) {
          const dx = ex - d.ptr0.nx;
          const dy = ey - d.ptr0.ny;
          setSpawnZones((prev) => prev.map((zz, j) =>
            j === d.index ? clampRect({ ...d.rect0, x: d.rect0.x + dx, y: d.rect0.y + dy }) : zz
          ));
        }
      };
      const up = () => endSpawnWindowDrag();
      spawnWinRef.current = { drag, move, up };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [endSpawnWindowDrag]
  );

  const onCanvasDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tiles) return;
    const pos = eventToCanvasPx(e);
    if (!pos) return;
    const { px, py, cssW, cssH, nx, ny } = pos;
    const h = handlePx(cssW, cssH);
    const t = eventToTile(e);
    if (!t) return;

    if (tool === "camera") {
      pushUndo();
      setCamera((c) => ({ ...c, center: { x: nx, y: ny } }));
      return;
    }

    if (tool === "plantable") {
      pushUndo();
      const start = { x: nx, y: ny };
      setPlantable(clampRect({ x: start.x, y: start.y, width: ZONE_MIN, height: ZONE_MIN }));
      const move = (ev: MouseEvent) => {
        const c = canvasRef.current;
        if (!c) return;
        const r = c.getBoundingClientRect();
        const ex = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        const ey = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
        const minX = Math.min(start.x, ex);
        const minY = Math.min(start.y, ey);
        const w = Math.max(ZONE_MIN, Math.abs(ex - start.x));
        const hh = Math.max(ZONE_MIN, Math.abs(ey - start.y));
        setPlantable(clampRect({ x: minX, y: minY, width: w, height: hh }));
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      return;
    }

    if (tool === "spawn") {
      if (spawnZones.length > 0) {
        for (let i = spawnZones.length - 1; i >= 0; i--) {
          const z = spawnZones[i];
          if (z.width <= 0 || z.height <= 0) continue;
          const corner = hitSpawnCorner(px, py, z, cssW, cssH, h);
          if (corner) {
            pushUndo();
            beginSpawnDrag({ kind: "resize", index: i, handle: corner, rect0: { ...z } });
            return;
          }
          if (hitSpawnBodyMove(px, py, z, cssW, cssH, h)) {
            pushUndo();
            beginSpawnDrag({ kind: "move", index: i, ptr0: { nx, ny }, rect0: { ...z } });
            return;
          }
        }
      }
      pushUndo();
      setSpawnZones((prev) => [...prev, clampRect({ x: nx - 0.06, y: ny - 0.06, width: 0.12, height: 0.12 })]);
      return;
    }

    if (tool === "fill") {
      pushUndo();
      setTiles((prev) => (prev ? floodFillTiles(prev, t.row, t.col, brush) : prev));
      return;
    }

    const targetType: TileType = tool === "eraser" ? "walkable" : brush;
    pushUndo();
    setPainting(true);
    paintAt(t.row, t.col, targetType);
  };

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (spawnWinRef.current) return;
    if (painting && tiles) {
      const t = eventToTile(e);
      if (!t) return;
      const targetType: TileType = tool === "eraser" ? "walkable" : brush;
      paintAt(t.row, t.col, targetType);
      return;
    }
    // Hover cursor feedback
    if (tool === "spawn") {
      const pos = eventToCanvasPx(e);
      if (!pos) return;
      const { px, py, cssW, cssH } = pos;
      const h = handlePx(cssW, cssH);
      for (let i = spawnZones.length - 1; i >= 0; i--) {
        const z = spawnZones[i];
        if (z.width <= 0 || z.height <= 0) continue;
        const c = hitSpawnCorner(px, py, z, cssW, cssH, h);
        if (c === "nw" || c === "se") {
          setCanvasCursor("nwse-resize");
          return;
        }
        if (c === "ne" || c === "sw") {
          setCanvasCursor("nesw-resize");
          return;
        }
        if (hitSpawnBodyMove(px, py, z, cssW, cssH, h)) {
          setCanvasCursor("move");
          return;
        }
      }
      setCanvasCursor("crosshair");
      return;
    }
    setCanvasCursor(tool === "camera" ? "pointer" : "crosshair");
  };

  const endPaint = () => setPainting(false);
  const onCanvasUp = () => {
    endSpawnWindowDrag();
    endPaint();
  };
  const onCanvasLeave = () => {
    if (spawnWinRef.current) return;
    endPaint();
    setCanvasCursor(tool === "camera" ? "pointer" : "crosshair");
  };

  useEffect(() => {
    if (!painting) return;
    window.addEventListener("mouseup", endPaint);
    return () => window.removeEventListener("mouseup", endPaint);
  }, [painting]);

  useEffect(() => {
    return () => endSpawnWindowDrag();
  }, [endSpawnWindowDrag]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.key === "y" || e.key === "Y") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === "b") setTool("paint");
      else if (k === "f") setTool("fill");
      else if (k === "e") setTool("eraser");
      else if (k === "p") setTool("plantable");
      else if (k === "s") setTool("spawn");
      else if (k === "c") setTool("camera");
      else if (k === "v") setShowCones((v) => !v);
      else if (k === "g") setShowGrid((v) => !v);
      else if (k === "t") setShowTilePaint((v) => !v);
      else if (k === "w") setShowWallBitmap((v) => !v);
      else if (k === "[") setBrushSize((s) => (s === 5 ? 3 : s === 3 ? 1 : 1));
      else if (k === "]") setBrushSize((s) => (s === 1 ? 3 : s === 3 ? 5 : 5));
      else if (/^[1-8]$/.test(k)) {
        const idx = parseInt(k, 10) - 1;
        if (idx >= 0 && idx < PAINT_TYPES.length) {
          setBrush(PAINT_TYPES[idx]);
          if (tool === "eraser" || tool === "fill") {
            // leave tool as-is; brush only matters for paint/fill
          } else {
            setTool("paint");
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, tool]);

  /* ── Stats ── */
  const tileStats = useMemo(() => {
    const counts: Record<TileType, number> = {
      walkable: 0,
      wall: 0,
      void: 0,
      chokepoint: 0,
      cover: 0,
      exposed: 0,
      high_ground: 0,
      spike_zone: 0,
    };
    if (!tiles) return counts;
    for (const row of tiles) for (const c of row) counts[c.type]++;
    return counts;
  }, [tiles]);

  const totalCells = GRID_COLS * GRID_ROWS;

  /* ── Export + persistence ── */
  const exportPayload = useMemo(() => {
    if (!scenario || !tiles) return "";
    const grid = {
      mapId: scenario.map,
      cols: GRID_COLS,
      rows: GRID_ROWS,
      tiles,
    };
    return JSON.stringify(
      {
        scenarioId: scenario.id,
        authoritativeGrid: true,
        grid,
        plantableArea: plantable,
        spawnZones: spawnZones.length ? spawnZones : undefined,
        camera,
      },
      null,
      2
    );
  }, [scenario, tiles, plantable, spawnZones, camera]);

  const downloadAuthorJson = () => {
    if (!scenario || !exportPayload) return;
    const blob = new Blob([exportPayload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario.id}-author.json`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast("success", `Downloaded ${scenario.id}-author.json`);
  };

  const saveToProject = async () => {
    if (!exportPayload) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/scenarios/save-author", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: exportPayload,
      });
      const json = (await res.json()) as { success: boolean; data?: { path: string }; error?: string };
      if (json.success && json.data?.path) {
        setSaveStatus("ok");
        setLastSavedAt(Date.now());
        pushToast("success", `Wrote ${json.data.path}`);
      } else {
        setSaveStatus("err");
        pushToast("error", json.error || res.statusText);
      }
    } catch {
      setSaveStatus("err");
      pushToast("error", "Network error");
    }
  };

  const saveDraft = () => {
    if (!scenario || !tiles) return;
    try {
      localStorage.setItem(
        STORAGE_PREFIX + scenario.id,
        JSON.stringify({
          version: STORAGE_VERSION,
          scenarioId: scenario.id,
          savedAt: Date.now(),
          tiles,
          plantable,
          spawnZones,
          camera,
        })
      );
      pushToast("success", "Draft saved to browser storage");
    } catch {
      pushToast("error", "Storage quota exceeded");
    }
  };

  const restoreDraft = () => {
    if (!scenario) return;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + scenario.id);
      if (!raw) {
        pushToast("info", "No draft found for this scenario");
        return;
      }
      const d = JSON.parse(raw) as {
        tiles?: TileDef[][];
        plantable?: Rect | null;
        spawnZones?: Rect[];
        camera?: { center: { x: number; y: number }; zoom: number };
      };
      pushUndo();
      if (d.tiles?.length === GRID_ROWS && d.tiles[0]?.length === GRID_COLS) {
        setTiles(d.tiles.map((r) => r.map((c) => ({ ...c }))));
      }
      if (d.plantable) setPlantable({ ...d.plantable });
      if (Array.isArray(d.spawnZones)) setSpawnZones(d.spawnZones.map((z) => ({ ...z })));
      if (d.camera) setCamera({ center: { ...d.camera.center }, zoom: d.camera.zoom });
      pushToast("success", "Draft restored");
    } catch {
      pushToast("error", "Draft could not be parsed");
    }
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportPayload);
      pushToast("success", "JSON copied to clipboard");
    } catch {
      pushToast("error", "Clipboard unavailable");
    }
  };

  const resetToScenario = () => {
    if (!scenario) return;
    pushUndo();
    setTiles(cloneTilesFromScenario(scenario));
    setPlantable(scenario.plantableArea ? { ...scenario.plantableArea } : null);
    setSpawnZones(scenario.spawnZones?.map((z) => ({ ...z })) ?? []);
    setCamera(
      scenario.camera
        ? { center: { ...scenario.camera.center }, zoom: scenario.camera.zoom }
        : { center: { x: 0.5, y: 0.5 }, zoom: 1 }
    );
    pushToast("info", "Reset to shipped scenario");
  };

  const clearAllPaint = () => {
    if (!tiles) return;
    pushUndo();
    const next = tiles.map((r) => r.map((c) => ({ ...c, type: "walkable" as TileType })));
    setTiles(next);
    pushToast("info", "All tiles set to walkable");
  };

  /* ── Render ── */
  if (loadErr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg font-mono text-sm text-valorant-red">
        {loadErr}
      </main>
    );
  }

  if (!scenario || !tiles) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border border-amber border-t-transparent" />
          <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-mute">
            Loading scenario
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <EditorTopBar
        scenarioName={scenario.name}
        mapName={scenario.map}
        canUndo={undoSize > 0}
        canRedo={redoSize > 0}
        onUndo={undo}
        onRedo={redo}
        lastSavedAt={lastSavedAt}
      />

      <div className="grid flex-1 grid-cols-[68px_minmax(0,1fr)_340px] gap-0 overflow-hidden">
        <ToolRail active={tool} onSelect={setTool} />

        <main className="relative flex min-w-0 flex-col overflow-hidden border-x border-border-08">
          <CanvasChrome
            showCones={showCones}
            showGrid={showGrid}
            showTilePaint={showTilePaint}
            showWallBitmap={showWallBitmap}
            onToggleCones={() => setShowCones((v) => !v)}
            onToggleGrid={() => setShowGrid((v) => !v)}
            onToggleTilePaint={() => setShowTilePaint((v) => !v)}
            onToggleWallBitmap={() => setShowWallBitmap((v) => !v)}
            wallBitmapReady={!!wallBitmap}
          />

          <div className="relative flex-1 bg-pure-black">
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="relative aspect-square h-full max-h-full w-full max-w-full overflow-hidden rounded-lg border border-border-10 bg-pure-black">
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full touch-none"
                  style={{ cursor: canvasCursor }}
                  onMouseDown={onCanvasDown}
                  onMouseMove={onCanvasMove}
                  onMouseUp={onCanvasUp}
                  onMouseLeave={onCanvasLeave}
                />
              </div>
            </div>
          </div>

          <CanvasLegend activeTool={tool} brush={brush} brushSize={brushSize} />
        </main>

        <PropertiesPanel
          tool={tool}
          brush={brush}
          onPickBrush={setBrush}
          brushSize={brushSize}
          onSetBrushSize={setBrushSize}
          tileStats={tileStats}
          totalCells={totalCells}
          plantable={plantable}
          onChangePlantable={(next) => {
            pushUndo();
            setPlantable(next);
          }}
          spawnZones={spawnZones}
          onChangeSpawnZones={(next) => {
            pushUndo();
            setSpawnZones(next);
          }}
          camera={camera}
          onChangeCamera={(next) => {
            pushUndo();
            setCamera(next);
          }}
        />
      </div>

      <EditorActionBar
        exportPayload={exportPayload}
        scenarioId={scenario.id}
        onDownload={downloadAuthorJson}
        onSaveToProject={saveToProject}
        onCopy={copyExport}
        onSaveDraft={saveDraft}
        onRestoreDraft={restoreDraft}
        onReset={resetToScenario}
        onClearAll={clearAllPaint}
        saveStatus={saveStatus}
      />

      <Toasts messages={toasts} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Top bar
 * ──────────────────────────────────────────────────────────────────────────── */

function EditorTopBar({
  scenarioName,
  mapName,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  lastSavedAt,
}: {
  scenarioName: string;
  mapName: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  lastSavedAt: number | null;
}) {
  const timeAgo = useTimeAgo(lastSavedAt);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-08 bg-surface/60 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex h-9 items-center gap-2 rounded-md border border-border-08 px-2.5 text-[12px] font-semibold tracking-tight text-ink hover:border-border-12 hover:bg-elevated"
        >
          <span className="text-valorant-red">←</span>
          <span className="font-display">Retake.</span>
        </Link>
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-ink-mute">
            Scenario editor
          </span>
          <div className="h-4 w-px bg-border-08" />
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-medium">{scenarioName}</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink-mute">
              {mapName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {lastSavedAt && (
          <span className="hidden text-[11px] font-mono uppercase tracking-[0.18em] text-ink-mute md:inline">
            Saved {timeAgo}
          </span>
        )}
        <IconButton label="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}>
          ↶
        </IconButton>
        <IconButton label="Redo (⇧⌘Z)" onClick={onRedo} disabled={!canRedo}>
          ↷
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border-08 text-ink-dim transition-colors hover:border-border-12 hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function useTimeAgo(ts: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  if (!ts) return "";
  const s = Math.max(1, Math.floor((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool rail (left)
 * ──────────────────────────────────────────────────────────────────────────── */

function ToolRail({ active, onSelect }: { active: Tool; onSelect: (t: Tool) => void }) {
  const order: Tool[] = ["paint", "fill", "eraser", "plantable", "spawn", "camera"];
  return (
    <aside className="flex flex-col items-center gap-1.5 border-r border-border-08 bg-surface/40 py-3">
      {order.map((t) => {
        const meta = TOOL_META[t];
        const isActive = active === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onSelect(t)}
            title={`${meta.label} (${meta.shortcut})`}
            className={`group relative flex h-11 w-11 items-center justify-center rounded-md border text-[15px] transition-colors ${
              isActive
                ? "border-amber/55 bg-amber/12 text-amber"
                : "border-border-08 text-ink-dim hover:border-border-12 hover:bg-elevated hover:text-ink"
            }`}
          >
            <span>{meta.icon}</span>
            <span
              className={`absolute -bottom-0.5 right-0.5 font-mono text-[9px] tracking-wider ${
                isActive ? "text-amber" : "text-ink-mute"
              }`}
            >
              {meta.shortcut}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Canvas chrome (top strip + legend)
 * ──────────────────────────────────────────────────────────────────────────── */

function CanvasChrome({
  showCones,
  showGrid,
  showTilePaint,
  showWallBitmap,
  onToggleCones,
  onToggleGrid,
  onToggleTilePaint,
  onToggleWallBitmap,
  wallBitmapReady,
}: {
  showCones: boolean;
  showGrid: boolean;
  showTilePaint: boolean;
  showWallBitmap: boolean;
  onToggleCones: () => void;
  onToggleGrid: () => void;
  onToggleTilePaint: () => void;
  onToggleWallBitmap: () => void;
  wallBitmapReady: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-08 bg-surface/40 px-4 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ViewToggle label="Tile paint" shortcut="T" active={showTilePaint} onToggle={onToggleTilePaint} />
        <ViewToggle label="Grid" shortcut="G" active={showGrid} onToggle={onToggleGrid} />
        <ViewToggle
          label="Vision cones"
          shortcut="V"
          active={showCones}
          onToggle={onToggleCones}
          disabled={!wallBitmapReady}
          disabledHint={!wallBitmapReady ? "Waiting for minimap…" : undefined}
        />
        <ViewToggle
          label="Wall bitmap"
          shortcut="W"
          active={showWallBitmap}
          onToggle={onToggleWallBitmap}
          disabled={!wallBitmapReady}
        />
      </div>
      <div className="hidden items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-ink-mute md:flex">
        <span>
          {GRID_COLS} × {GRID_ROWS} grid
        </span>
        <span className="text-border-12">·</span>
        <span>{wallBitmapReady ? "Bitmap ready" : "Loading minimap…"}</span>
      </div>
    </div>
  );
}

function ViewToggle({
  label,
  shortcut,
  active,
  onToggle,
  disabled,
  disabledHint,
}: {
  label: string;
  shortcut: string;
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={disabledHint ?? `${label} (${shortcut})`}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium tracking-tight transition-colors ${
        active
          ? "border-teal/45 bg-teal/12 text-teal"
          : "border-border-08 text-ink-dim hover:border-border-12 hover:bg-elevated hover:text-ink"
      } disabled:pointer-events-none disabled:opacity-30`}
    >
      <span>{label}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-60">{shortcut}</span>
    </button>
  );
}

function CanvasLegend({ activeTool, brush, brushSize }: { activeTool: Tool; brush: TileType; brushSize: 1 | 3 | 5 }) {
  const toolMeta = TOOL_META[activeTool];
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border-08 bg-surface/40 px-4 py-2">
      <div className="flex min-w-0 items-center gap-2 text-[11px]">
        <span className="shrink-0 font-mono uppercase tracking-[0.18em] text-amber">{toolMeta.label}</span>
        <span className="shrink-0 text-ink-mute">·</span>
        <span className="truncate text-ink-dim">{toolMeta.hint}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11px]">
        {(activeTool === "paint" || activeTool === "fill") && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: TILE_META[brush].accent }}
            />
            <span className="text-ink-dim">{TILE_META[brush].label}</span>
          </span>
        )}
        {activeTool === "paint" && (
          <span className="text-ink-dim">
            Brush {brushSize}×{brushSize}
          </span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Properties panel (right)
 * ──────────────────────────────────────────────────────────────────────────── */

function PropertiesPanel({
  tool,
  brush,
  onPickBrush,
  brushSize,
  onSetBrushSize,
  tileStats,
  totalCells,
  plantable,
  onChangePlantable,
  spawnZones,
  onChangeSpawnZones,
  camera,
  onChangeCamera,
}: {
  tool: Tool;
  brush: TileType;
  onPickBrush: (t: TileType) => void;
  brushSize: 1 | 3 | 5;
  onSetBrushSize: (s: 1 | 3 | 5) => void;
  tileStats: Record<TileType, number>;
  totalCells: number;
  plantable: Rect | null;
  onChangePlantable: (r: Rect | null) => void;
  spawnZones: Rect[];
  onChangeSpawnZones: (z: Rect[]) => void;
  camera: { center: { x: number; y: number }; zoom: number };
  onChangeCamera: (c: { center: { x: number; y: number }; zoom: number }) => void;
}) {
  return (
    <aside className="flex flex-col overflow-y-auto bg-surface/40">
      <Section title="Overview">
        <TileStats stats={tileStats} totalCells={totalCells} />
      </Section>

      <Section
        title="Brush"
        subtitle={tool === "eraser" ? "Eraser paints walkable" : tool === "fill" ? "Fill uses the active swatch" : undefined}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {PAINT_TYPES.map((t, idx) => {
            const meta = TILE_META[t];
            const active = brush === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onPickBrush(t)}
                className={`group flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                  active
                    ? "border-amber/50 bg-amber/10"
                    : "border-border-08 hover:border-border-12 hover:bg-elevated"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: meta.accent }}
                  />
                  <span className={active ? "text-ink" : "text-ink-dim group-hover:text-ink"}>
                    {meta.label}
                  </span>
                </span>
                <span className="font-mono text-[9px] text-ink-mute">{idx + 1}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-ink-mute">Size</span>
          <div className="flex gap-1">
            {([1, 3, 5] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetBrushSize(s)}
                className={`flex h-7 w-7 items-center justify-center rounded border font-mono text-[11px] transition-colors ${
                  brushSize === s
                    ? "border-amber/50 bg-amber/10 text-amber"
                    : "border-border-08 text-ink-dim hover:border-border-12 hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[10px] font-mono text-ink-mute">[ / ]</span>
        </div>
      </Section>

      <Section title="Plantable area" subtitle="Amber box on the canvas">
        <RectEditor value={plantable} onChange={onChangePlantable} accent="#f5b13c" />
      </Section>

      <Section
        title="Spawn zones"
        subtitle="Teal boxes on the canvas"
        headerAction={
          <button
            type="button"
            className="rounded border border-border-08 px-1.5 py-0.5 text-[10px] font-mono text-teal hover:border-teal/50 hover:bg-teal/10"
            onClick={() =>
              onChangeSpawnZones([...spawnZones, { x: 0.1, y: 0.1, width: 0.12, height: 0.12 }])
            }
          >
            + Add
          </button>
        }
      >
        {spawnZones.length === 0 && (
          <p className="text-[11px] text-ink-mute">No zones — placement is unrestricted except by spike distance.</p>
        )}
        <div className="space-y-2">
          {spawnZones.map((z, i) => (
            <div
              key={i}
              className="rounded-md border border-border-08 p-2"
              style={{ background: "rgba(93,212,190,0.04)" }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-teal">
                  Zone {i + 1}
                </span>
                <button
                  type="button"
                  className="text-[10px] font-mono text-valorant-red hover:underline"
                  onClick={() => onChangeSpawnZones(spawnZones.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
              <RectGrid
                value={z}
                onChange={(patch) =>
                  onChangeSpawnZones(spawnZones.map((zz, j) => (j === i ? { ...zz, ...patch } : zz)))
                }
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Camera">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[11px]">
          <label className="font-mono uppercase tracking-[0.18em] text-ink-mute">cx</label>
          <NumberInput
            step={0.01}
            value={camera.center.x}
            onChange={(v) => onChangeCamera({ ...camera, center: { ...camera.center, x: v } })}
          />
          <label className="font-mono uppercase tracking-[0.18em] text-ink-mute">cy</label>
          <NumberInput
            step={0.01}
            value={camera.center.y}
            onChange={(v) => onChangeCamera({ ...camera, center: { ...camera.center, y: v } })}
          />
          <label className="font-mono uppercase tracking-[0.18em] text-ink-mute">zoom</label>
          <NumberInput
            step={0.05}
            min={0.5}
            value={camera.zoom}
            onChange={(v) => onChangeCamera({ ...camera, zoom: Math.max(0.5, v) })}
          />
        </div>
      </Section>
    </aside>
  );
}

function Section({
  title,
  subtitle,
  headerAction,
  children,
}: {
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border-08 px-4 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-mono uppercase tracking-[0.24em] text-ink-dim">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[10px] text-ink-mute">{subtitle}</p>}
        </div>
        {headerAction}
      </div>
      {children}
    </section>
  );
}

function TileStats({
  stats,
  totalCells,
}: {
  stats: Record<TileType, number>;
  totalCells: number;
}) {
  const painted = totalCells - stats.void - stats.walkable;
  const paintedPct = ((painted / totalCells) * 100).toFixed(0);
  const walkablePct = ((stats.walkable / totalCells) * 100).toFixed(0);
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Painted" value={`${paintedPct}%`} tone="amber" />
        <Stat label="Walkable" value={`${walkablePct}%`} tone="teal" />
        <Stat label="Spike" value={String(stats.spike_zone)} tone="red" />
      </div>
      <div className="space-y-1">
        {PAINT_TYPES.map((t) => {
          const n = stats[t];
          if (n === 0 && t !== "walkable") return null;
          const pct = (n / totalCells) * 100;
          return (
            <div key={t} className="flex items-center gap-2 text-[11px]">
              <span
                className="inline-block h-2 w-2 rounded-sm shrink-0"
                style={{ background: TILE_META[t].accent }}
              />
              <span className="w-20 truncate text-ink-dim">{TILE_META[t].label}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border-08">
                <div
                  className="h-full"
                  style={{ width: `${Math.min(100, pct)}%`, background: TILE_META[t].accent, opacity: 0.7 }}
                />
              </div>
              <span className="w-10 text-right font-mono text-ink-mute">{n}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "amber" | "teal" | "red" }) {
  const toneMap: Record<string, string> = {
    amber: "border-amber/30 text-amber",
    teal: "border-teal/30 text-teal",
    red: "border-valorant-red/30 text-valorant-red",
  };
  return (
    <div className={`rounded-md border ${toneMap[tone]} bg-surface/80 px-2 py-1.5 text-center`}>
      <div className="text-[14px] font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.18em] text-ink-mute">
        {label}
      </div>
    </div>
  );
}

function RectEditor({
  value,
  onChange,
  accent,
}: {
  value: Rect | null;
  onChange: (r: Rect | null) => void;
  accent: string;
}) {
  const r = value ?? { x: 0, y: 0, width: 0.1, height: 0.1 };
  const set = (patch: Partial<Rect>) => onChange({ ...r, ...patch });
  return (
    <div className="space-y-2">
      <div
        className="h-1 w-full rounded-full"
        style={{ background: `linear-gradient(to right, ${accent}, ${accent}88)`, opacity: 0.6 }}
      />
      <RectGrid value={r} onChange={set} />
    </div>
  );
}

function RectGrid({ value, onChange }: { value: Rect; onChange: (patch: Partial<Rect>) => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1.5 text-[11px]">
      {(["x", "y", "width", "height"] as const).map((k) => (
        <Fragment key={k}>
          <span className="font-mono uppercase tracking-[0.18em] text-ink-mute">{k[0]}</span>
          <NumberInput
            step={0.005}
            value={value[k]}
            onChange={(v) => onChange({ [k]: v } as Partial<Rect>)}
          />
        </Fragment>
      ))}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  step,
  min,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      step={step ?? 0.005}
      min={min}
      value={round4(value)}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full rounded-md border border-border-08 bg-pure-black px-2 py-1 font-mono text-[11px] text-ink focus:border-amber/50 focus:outline-none focus:ring-1 focus:ring-amber/30"
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Bottom action bar
 * ──────────────────────────────────────────────────────────────────────────── */

function EditorActionBar({
  exportPayload,
  scenarioId,
  onDownload,
  onSaveToProject,
  onCopy,
  onSaveDraft,
  onRestoreDraft,
  onReset,
  onClearAll,
  saveStatus,
}: {
  exportPayload: string;
  scenarioId: string;
  onDownload: () => void;
  onSaveToProject: () => void;
  onCopy: () => void;
  onSaveDraft: () => void;
  onRestoreDraft: () => void;
  onReset: () => void;
  onClearAll: () => void;
  saveStatus: "idle" | "saving" | "ok" | "err";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border-08 bg-surface/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-ink-mute">
          <span className="text-ink-dim">{scenarioId}</span>
          <span>·</span>
          <button
            type="button"
            className="text-teal hover:underline normal-case tracking-normal"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Hide JSON" : "Preview JSON"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SecondaryBtn onClick={onReset}>Reset</SecondaryBtn>
          <SecondaryBtn onClick={onClearAll} tone="red">
            Clear paint
          </SecondaryBtn>
          <div className="mx-1 h-6 w-px bg-border-08" />
          <SecondaryBtn onClick={onSaveDraft}>Save draft</SecondaryBtn>
          <SecondaryBtn onClick={onRestoreDraft}>Restore</SecondaryBtn>
          <div className="mx-1 h-6 w-px bg-border-08" />
          <SecondaryBtn onClick={onCopy}>Copy JSON</SecondaryBtn>
          <SecondaryBtn onClick={onDownload}>Download</SecondaryBtn>
          <button
            type="button"
            onClick={onSaveToProject}
            disabled={saveStatus === "saving"}
            className="rounded-md border border-amber/55 bg-amber/15 px-3 py-1.5 text-[12px] font-semibold text-amber transition-colors hover:bg-amber/25 disabled:pointer-events-none disabled:opacity-60"
          >
            {saveStatus === "saving" ? "Writing…" : "Write to project"}
          </button>
        </div>
      </footer>

      {open && (
        <div className="border-t border-border-08 bg-pure-black/70 px-4 py-3">
          <textarea
            readOnly
            className="h-40 w-full resize-y rounded-md border border-border-08 bg-pure-black p-2 font-mono text-[10px] leading-relaxed text-ink-dim"
            value={exportPayload}
          />
        </div>
      )}
    </>
  );
}

function SecondaryBtn({
  onClick,
  children,
  tone,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "red";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        tone === "red"
          ? "border-valorant-red/30 text-valorant-red/90 hover:border-valorant-red/55 hover:bg-valorant-red/10"
          : "border-border-08 text-ink-dim hover:border-border-12 hover:bg-elevated hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Toasts
 * ──────────────────────────────────────────────────────────────────────────── */

function Toasts({ messages }: { messages: ToastMessage[] }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 flex flex-col items-end gap-2">
      {messages.map((m) => {
        const tone =
          m.tone === "success"
            ? "border-teal/45 bg-teal/12 text-teal"
            : m.tone === "error"
            ? "border-valorant-red/45 bg-valorant-red/12 text-valorant-red"
            : "border-border-12 bg-surface text-ink";
        return (
          <div
            key={m.id}
            className={`retake-fade-up pointer-events-auto rounded-md border px-3 py-2 text-[12px] font-medium shadow-lg ${tone}`}
            style={{ backdropFilter: "blur(6px)" }}
          >
            {m.text}
          </div>
        );
      })}
    </div>
  );
}
