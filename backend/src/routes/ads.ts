import { Router } from "express";
import { pool } from "../db";

const router = Router();

const MAX_EXTRA_PLAYS_PER_DAY = 3;

// POST /api/ads/complete — Ad completed, grant extra play
router.post("/complete", async (req, res) => {
  try {
    const userHash = req.headers["x-user-hash"] || "anonymous";
    const today = new Date().toISOString().split("T")[0];

    // Check if user has already maxed out extra plays
    const playResult = await pool.query(
      `SELECT * FROM plays WHERE user_hash = $1 AND date = $2`,
      [userHash, today]
    );

    const existingPlay = playResult.rows[0];

    if (existingPlay && existingPlay.ad_granted && existingPlay.count >= MAX_EXTRA_PLAYS_PER_DAY + 1) {
      return res.status(400).json({
        success: false,
        error: "Maximum extra plays reached for today",
      });
    }

    // Update or create play record
    if (existingPlay) {
      await pool.query(
        `UPDATE plays
         SET count = count + 1, ad_granted = TRUE, ad_watched = TRUE, ad_revenue = $3
         WHERE user_hash = $1 AND date = $2`,
        [userHash, today, 0.01] // TODO: pass actual ad revenue
      );
    } else {
      await pool.query(
        `INSERT INTO plays (user_hash, date, count, ad_granted, ad_watched, ad_revenue)
         VALUES ($1, $2, 1, TRUE, TRUE, $3)`,
        [userHash, today, 0.01]
      );
    }

    res.json({
      success: true,
      data: {
        playGranted: true,
        remainingExtraPlays: MAX_EXTRA_PLAYS_PER_DAY - (existingPlay?.ad_granted ? 1 : 0),
      },
    });
  } catch (err) {
    console.error("[POST /ads/complete]", err);
    res.status(500).json({ success: false, error: "Failed to process ad completion" });
  }
});

// GET /api/ads/check — Check if user can watch an ad for extra play
router.get("/check", async (req, res) => {
  try {
    const userHash = (req.query.userHash as string) || "anonymous";
    const today = new Date().toISOString().split("T")[0];

    const playResult = await pool.query(
      `SELECT * FROM plays WHERE user_hash = $1 AND date = $2`,
      [userHash, today]
    );

    const existingPlay = playResult.rows[0];
    const playsUsed = existingPlay?.count || 0;
    const adUsed = existingPlay?.ad_granted || false;

    res.json({
      success: true,
      data: {
        canWatchAd: !adUsed || playsUsed < MAX_EXTRA_PLAYS_PER_DAY,
        playsUsedToday: playsUsed,
        remainingExtraPlays: MAX_EXTRA_PLAYS_PER_DAY - (adUsed ? 1 : 0),
      },
    });
  } catch (err) {
    console.error("[GET /ads/check]", err);
    res.status(500).json({ success: false, error: "Failed to check ad availability" });
  }
});

export default router;
