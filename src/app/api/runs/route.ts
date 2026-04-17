import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserHash } from "@/lib/crypto";
import { getScenarioForDate } from "@/lib/scenarios";
import { resolveScenarioGrid } from "@/lib/scenarioGrid";
import {
  initSimState,
  stepSimulation,
  buildFinalLog,
} from "@/engine/simulation/runner";
import {
  serializeSimState,
} from "@/engine/simulation/simState";
import { stringToSeed } from "@/engine/simulation/rng";
import { computeRank } from "@/lib/runRank";
import type { PlayerPlan, RunStepResponse, StartRunRequest } from "@/types";

const RUN_TTL_MS = 10 * 60 * 1000;

/**
 * Kick off an interactive run for a previously-committed plan. Runs the
 * sim until the first emergent decision (or end of round) and returns the
 * initial segment + pendingDecision.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StartRunRequest;
    if (!body?.planId) {
      return NextResponse.json({ success: false, error: "planId required" }, { status: 400 });
    }

    const userHash = await getUserHash();
    const planRow = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!planRow || planRow.userHash !== userHash) {
      return NextResponse.json({ success: false, error: "Plan not found" }, { status: 404 });
    }

    const plan = JSON.parse(planRow.planData) as PlayerPlan;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = getScenarioForDate(today);
    if (!base || base.id !== plan.scenarioId) {
      return NextResponse.json(
        { success: false, error: "Scenario expired for this plan" },
        { status: 404 }
      );
    }
    const scenario = { ...base, grid: await resolveScenarioGrid(base) };

    const seed = stringToSeed(`${planRow.id}:${planRow.createdAt.toISOString()}`);
    const state = initSimState(plan, scenario, seed);
    const step = stepSimulation(state, scenario);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + RUN_TTL_MS);

    if (step.finalised) {
      const log = buildFinalLog(state, scenario);
      const run = await prisma.run.create({
        data: {
          planId: planRow.id,
          scenarioId: plan.scenarioId,
          userHash,
          seed,
          state: serializeSimState(state),
          history: JSON.stringify(state.decisionHistory),
          pending: null,
          finalLog: JSON.stringify(log),
          expiresAt,
        },
      });
      const { rank, total } = await computeRank(plan.scenarioId, log.outcome.score);
      await prisma.plan.update({
        where: { id: planRow.id },
        data: {
          score: log.outcome.score,
          tier: log.outcome.tier,
          outcome: JSON.stringify({ log, outcome: log.outcome }),
        },
      });
      const payload: RunStepResponse = {
        runId: run.id,
        segment: step.segment,
        outcome: log.outcome,
        finalLog: log,
        rank,
        total,
      };
      return NextResponse.json({ success: true, data: payload });
    }

    const run = await prisma.run.create({
      data: {
        planId: planRow.id,
        scenarioId: plan.scenarioId,
        userHash,
        seed,
        state: serializeSimState(state),
        history: JSON.stringify(state.decisionHistory),
        pending: step.pendingDecision ? JSON.stringify(step.pendingDecision) : null,
        expiresAt,
      },
    });

    const payload: RunStepResponse = {
      runId: run.id,
      segment: step.segment,
      pendingDecision: step.pendingDecision,
    };
    return NextResponse.json({ success: true, data: payload });
  } catch (err) {
    console.error("[POST /api/runs]", err);
    return NextResponse.json({ success: false, error: "Failed to start run" }, { status: 500 });
  }
}
