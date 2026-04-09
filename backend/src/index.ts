import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { initDatabase, pool } from "./db";
import { getAllScenarios } from "./scenarios";
import scenariosRouter from "./routes/scenarios";
import plansRouter from "./routes/plans";
import votesRouter from "./routes/votes";
import adsRouter from "./routes/ads";
import adminRouter from "./routes/admin";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/scenarios", scenariosRouter);
app.use("/api/plans", plansRouter);
app.use("/api/votes", votesRouter);
app.use("/api/ads", adsRouter);
app.use("/api/admin", adminRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[ERROR]", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
);

// Seed scenarios on startup
async function seedScenarios() {
  const scenarios = getAllScenarios();
  for (const scenario of scenarios) {
    await pool.query(
      `INSERT INTO scenarios (id, config, rules, release_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET config = $2, rules = $3, release_date = $4`,
      [scenario.id, JSON.stringify(scenario), JSON.stringify(scenario.rules), scenario.releaseDate]
    );
    console.log(`  ✅ Seeded: ${scenario.name}`);
  }
}

// Start server
async function start() {
  console.log("🎯 Retake Roulette API starting...");
  await initDatabase();
  console.log("📦 Seeding scenarios...");
  await seedScenarios();

  app.listen(PORT, () => {
    console.log(`🚀 Server ready on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
