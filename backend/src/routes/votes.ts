import { Router } from "express";
import { pool } from "../db";

const router = Router();

// POST /api/votes — Vote on a community plan
router.post("/", async (req, res) => {
  try {
    const { planId, direction } = req.body as {
      planId: string;
      direction: 1 | -1;
    };

    if (!planId || !direction || (direction !== 1 && direction !== -1)) {
      return res.status(400).json({
        success: false,
        error: "planId and direction (1 or -1) are required",
      });
    }

    const userHash = req.headers["x-user-hash"] || "anonymous";

    // Upsert vote (update if already voted, insert if not)
    const result = await pool.query(
      `INSERT INTO votes (plan_id, user_hash, direction)
       VALUES ($1, $2, $3)
       ON CONFLICT (plan_id, user_hash)
       DO UPDATE SET direction = $3, created_at = NOW()
       RETURNING *`,
      [planId, userHash, direction]
    );

    // Get updated vote counts
    const counts = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN direction = 1 THEN 1 ELSE 0 END), 0) as upvotes,
        COALESCE(SUM(CASE WHEN direction = -1 THEN 1 ELSE 0 END), 0) as downvotes
       FROM votes WHERE plan_id = $1`,
      [planId]
    );

    res.json({
      success: true,
      data: {
        vote: result.rows[0],
        upvotes: counts.rows[0].upvotes,
        downvotes: counts.rows[0].downvotes,
      },
    });
  } catch (err) {
    console.error("[POST /votes]", err);
    res.status(500).json({ success: false, error: "Failed to submit vote" });
  }
});

export default router;
