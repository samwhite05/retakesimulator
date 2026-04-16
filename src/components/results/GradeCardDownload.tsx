"use client";

import { useCallback, useState } from "react";

interface GradeCardDownloadProps {
  grade: string;
  score: number;
  maxScore: number;
  tier: string;
  percentile: number | null;
  scenarioName: string;
  mapName: string;
}

function tierColors(tier: string): { bg: string; accent: string } {
  switch (tier) {
    case "clean":
      return { bg: "#0b1411", accent: "#5dd4be" };
    case "messy":
      return { bg: "#141009", accent: "#f5b13c" };
    default:
      return { bg: "#140a0c", accent: "#ff4655" };
  }
}

export default function GradeCardDownload({
  grade,
  score,
  maxScore,
  tier,
  percentile,
  scenarioName,
  mapName,
}: GradeCardDownloadProps) {
  const [busy, setBusy] = useState(false);

  const handleDownload = useCallback(async () => {
    setBusy(true);
    try {
      const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 2;
      const W = 1080;
      const H = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const { bg, accent } = tierColors(tier);

      const grad = ctx.createRadialGradient(W * 0.5, H * 0.3, 20, W * 0.5, H * 0.55, W * 0.9);
      grad.addColorStop(0, accent + "33");
      grad.addColorStop(1, bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(233, 228, 214, 0.08)";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, W - 80, H - 80);

      ctx.fillStyle = "#e9e4d6";
      ctx.font = "600 28px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Retake.", 72, 108);

      ctx.fillStyle = "rgba(233, 228, 214, 0.5)";
      ctx.font = "500 14px Inter, system-ui, sans-serif";
      ctx.fillText("DAILY VALORANT PUZZLE", 72, 136);

      ctx.textAlign = "right";
      ctx.fillStyle = accent;
      ctx.font = "500 14px Inter, system-ui, sans-serif";
      ctx.fillText(tier.toUpperCase() + " RETAKE", W - 72, 108);
      ctx.fillStyle = "rgba(233, 228, 214, 0.5)";
      ctx.fillText(new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }), W - 72, 136);

      ctx.textAlign = "center";
      ctx.fillStyle = accent;
      ctx.font = "bold 480px Inter, system-ui, sans-serif";
      ctx.fillText(grade, W / 2, H / 2 + 110);

      ctx.fillStyle = "#e9e4d6";
      ctx.font = "600 42px Inter, system-ui, sans-serif";
      ctx.fillText(`${score} / ${maxScore}`, W / 2, H / 2 + 190);

      ctx.fillStyle = "rgba(233, 228, 214, 0.65)";
      ctx.font = "500 22px Inter, system-ui, sans-serif";
      ctx.fillText(scenarioName + "  ·  " + mapName.toUpperCase(), W / 2, H / 2 + 240);

      if (percentile !== null) {
        ctx.fillStyle = accent;
        ctx.font = "500 22px Inter, system-ui, sans-serif";
        ctx.fillText(`Top ${100 - percentile}% today`, W / 2, H - 180);
      }

      ctx.fillStyle = "rgba(233, 228, 214, 0.45)";
      ctx.font = "500 16px Inter, system-ui, sans-serif";
      ctx.fillText("Play daily · retake.app", W / 2, H - 90);

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `retake-${grade}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  }, [grade, score, maxScore, tier, percentile, scenarioName, mapName]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-md border border-border-10 bg-surface/70 px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-border-12 hover:text-ink disabled:opacity-60"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {busy ? "Exporting" : "Share card"}
    </button>
  );
}
