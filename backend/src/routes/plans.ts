import { Router } from "express";
import { pool } from "../db";
import { evaluatePlan } from "../engine/ruleEngine";
import { generateAnimation } from "../engine/animationGenerator";
import type { PlayerPlan } from "../../../shared/types";

const router = Router();

// POST /api/plans — Submit a plan and get scored
router.post("/", async (req, res) => {
  try {
    const { plan } = req.body as { plan: PlayerPlan };

    if (!plan || !plan.scenarioId) {
      return res.status(400).json({
        success: false,
        error: "Plan and scenarioId are required",
      });
    }

    // Fetch the scenario config
    const scenarioResult = await pool.query(
      `SELECT config, rules FROM scenarios WHERE id = $1`,
      [plan.scenarioId]
    );

    if (scenarioResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Scenario not found",
      });
    }

    const scenario = scenarioResult.rows[0].config;
    const rules = scenarioResult.rows[0].rules;

    // Evaluate the plan
    const outcome = await evaluatePlan(plan, { ...scenario, rules });

    // Generate animation events
    const animationEvents = generateAnimation(plan, outcome);

    // Store the plan
    const insertResult = await pool.query(
      `INSERT INTO plans (scenario_id, user_hash, plan_data, score, tier, outcome)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        plan.scenarioId,
        req.headers["x-user-hash"] || "anonymous",
        JSON.stringify(plan),
        outcome.score,
        outcome.tier,
        JSON.stringify({ ...outcome, events: animationEvents }),
      ]
    );

    // Calculate community rank
    const rankResult = await pool.query(
      `SELECT COUNT(*) + 1 as rank FROM plans
       WHERE scenario_id = $1 AND score > $2`,
      [plan.scenarioId, outcome.score]
    );

    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM plans WHERE scenario_id = $1`,
      [plan.scenarioId]
    );

    res.json({
      success: true,
      data: {
        outcome: { ...outcome, events: animationEvents },
        planId: insertResult.rows[0].id,
        communityRank: parseInt(rankResult.rows[0].rank),
        totalSubmissions: parseInt(totalResult.rows[0].total),
      },
    });
  } catch (err) {
    console.error("[POST /plans]", err);
    res.status(500).json({ success: false, error: "Failed to submit plan" });
  }
});

// GET /api/plans/community/:scenarioId — Get top community plans
router.get("/community/:scenarioId", async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const sortBy = req.query.sort as string || "score";

    const orderBy = sortBy === "votes"
      ? `(COALESCE(SUM(votes.direction), 0)) DESC`
      : `plans.score DESC`;

    const result = await pool.query(
      `SELECT plans.id, plans.user_hash, plans.plan_data, plans.score,
              plans.tier, plans.outcome, plans.created_at,
              COALESCE(SUM(votes.direction), 0) as vote_count
       FROM plans
       LEFT JOIN votes ON votes.plan_id = plans.id
       WHERE plans.scenario_id = $1
       GROUP BY plans.id
       ORDER BY ${orderBy}
       LIMIT 10`,
      [scenarioId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("[GET /community]", err);
    res.status(500).json({ success: false, error: "Failed to fetch community plans" });
  }
});

// GET /api/plans/my/:scenarioId — Get the user's own plans for a scenario
router.get("/my/:scenarioId", async (req, res) => {
  try {
    const userHash = req.headers["x-user-hash"] || "anonymous";
    const result = await pool.query(
      `SELECT id, plan_data, score, tier, outcome, created_at
       FROM plans
       WHERE scenario_id = $1 AND user_hash = $2
       ORDER BY created_at DESC`,
      [req.params.scenarioId, userHash]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("[GET /my]", err);
    res.status(500).json({ success: false, error: "Failed to fetch your plans" });
  }
});

export default router;
