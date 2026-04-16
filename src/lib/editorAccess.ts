/**
 * Scenario zone/grid editor at `/scenario-editor`.
 * On by default in non-production; set `ENABLE_SCENARIO_EDITOR=false` to hide in dev.
 * Set `ENABLE_SCENARIO_EDITOR=true` to allow on production builds (e.g. staging).
 */
export function isScenarioEditorEnabled(): boolean {
  const v = process.env.ENABLE_SCENARIO_EDITOR?.toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  return process.env.NODE_ENV !== "production";
}
