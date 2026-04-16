-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "map" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "release_date" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "user_hash" TEXT NOT NULL,
    "plan_data" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plans_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_release_date_key" ON "scenarios"("release_date");

-- CreateIndex
CREATE INDEX "plans_scenario_id_score_idx" ON "plans"("scenario_id", "score");

-- CreateIndex
CREATE INDEX "plans_scenario_id_created_at_idx" ON "plans"("scenario_id", "created_at");
