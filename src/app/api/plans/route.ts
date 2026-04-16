import { NextRequest, NextResponse } from "next/server";
import { runSimulation } from "@/engine/simulation/runner";
import { getScenarioForDate } from "@/lib/scenarios";
import { getUserHash } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isDailyPlayLimitDisabled } from "@/lib/playLimits";
import { resolveScenarioGrid } from "@/lib/scenarioGrid";
import { PlayerPlan } from "@/types";
import { normalizePlayerPlan } from "@/lib/normalizePlan";
import { isServerPlanRunnable } from "@/lib/planValidation";

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

    // Validate plan agents match scenario
    const validAgentIds = new Set(scenario.availableAgents);
    const planAgentIds = plan.agentPositions.map((a) => a.agentId);
    if (planAgentIds.some((id) => !validAgentIds.has(id))) {
      return NextResponse.json({ success: false, error: "Invalid agents in plan" }, { status: 400 });
    }

    if (!isServerPlanRunnable(scenario, plan)) {
      return NextResponse.json(
        { success: false, error: "Plan incomplete: need utility, entry path per agent, and re-site (path or hold) each" },
        { status: 400 }
      );
    }

    // Run simulation
    const { log, outcome } = runSimulation(plan, scenario);

    // Save plan
    const saved = await prisma.plan.create({
      data: {
        scenarioId: plan.scenarioId,
        userHash,
        planData: JSON.stringify(plan),
        score: outcome.score,
        tier: outcome.tier,
        outcome: JSON.stringify({ log, outcome }),
      },
    });

    // Compute rank
    const betterCount = await prisma.plan.count({
      where: {
        scenarioId: plan.scenarioId,
        score: { gt: outcome.score },
        createdAt: { gte: today, lt: tomorrow },
      },
    });
    const totalCount = await prisma.plan.count({
      where: {
        scenarioId: plan.scenarioId,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        outcome,
        log,
        rank: betterCount + 1,
        total: totalCount,
      },
    });
  } catch (err) {
    console.error("[POST /api/plans]", err);
    return NextResponse.json({ success: false, error: "Failed to process plan" }, { status: 500 });
  }
}
