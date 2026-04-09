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
      } catch (err) {
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
    <main className="min-h-screen flex flex-col items-center justify-center bg-vdark px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo / Title */}
        <div className="space-y-2">
          <h1 className="font-heading text-5xl font-bold tracking-wider text-vr">
            RETAKE ROULETTE
          </h1>
          <p className="text-vtext-dim text-sm tracking-wide">
            ONE SCENARIO. ONE CHANCE. OUTSMART THE COMMUNITY.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-vr to-transparent" />

        {loading ? (
          <div className="py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-vr border-t-transparent" />
            <p className="mt-4 text-vtext-dim text-sm">Loading scenario...</p>
          </div>
        ) : error ? (
          <div className="py-8 space-y-4">
            <div className="bg-vsurface rounded-lg p-6 border border-vr/30">
              <p className="text-vr font-medium">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-vsurface hover:bg-vsurface-hover rounded text-vtext text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        ) : scenario ? (
          <div className="space-y-6">
            {/* Scenario Card */}
            <div className="bg-vsurface rounded-lg p-6 border border-vtext-dim/10 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-vsuccess rounded-full animate-pulse" />
                <span className="text-vtext-dim text-xs uppercase tracking-widest">
                  Today&apos;s Scenario
                </span>
              </div>

              <h2 className="font-heading text-2xl font-semibold text-vtext">
                {scenario.scenario.name}
              </h2>

              <p className="text-vtext-dim text-sm leading-relaxed">
                {scenario.scenario.description}
              </p>

              <div className="flex items-center justify-center gap-4 text-xs">
                <span className="text-vtext-dim">
                  Difficulty:{" "}
                  <span className="text-vwarning">
                    {"★".repeat(scenario.scenario.difficulty)}
                    {"☆".repeat(5 - scenario.scenario.difficulty)}
                  </span>
                </span>
              </div>
            </div>

            {/* Play Info */}
            <div className="flex items-center justify-center gap-3 text-xs text-vtext-dim">
              <span className="bg-vsurface px-3 py-1 rounded">
                {scenario.playsRemaining} free play{scenario.playsRemaining !== 1 ? "s" : ""} today
              </span>
              {scenario.hasAdAvailable && (
                <span className="bg-vsurface px-3 py-1 rounded">
                  + Watch ad for extra play
                </span>
              )}
            </div>

            {/* CTA Button */}
            <button
              onClick={handleStart}
              className="w-full py-4 bg-vr hover:bg-vr/90 text-white font-heading text-lg font-semibold tracking-widest uppercase rounded transition-all hover:shadow-[0_0_20px_rgba(255,70,85,0.3)] active:scale-[0.98]"
            >
              PLAN YOUR RETAKE
            </button>
          </div>
        ) : null}

        {/* Footer */}
        <div className="pt-8 text-xs text-vtext-dim/50">
          <p>Retake Roulette — A daily Valorant tactical puzzle</p>
        </div>
      </div>
    </main>
  );
}
