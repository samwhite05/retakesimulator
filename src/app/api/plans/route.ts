import { NextRequest, NextResponse } from "next/server";
import { getScenarioForDate } from "@/lib/scenarios";
import { getUserHash } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isDailyPlayLimitDisabled } from "@/lib/playLimits";
import { resolveScenarioGrid } from "@/lib/scenarioGrid";
import { PlayerPlan } from "@/types";
import { normalizePlayerPlan } from "@/lib/normalizePlan";
import { isServerPlanRunnable } from "@/lib/planValidation";

/**
 * Commit a plan for today. This only persists the plan + enforces the daily
 * cap — the interactive run that actually plays the cinematic is started
 * separately via `POST /api/runs`. See `src/app/api/runs/route.ts`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPlan = body.plan as PlayerPlan;
    const plan = normalizePlayerPlan(rawPlan);

    if (!plan || !plan.scenarioId) {
      return NextResponse.json({ success: false, error: "Invalid plan" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const userHash = await getUserHash();

    if (!isDailyPlayLimitDisabled()) {
      const playsToday = await prisma.plan.count({
        where: {
          userHash,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (playsToday >= 1) {
        return NextResponse.json({ success: false, error: "Daily play limit reached" }, { status: 403 });
      }
    }

    const base = getScenarioForDate(today);
    if (!base || base.id !== plan.scenarioId) {
      return NextResponse.json({ success: false, error: "Scenario not found or expired" }, { status: 404 });
    }

    const scenario = { ...base, grid: await resolveScenarioGrid(base) };

    const validAgentIds = new Set(scenario.availableAgents);
    const planAgentIds = plan.agentPositions.map((a) => a.agentId);
    if (planAgentIds.some((id) => !validAgentIds.has(id))) {
      return NextResponse.json({ success: false, error: "Invalid agents in plan" }, { status: 400 });
    }

    if (!isServerPlanRunnable(scenario, plan)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Plan incomplete: every agent needs a spawn + default path, and at least one utility charge drafted.",
        },
        { status: 400 }
      );
    }

    const saved = await prisma.plan.create({
      data: {
        scenarioId: plan.scenarioId,
        userHash,
        planData: JSON.stringify(plan),
        score: 0,
        tier: "pending",
        outcome: JSON.stringify({ pending: true }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        planId: saved.id,
      },
    });
  } catch (err) {
    console.error("[POST /api/plans]", err);
    const message = err instanceof Error ? err.message : String(err);
    const readonly =
      /readonly|read-only|SQLITE_READONLY|1032/i.test(message) ||
      (typeof err === "object" &&
        err !== null &&
        "code" in err &&
        String((err as { code?: string }).code).includes("1032"));

    if (readonly) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database file is read-only. Ensure prisma/dev.db and the prisma folder are writable, or set DATABASE_URL to a writable path. In dev, the app may fall back to a temp SQLite file — run `npx prisma db push` once if you see that warning in the server log.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === "development" ? message : "Failed to process plan" },
      { status: 500 }
    );
  }
}
