"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Outcome } from "@shared/types";

const TIER_CONFIG = {
  clean: {
    color: "text-success",
    glowColor: "rgba(0, 255, 136, 0.08)",
    borderColor: "border-success/20",
    label: "CLEAN RETAKE",
    mono: "CLEAN",
  },
  messy: {
    color: "text-warning",
    glowColor: "rgba(255, 170, 0, 0.08)",
    borderColor: "border-warning/20",
    label: "MESSY BUT SUCCESSFUL",
    mono: "MESSY",
  },
  failed: {
    color: "text-danger",
    glowColor: "rgba(255, 59, 92, 0.08)",
    borderColor: "border-danger/20",
    label: "RETAKE FAILED",
    mono: "FAILED",
  },
};

export default function ResultsPage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedOutcome = sessionStorage.getItem("lastOutcome");
    const savedPlan = sessionStorage.getItem("lastPlan");

    if (savedOutcome) {
      setOutcome(JSON.parse(savedOutcome));
    }
    if (savedPlan) {
      setPlan(JSON.parse(savedPlan));
    }

    setLoading(false);
  }, []);

  const handlePlayAgain = () => {
    router.push("/");
  };

  const handleShare = () => {
    const text = outcome
      ? `Retake Roulette — ${TIER_CONFIG[outcome.tier].label}\nScore: ${outcome.score}/100\nCan you do better?`
      : "Check out Retake Roulette!";

    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  if (loading || !outcome) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-none h-5 w-5 border border-cyan border-t-transparent" />
          <p className="mt-4 text-text-muted text-xs font-mono" style={{ letterSpacing: "0.5px" }}>
            LOADING RESULTS...
          </p>
        </div>
      </main>
    );
  }

  const tier = TIER_CONFIG[outcome.tier];

  return (
    <main className="min-h-screen bg-void px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Tier Badge — pure black card with glow */}
        <div
          className={`border ${tier.borderColor} rounded p-8 text-center space-y-4`}
          style={{ backgroundColor: tier.glowColor }}
        >
          <span
            className="text-text-muted text-[10px] uppercase font-mono tracking-widest block"
            style={{ letterSpacing: "0.7px" }}
          >
            {tier.mono}
          </span>
          <h1
            className={`text-3xl font-mono tracking-wider ${tier.color}`}
            style={{ lineHeight: 1.0, letterSpacing: "0.5px" }}
          >
            {tier.label}
          </h1>
          <p className="text-text-secondary text-sm">{outcome.summary}</p>
        </div>

        {/* Score — metrics display */}
        <div className="bg-pure-black rounded p-6 border border-border-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2
              className="text-text-tertiary text-xs uppercase font-mono tracking-widest"
              style={{ letterSpacing: "0.7px" }}
            >
              SCORE
            </h2>
            <span className={`font-mono tracking-tight ${tier.color}`} style={{ fontSize: "2.5rem", lineHeight: 1 }}>
              {outcome.score}
              <span className="text-text-muted text-base">/100</span>
            </span>
          </div>

          {/* Score Bar — minimal */}
          <div className="h-1 bg-border-04 rounded-none overflow-hidden">
            <div
              className={`h-full rounded-none transition-all ${outcome.tier === "clean"
                  ? "bg-success"
                  : outcome.tier === "messy"
                    ? "bg-warning"
                    : "bg-danger"
                }`}
              style={{ width: `${outcome.score}%` }}
            />
          </div>

          <p className="text-text-muted text-xs text-center font-mono" style={{ letterSpacing: "0.3px" }}>
            SUBMIT TO SEE COMMUNITY RANK
          </p>
        </div>

        {/* Rule Breakdown */}
        <div className="bg-pure-black rounded p-6 border border-border-10 space-y-3">
          <h2
            className="text-text-tertiary text-xs uppercase font-mono tracking-widest mb-4"
            style={{ letterSpacing: "0.7px" }}
          >
            BREAKDOWN
          </h2>

          {outcome.scoreBreakdown.map((rule) => (
            <div
              key={rule.ruleId}
              className={`flex items-start gap-3 p-3 rounded border ${rule.passed
                  ? "border-success/10 bg-success-dim"
                  : "border-border-04 bg-transparent"
                }`}
            >
              <span className="text-sm flex-shrink-0 font-mono text-text-muted">
                {rule.passed ? "OK" : "--"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm">{rule.description}</p>
                <p className="text-text-muted text-xs mt-0.5 font-mono">{rule.detail}</p>
              </div>
              <span
                className={`text-xs font-mono flex-shrink-0 ${rule.passed ? "text-success" : "text-text-muted"
                  }`}
              >
                +{rule.earnedPoints}/{rule.maxPoints}
              </span>
            </div>
          ))}
        </div>

        {/* Highlights */}
        {outcome.highlights.length > 0 && (
          <div className="bg-pure-black rounded p-6 border border-border-08 space-y-2">
            <h2
              className="text-success text-xs uppercase font-mono tracking-widest"
              style={{ letterSpacing: "0.7px" }}
            >
              WHAT WORKED
            </h2>
            {outcome.highlights.map((h, i) => (
              <p key={i} className="text-text-secondary text-sm flex items-start gap-2">
                <span className="text-success mt-1 text-xs font-mono">▸</span>
                {h}
              </p>
            ))}
          </div>
        )}

        {/* Mistakes */}
        {outcome.mistakes.length > 0 && (
          <div className="bg-pure-black rounded p-6 border border-border-08 space-y-2">
            <h2
              className="text-danger text-xs uppercase font-mono tracking-widest"
              style={{ letterSpacing: "0.7px" }}
            >
              WHAT FAILED
            </h2>
            {outcome.mistakes.map((m, i) => (
              <p key={i} className="text-text-secondary text-sm flex items-start gap-2">
                <span className="text-danger mt-1 text-xs font-mono">▸</span>
                {m}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-transparent border border-border-10 hover:border-border-12 rounded text-text-secondary font-mono text-xs tracking-widest uppercase transition-colors"
            style={{ letterSpacing: "0.7px" }}
          >
            SHARE
          </button>
          <button
            onClick={handlePlayAgain}
            className="flex-1 py-3 bg-text-primary hover:bg-text-primary/90 rounded text-void font-mono text-xs tracking-widest uppercase transition-all"
            style={{ letterSpacing: "0.7px" }}
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    </main>
  );
}
