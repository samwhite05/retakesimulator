/**
 * Daily play cap (1/day) is enforced in production. Off by default in `next dev`, or when
 * `DISABLE_DAILY_PLAY_LIMIT` is true/1/yes. Set `DISABLE_DAILY_PLAY_LIMIT=false` to enforce the
 * cap while running a dev server.
 */
export function isDailyPlayLimitDisabled(): boolean {
  const v = process.env.DISABLE_DAILY_PLAY_LIMIT?.toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  return process.env.NODE_ENV !== "production";
}
