import { Router } from "express";
import { pool } from "../db";

const router = Router();

// POST /api/admin/scenarios — Save a new scenario (admin only)
router.post("/", async (req, res) => {
  try {
    const scenario = req.body;

    if (!scenario.id || !scenario.name || !scenario.map) {
      return res.status(400).json({
        success: false,
        error: "Scenario must have id, name, and map",
      });
    }

    await pool.query(
      `INSERT INTO scenarios (id, config, rules, release_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET config = $2, rules = $3, release_date = $4`,
      [
        scenario.id,
        JSON.stringify(scenario),
        JSON.stringify(scenario.rules || []),
        scenario.releaseDate || new Date().toISOString().split("T")[0],
      ]
    );

    res.json({
      success: true,
      data: { id: scenario.id, name: scenario.name },
    });
  } catch (err) {
    console.error("[POST /admin/scenarios]", err);
    res.status(500).json({ success: false, error: "Failed to save scenario" });
  }
});

// GET /api/admin/scenarios — List all scenarios
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, config, release_date, created_at FROM scenarios ORDER BY release_date DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("[GET /admin/scenarios]", err);
    res.status(500).json({ success: false, error: "Failed to list scenarios" });
  }
});

// DELETE /api/admin/scenarios/:id — Delete a scenario
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM scenarios WHERE id = $1`, [req.params.id]);

    res.json({
      success: true,
      data: { deleted: req.params.id },
    });
  } catch (err) {
    console.error("[DELETE /admin/scenarios]", err);
    res.status(500).json({ success: false, error: "Failed to delete scenario" });
  }
});

export default router;
