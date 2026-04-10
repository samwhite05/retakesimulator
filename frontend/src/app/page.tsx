"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScenario() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/scenarios/today`
        );
        const json = await res.json();

        if (json.success) {
          setScenario(json.data);
        } else {
          setError(json.error || "Failed to load scenario");
        }
      } catch {
        setError("Could not connect to server. Is the backend running?");
      } finally {
        setLoading(false);
      }
    }

    fetchScenario();
  }, []);

  const handleStart = () => {
    router.push("/planning");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-void px-4">
      <div className="max-w-lg w-full space-y-8 text-center">
        {/* Title — compressed, authoritative */}
        <div className="space-y-3">
          <h1
            className="text-5xl sm:text-6xl text-text-primary tracking-tight"
            style={{ lineHeight: 0.87, fontFamily: "var(--font-sans)" }}
          >
            RETAKE ROULETTE
          </h1>
          <p className="text-text-secondary text-sm tracking-wide">
            One scenario. One chance. Outsmart the community.
          </p>
        </div>

        {/* Divider — subtle border mist */}
        <div className="h-px bg-gradient-to-r from-transparent via-border-08 to-transparent" />

        {loading ? (
          <div className="py-12">
            {/* Terminal-style spinner */}
            <div className="inline-block animate-spin rounded-none h-5 w-5 border border-cyan border-t-transparent" />
            <p className="mt-4 text-text-muted text-xs font-mono" style={{ letterSpacing: "0.5px" }}>
              LOADING SCENARIO...
            </p>
          </div>
        ) : error ? (
          <div className="py-8 space-y-4">
            <div
              className="bg-pure-black rounded p-6 border border-border-10"
            >
              <p className="text-danger text-sm font-mono">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-charcoal hover:bg-charcoal/80 rounded text-text-secondary text-xs font-mono transition-colors"
              style={{ letterSpacing: "0.5px" }}
            >
              RETRY
            </button>
          </div>
        ) : scenario ? (
          <div className="space-y-6">
            {/* Scenario Card — pure black, border containment */}
            <div
              className="bg-pure-black rounded p-6 border border-border-10 space-y-4 text-left"
            >
              {/* Overline label */}
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-success rounded-none animate-pulse" />
                <span
                  className="text-text-tertiary text-[10px] uppercase tracking-widest font-mono"
                  style={{ letterSpacing: "0.3px" }}
                >
                  TODAY&apos;S SCENARIO
                </span>
              </div>

              <h2
                className="text-2xl text-text-primary tracking-tight"
                style={{ lineHeight: 1.0 }}
              >
                {scenario.scenario.name}
              </h2>

              <p className="text-text-secondary text-sm leading-relaxed">
                {scenario.scenario.description}
              </p>

              {/* Difficulty — monospace metrics */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-text-muted font-mono">
                  DIFFICULTY{" "}
                  <span className="text-warning">
                    {"★".repeat(scenario.scenario.difficulty)}
                    {"☆".repeat(5 - scenario.scenario.difficulty)}
                  </span>
                </span>
              </div>
            </div>

            {/* Play Info — metadata row */}
            <div className="flex items-center justify-center gap-3 text-xs text-text-muted font-mono" style={{ letterSpacing: "0.3px" }}>
              <span className="bg-pure-black border border-border-06 px-3 py-1 rounded">
                {scenario.playsRemaining} PLAYS TODAY
              </span>
              {scenario.hasAdAvailable && (
                <span className="bg-pure-black border border-border-06 px-3 py-1 rounded">
                  + AD FOR EXTRA PLAY
                </span>
              )}
            </div>

            {/* CTA Button — white fill, dark text */}
            <button
              onClick={handleStart}
              className="w-full py-4 bg-text-primary hover:bg-text-primary/90 text-void font-mono text-sm tracking-widest uppercase rounded transition-all active:scale-[0.98]"
            >
              PLAN YOUR RETAKE
            </button>
          </div>
        ) : null}

        {/* Footer — tertiary text */}
        <div className="pt-8 text-xs text-text-muted/50 font-mono" style={{ letterSpacing: "0.3px" }}>
          RETAKE ROULETTE — A DAILY TACTICAL PUZZLE
        </div>
      </div>
    </main>
  );
}
