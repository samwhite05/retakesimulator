"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "retake-onboarded-v1";

const STEPS: Record<number, { title: string; body: string; hint: string }> = {
  1: {
    title: "Start here → pick an agent",
    body: "The left rail holds your squad. Tap an agent's card to start placing them, then tap a spawn tile.",
    hint: "Tip: every agent needs a starting tile before you can draw paths.",
  },
  2: {
    title: "Draft utility from the rail",
    body: "Each placed agent shows ability chips. Tap a chip, then tap on the map to aim the ability.",
    hint: "Smokes block vision. Flashes blind. Molotovs clear corners. Use them on enemy sightlines.",
  },
  3: {
    title: "Draw an entry path for each agent",
    body: "Use the teal Entry chip under an agent, then tap where they should rush in wave 1.",
    hint: "Dashes (Jett, Raze) extend wave-1 range once per agent. Paths snap to reachable tiles.",
  },
  4: {
    title: "Lock it in and simulate",
    body: "Everything looks good. Press Run simulation to watch the retake and see your daily grade.",
    hint: "You get one official run a day. After grading, scrim mode lets you retry freely.",
  },
};

interface OnboardingCoachmarkProps {
  activeStep: 1 | 2 | 3 | 4;
}

export default function OnboardingCoachmark({ activeStep }: OnboardingCoachmarkProps) {
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboarded(seen === "1");
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboarded(true);
    }
  }, []);

  useEffect(() => {
    if (onboarded) return;
    if (activeStep === 4 && !dismissed[4]) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* noop */
      }
    }
  }, [activeStep, onboarded, dismissed]);

  if (onboarded) return null;
  if (dismissed[activeStep]) return null;

  const step = STEPS[activeStep];
  if (!step) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[55] w-full max-w-md -translate-x-1/2 px-4">
      <div className="pointer-events-auto overflow-hidden rounded-xl border border-amber/30 bg-pure-black/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)] retake-fade-up">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber/15 font-mono text-[12px] font-bold text-amber">
            {activeStep}/4
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">{step.title}</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-ink-dim">{step.body}</div>
            <div className="mt-1.5 text-[11px] italic leading-relaxed text-amber/80">{step.hint}</div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed((d) => ({ ...d, [activeStep]: true }))}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-08 text-ink-mute transition-colors hover:border-border-12 hover:text-ink"
            aria-label="Dismiss tip"
          >
            ×
          </button>
        </div>
        <div className="flex gap-1 bg-surface/60 px-4 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${
                s < activeStep ? "bg-teal" : s === activeStep ? "bg-amber" : "bg-border-10"
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                /* noop */
              }
              setOnboarded(true);
            }}
            className="ml-2 text-[10px] uppercase tracking-wider text-ink-mute hover:text-ink"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
