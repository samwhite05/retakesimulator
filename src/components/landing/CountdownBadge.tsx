"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

export default function CountdownBadge() {
  const [remaining, setRemaining] = useState<string>("--:--:--");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      setRemaining(formatRemaining(tomorrow.getTime() - now.getTime()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-full border border-border-08 bg-surface/60 px-3 py-1.5 text-[11px] backdrop-blur">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
      <span className="text-ink-mute">Next drop</span>
      <span className="font-mono font-semibold tracking-wider text-ink">{remaining}</span>
    </div>
  );
}
