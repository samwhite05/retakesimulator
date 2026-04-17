import { prisma } from "@/lib/db";

/**
 * Compute today's ranking for a given final score. Shared by the run API
 * routes so the "rank of N today" stat stays consistent between the
 * initial kickoff (rare: retake ends before any decision) and the
 * finalise path (`POST /api/runs/:id/decide`).
 */
export async function computeRank(
  scenarioId: string,
  score: number
): Promise<{ rank: number; total: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [betterCount, totalCount] = await Promise.all([
    prisma.plan.count({
      where: {
        scenarioId,
        score: { gt: score },
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.plan.count({
      where: {
        scenarioId,
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
  ]);

  return { rank: betterCount + 1, total: totalCount };
}
