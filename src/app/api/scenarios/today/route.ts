import { NextResponse } from "next/server";
import { getScenarioForDate } from "@/lib/scenarios";
import { getUserHash } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isDailyPlayLimitDisabled } from "@/lib/playLimits";
import { resolveScenarioGrid } from "@/lib/scenarioGrid";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let scenario = getScenarioForDate(today);
    if (!scenario) {
      return NextResponse.json({ success: false, error: "No scenario available" }, { status: 404 });
    }

    scenario = { ...scenario, grid: await resolveScenarioGrid(scenario) };

    const userHash = await getUserHash();
    const limitOff = isDailyPlayLimitDisabled();
    const playsToday = limitOff
      ? 0
      : await prisma.plan.count({
          where: {
            userHash,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });

    return NextResponse.json({
      success: true,
      data: {
        scenario,
        playsRemaining: limitOff ? 999 : Math.max(0, 1 - playsToday),
        hasAdAvailable: limitOff ? false : playsToday >= 1,
        nextResetAt: tomorrow.toISOString(),
      },
    });
  } catch (err) {
    console.error("[GET /api/scenarios/today]", err);
    return NextResponse.json({ success: false, error: "Failed to load scenario" }, { status: 500 });
  }
}
