import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserHash } from "@/lib/crypto";
import { getScenarioForDate } from "@/lib/scenarios";
import { resolveScenarioGrid } from "@/lib/scenarioGrid";
import {
  stepSimulation,
  buildFinalLog,
} from "@/engine/simulation/runner";
import {
  deserializeSimState,
  serializeSimState,
} from "@/engine/simulation/simState";
import { computeRank } from "@/lib/runRank";
import type { DecideRunRequest, RunStepResponse } from "@/types";

/**
 * Resume an interactive run with a player choice. The request body supplies
 * the chosen `choiceId` (and `timedOut` if the overlay auto-picked the
 * default). Returns the next segment + either the next decision or the
 * final outcome.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as DecideRunRequest;
    if (!body?.choiceId) {
      return NextResponse.json({ success: false, error: "choiceId required" }, { status: 400 });
    }

    const userHash = await getUserHash();
    const runRow = await prisma.run.findUnique({ where: { id } });
    if (!runRow || runRow.userHash !== userHash) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }
    if (runRow.finalLog) {
      return NextResponse.json({ success: false, error: "Run already finalised" }, { status: 409 });
    }
    if (!runRow.pending) {
      return NextResponse.json({ success: false, error: "No pending decision" }, { status: 409 });
    }
    if (new Date() > runRow.expiresAt) {
      return NextResponse.json({ success: false, error: "Run expired" }, { status: 410 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = getScenarioForDate(today);
    if (!base || base.id !== runRow.scenarioId) {
      return NextResponse.json(
        { success: false, error: "Scenario expired for this run" },
        { status: 404 }
      );
    }
    const scenario = { ...base, grid: await resolveScenarioGrid(base) };

    const state = deserializeSimState(runRow.state);
    state.pendingDecision = JSON.parse(runRow.pending);

    const step = stepSimulation(state, scenario, {
      choiceId: body.choiceId,
      timedOut: Boolean(body.timedOut),
    });

    if (step.finalised) {
      const log = buildFinalLog(state, scenario);
      await prisma.run.update({
        where: { id },
        data: {
          state: serializeSimState(state),
          history: JSON.stringify(state.decisionHistory),
          pending: null,
          finalLog: JSON.stringify(log),
        },
      });
      const { rank, total } = await computeRank(runRow.scenarioId, log.outcome.score);
      await prisma.plan.update({
        where: { id: runRow.planId },
        data: {
          score: log.outcome.score,
          tier: log.outcome.tier,
          outcome: JSON.stringify({ log, outcome: log.outcome }),
        },
      });
      const payload: RunStepResponse = {
        runId: id,
        segment: step.segment,
        outcome: log.outcome,
        finalLog: log,
        rank,
        total,
      };
      return NextResponse.json({ success: true, data: payload });
    }

    await prisma.run.update({
      where: { id },
      data: {
        state: serializeSimState(state),
        history: JSON.stringify(state.decisionHistory),
        pending: step.pendingDecision ? JSON.stringify(step.pendingDecision) : null,
      },
    });

    const payload: RunStepResponse = {
      runId: id,
      segment: step.segment,
      pendingDecision: step.pendingDecision,
    };
    return NextResponse.json({ success: true, data: payload });
  } catch (err) {
    console.error("[POST /api/runs/:id/decide]", err);
    return NextResponse.json({ success: false, error: "Failed to decide" }, { status: 500 });
  }
}
