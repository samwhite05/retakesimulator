import { Router } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/scenarios/today — Get today's scenario
router.get("/today", async (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = await pool.query(
      `SELECT * FROM scenarios WHERE release_date = $1 LIMIT 1`,
      [today]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No scenario available today",
      });
    }

    res.json({
      success: true,
      data: {
        scenario: result.rows[0].config,
        playsRemaining: 1, // TODO: implement play tracking
        hasAdAvailable: true,
      },
    });
  } catch (err) {
    console.error("[GET /today]", err);
    res.status(500).json({ success: false, error: "Failed to fetch scenario" });
  }
});

// GET /api/scenarios/:id — Get a specific scenario by ID
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM scenarios WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Scenario not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0].config,
    });
  } catch (err) {
    console.error("[GET /:id]", err);
    res.status(500).json({ success: false, error: "Failed to fetch scenario" });
  }
});

export default router;
