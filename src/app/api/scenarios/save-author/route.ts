import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { isScenarioEditorEnabled } from "@/lib/editorAccess";
import { getAllScenarios } from "@/lib/scenarios";
import { GRID_COLS, GRID_ROWS } from "@/lib/constants";
const TILE_TYPES: Set<string> = new Set([
  "walkable",
  "wall",
  "void",
  "chokepoint",
  "cover",
  "exposed",
  "high_ground",
  "spike_zone",
]);

function validatePayload(body: unknown): { ok: true; scenarioId: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const o = body as Record<string, unknown>;
  if (o.authoritativeGrid !== true) return { ok: false, error: "authoritativeGrid must be true" };
  const grid = o.grid as Record<string, unknown> | undefined;
  if (!grid || !Array.isArray(grid.tiles)) return { ok: false, error: "Missing grid.tiles" };
  const tiles = grid.tiles as { type?: string }[][];
  if (tiles.length !== GRID_ROWS) return { ok: false, error: `Expected ${GRID_ROWS} rows` };
  for (let r = 0; r < GRID_ROWS; r++) {
    const row = tiles[r];
    if (!Array.isArray(row) || row.length !== GRID_COLS) return { ok: false, error: `Row ${r} must have ${GRID_COLS} cells` };
    for (let c = 0; c < GRID_COLS; c++) {
      const t = row[c]?.type;
      if (typeof t !== "string" || !TILE_TYPES.has(t)) return { ok: false, error: `Invalid tile type at ${r},${c}` };
    }
  }
  const scenarioId = typeof o.scenarioId === "string" ? o.scenarioId : "";
  if (!scenarioId) return { ok: false, error: "scenarioId is required" };
  const known = new Set(getAllScenarios().map((s) => s.id));
  if (!known.has(scenarioId)) return { ok: false, error: "Unknown scenarioId" };
  return { ok: true, scenarioId };
}

export async function POST(req: NextRequest) {
  if (!isScenarioEditorEnabled()) {
    return NextResponse.json({ success: false, error: "Editor disabled" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const checked = validatePayload(body);
  if (!checked.ok) {
    return NextResponse.json({ success: false, error: checked.error }, { status: 400 });
  }

  const outPath = path.join(process.cwd(), "src", "scenarios", `${checked.scenarioId}-author.json`);
  const text = JSON.stringify(body, null, 2);
  try {
    await fs.writeFile(outPath, text, "utf8");
  } catch (e) {
    console.error("[save-author]", e);
    return NextResponse.json(
      { success: false, error: "Could not write file (read-only deploy or permissions?)" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { path: `src/scenarios/${checked.scenarioId}-author.json` },
  });
}
