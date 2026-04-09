import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

// Initialize tables
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id TEXT PRIMARY KEY,
        config JSONB NOT NULL,
        rules JSONB NOT NULL,
        release_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scenario_id TEXT REFERENCES scenarios(id),
        user_hash TEXT NOT NULL,
        plan_data JSONB NOT NULL,
        score INTEGER NOT NULL,
        tier TEXT NOT NULL,
        outcome JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID REFERENCES plans(id),
        user_hash TEXT NOT NULL,
        direction INTEGER NOT NULL CHECK (direction IN (1, -1)),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(plan_id, user_hash)
      );

      CREATE TABLE IF NOT EXISTS plays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_hash TEXT NOT NULL,
        date DATE NOT NULL,
        count INTEGER DEFAULT 0,
        ad_granted BOOLEAN DEFAULT FALSE,
        ad_watched BOOLEAN DEFAULT FALSE,
        ad_revenue DECIMAL(10,4),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_hash, date)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_plans_scenario ON plans(scenario_id);
      CREATE INDEX IF NOT EXISTS idx_plans_score ON plans(score DESC);
      CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_hash);
      CREATE INDEX IF NOT EXISTS idx_votes_plan ON votes(plan_id);
      CREATE INDEX IF NOT EXISTS idx_plays_user_date ON plays(user_hash, date);
    `);
    console.log("✅ Database tables initialized");
  } finally {
    client.release();
  }
}
