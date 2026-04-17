-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "user_hash" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "history" TEXT NOT NULL DEFAULT '[]',
    "pending" TEXT,
    "final_log" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    CONSTRAINT "runs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "runs_user_hash_created_at_idx" ON "runs"("user_hash", "created_at");
