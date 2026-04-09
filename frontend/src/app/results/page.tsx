"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Outcome } from "@shared/types";

const TIER_CONFIG = {
  clean: {
    color: "text-vsuccess",
    bgColor: "bg-vsuccess/10",
    borderColor: "border-vsuccess/30",
    label: "CLEAN RETAKE",
    emoji: "🎯",
  },
  messy: {
    color: "text-vwarning",
    bgColor: "bg-vwarning/10",
    borderColor: "border-vwarning/30",
    label: "MESSY BUT SUCCESSFUL",
    emoji: "💥",
  },
  failed: {
    color: "text-vr",
    bgColor: "bg-vr/10",
    borderColor: "border-vr/30",
    label: "RETAKE FAILED",
    emoji: "💀",
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
    // TODO: Generate shareable image
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
      <main className="min-h-screen flex items-center justify-center bg-vdark">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-vr border-t-transparent" />
          <p className="mt-4 text-vtext-dim text-sm">Loading results...</p>
        </div>
      </main>
    );
  }

  const tier = TIER_CONFIG[outcome.tier];

  return (
    <main className="min-h-screen bg-vdark px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Tier Badge */}
        <div
          className={`${tier.bgColor} ${tier.borderColor} border rounded-xl p-8 text-center space-y-4`}
        >
          <span className="text-4xl">{tier.emoji}</span>
          <h1 className={`font-heading text-3xl font-bold tracking-wider ${tier.color}`}>
            {tier.label}
          </h1>
          <p className="text-vtext-dim text-sm">{outcome.summary}</p>
        </div>

        {/* Score */}
        <div className="bg-vsurface rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg text-vtext tracking-wide">SCORE</h2>
            <span className={`font-heading text-4xl font-bold ${tier.color}`}>
              {outcome.score}
              <span className="text-vtext-dim text-lg">/100</span>
            </span>
          </div>

          {/* Score Bar */}
          <div className="h-2 bg-vdark rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${outcome.tier === "clean"
                  ? "bg-vsuccess"
                  : outcome.tier === "messy"
                    ? "bg-vwarning"
                    : "bg-vr"
                }`}
              style={{ width: `${outcome.score}%` }}
            />
          </div>

          {/* Community Rank */}
          <p className="text-vtext-dim text-xs text-center">
            Submit your plan to see how you rank against the community
          </p>
        </div>

        {/* Rule Breakdown */}
        <div className="bg-vsurface rounded-xl p-6 space-y-3">
          <h2 className="font-heading text-lg text-vtext tracking-wide">BREAKDOWN</h2>

          {outcome.scoreBreakdown.map((rule) => (
            <div
              key={rule.ruleId}
              className={`flex items-start gap-3 p-3 rounded-lg ${rule.passed ? "bg-vsuccess/5" : "bg-vr/5"
                }`}
            >
              <span className="text-lg flex-shrink-0">
                {rule.passed ? "✅" : "❌"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-vtext text-sm font-medium">{rule.description}</p>
                <p className="text-vtext-dim text-xs mt-0.5">{rule.detail}</p>
              </div>
              <span
                className={`text-sm font-mono flex-shrink-0 ${rule.passed ? "text-vsuccess" : "text-vtext-dim"
                  }`}
              >
                +{rule.earnedPoints}/{rule.maxPoints}
              </span>
            </div>
          ))}
        </div>

        {/* Highlights */}
        {outcome.highlights.length > 0 && (
          <div className="bg-vsurface rounded-xl p-6 space-y-2">
            <h2 className="font-heading text-lg text-vsuccess tracking-wide">WHAT WORKED</h2>
            {outcome.highlights.map((h, i) => (
              <p key={i} className="text-vtext-dim text-sm flex items-start gap-2">
                <span className="text-vsuccess mt-0.5">▸</span>
                {h}
              </p>
            ))}
          </div>
        )}

        {/* Mistakes */}
        {outcome.mistakes.length > 0 && (
          <div className="bg-vsurface rounded-xl p-6 space-y-2">
            <h2 className="font-heading text-lg text-vr tracking-wide">WHAT FAILED</h2>
            {outcome.mistakes.map((m, i) => (
              <p key={i} className="text-vtext-dim text-sm flex items-start gap-2">
                <span className="text-vr mt-0.5">▸</span>
                {m}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 py-3 bg-vsurface hover:bg-vsurface-hover rounded-lg text-vtext font-heading tracking-wider uppercase transition-colors"
          >
            Share
          </button>
          <button
            onClick={handlePlayAgain}
            className="flex-1 py-3 bg-vr hover:bg-vr/90 rounded-lg text-white font-heading tracking-wider uppercase transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
