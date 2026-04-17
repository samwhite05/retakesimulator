"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DecisionPoint, DecisionKindId } from "@/types";

interface DecisionOverlayProps {
  decision: DecisionPoint;
  onDecide: (choiceId: string, timedOut: boolean) => void;
  /** Disable choice buttons while a network round-trip is in flight. */
  submitting?: boolean;
}

const KIND_TONE: Record<DecisionKindId, { label: string; color: string }> = {
  first_contact: { label: "First contact", color: "text-valorant-red" },
  ally_down: { label: "Ally down", color: "text-valorant-red" },
  utility_window: { label: "Utility window", color: "text-violet" },
  spike_threshold: { label: "Clock", color: "text-amber" },
  recon_info: { label: "Recon", color: "text-teal" },
  low_hp_duel: { label: "Low HP duel", color: "text-amber" },
};

/**
 * Fullscreen modal overlay rendered on top of the cinematic whenever the
 * engine surfaces a `DecisionPoint`. The player gets label + rationale per
 * option, keyboard shortcuts 1/2/3, and a 10-second decay timer that
 * auto-picks the default option on expiry.
 */
export default function DecisionOverlay({ decision, onDecide, submitting }: DecisionOverlayProps) {
  const [now, setNow] = useState(0);
  const startRef = useRef<number>(0);
  const settledRef = useRef(false);
  const duration = Math.max(2000, decision.timerMs);

  const defaultChoiceId = useMemo(() => {
    return decision.choices.find((c) => c.isDefault)?.id ?? decision.choices[decision.choices.length - 1]?.id;
  }, [decision]);

  useEffect(() => {
    startRef.current = performance.now();
    settledRef.current = false;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      setNow(elapsed);
      if (elapsed >= duration && !settledRef.current) {
        settledRef.current = true;
        onDecide(defaultChoiceId, true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [decision.id, duration, defaultChoiceId, onDecide]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submitting || settledRef.current) return;
      const num = Number(e.key);
      if (!Number.isNaN(num) && num >= 1 && num <= decision.choices.length) {
        const c = decision.choices[num - 1];
        if (c) {
          settledRef.current = true;
          onDecide(c.id, false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decision.choices, onDecide, submitting]);

  const progress = Math.max(0, Math.min(1, 1 - now / duration));
  const secondsLeft = Math.max(0, Math.ceil((duration - now) / 1000));
  const tone = KIND_TONE[decision.kind];

  const handlePick = (choiceId: string) => {
    if (settledRef.current || submitting) return;
    settledRef.current = true;
    onDecide(choiceId, false);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-pure-black/60 backdrop-blur-[2px]" />

      <div
        className="relative z-10 flex w-[min(680px,92vw)] flex-col gap-5 rounded-xl border border-border-12 bg-surface/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
        style={{ animation: "decisionIn 240ms ease-out both" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`text-[10px] uppercase tracking-[0.3em] ${tone?.color ?? "text-ink-mute"}`}>
              {tone?.label ?? decision.kind}
            </div>
            <h2 className="mt-1 text-[22px] font-bold leading-tight text-ink">
              {decision.headline}
            </h2>
            {decision.subline && (
              <p className="mt-1 text-[13px] text-ink-dim">{decision.subline}</p>
            )}
          </div>

          <div className="relative h-14 w-14 flex-shrink-0">
            <svg viewBox="0 0 40 40" className="absolute inset-0">
              <circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
              <circle
                cx="20"
                cy="20"
                r="17"
                stroke={progress > 0.4 ? "#f5b13c" : "#ff4655"}
                strokeWidth="3"
                fill="none"
                strokeDasharray={2 * Math.PI * 17}
                strokeDashoffset={(1 - progress) * 2 * Math.PI * 17}
                strokeLinecap="round"
                transform="rotate(-90 20 20)"
                style={{ transition: "stroke 0.2s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[16px] font-bold text-ink">
              {secondsLeft}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {decision.choices.map((choice, idx) => (
            <button
              key={choice.id}
              type="button"
              disabled={submitting}
              onClick={() => handlePick(choice.id)}
              className="group flex items-start gap-3 rounded-lg border border-border-10 bg-pure-black/40 px-4 py-3 text-left transition-all hover:border-amber/40 hover:bg-amber/10 focus:outline-none focus:ring-2 focus:ring-amber/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-12 bg-surface/70 font-mono text-[12px] font-bold text-ink-dim group-hover:text-amber">
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{choice.label}</span>
                  {choice.isDefault && (
                    <span className="rounded-full border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12px] text-ink-dim">{choice.rationale}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-mute">
          <span>Shortcut: {decision.choices.map((_, i) => i + 1).join(" / ")}</span>
          <span>Timeout picks default</span>
        </div>
      </div>

      <style>{`
        @keyframes decisionIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
