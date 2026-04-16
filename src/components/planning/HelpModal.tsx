"use client";

import { useEffect } from "react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    num: "01",
    title: "Drop your squad",
    body: "Tap an agent in the left rail, then tap a highlighted spawn tile to place them. Tap a placed agent to re-position.",
  },
  {
    num: "02",
    title: "Draft your utility",
    body: "Each agent shows their ability chips with charges remaining. Tap a chip, then tap the map to aim or drop the utility.",
  },
  {
    num: "03",
    title: "Draw an entry path",
    body: "Use the Entry chip (teal) to draw where each agent rushes in wave 1. Dash extends range once per agent.",
  },
  {
    num: "04",
    title: "Decide re-site (or hold)",
    body: "Use Re-site (amber) to draw a second wave path, or Hold to anchor them at the entry endpoint. Re-site is optional — default is hold.",
  },
  {
    num: "05",
    title: "Simulate",
    body: "Press Run simulation. You only get one official run a day. The replay plays out your entire plan and grades you.",
  },
];

const RULE_CATEGORIES: { label: string; body: string; tone: string }[] = [
  { label: "Critical", body: "Defuse (wipe site or tap spike uncontested)", tone: "text-valorant-red border-valorant-red/30" },
  { label: "Important", body: "Keep the squad alive and break enemy sightlines", tone: "text-amber border-amber/30" },
  { label: "Minor", body: "Use utility efficiently — don't waste charges", tone: "text-ink-dim border-border-10" },
];

export default function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label="How to play"
    >
      <div
        className="absolute inset-0 bg-pure-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border-10 bg-surface/95 shadow-[0_0_60px_rgba(0,0,0,0.7)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber/40 to-transparent" />

        <div className="flex items-center justify-between px-6 py-5 border-b border-border-06">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">Retake</p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">How it works</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-08 text-ink-mute transition-colors hover:border-border-12 hover:bg-surface hover:text-ink"
            aria-label="Close"
          >
            <span className="text-lg leading-none" aria-hidden>×</span>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          <p className="text-[13px] leading-relaxed text-ink-dim">
            You&apos;re the IGL. Two of your teammates are already down, the spike is planted, and you have one shot to call
            the retake. Plan every agent&apos;s entry, utility, and re-site, then watch it resolve.
          </p>

          <ol className="space-y-3">
            {STEPS.map((step) => (
              <li key={step.num} className="flex gap-4 rounded-lg border border-border-08 bg-pure-black/40 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber/10 font-mono text-[11px] font-semibold text-amber">
                  {step.num}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-ink">{step.title}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-ink-dim">{step.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">How you&apos;re graded</div>
            <div className="space-y-1.5">
              {RULE_CATEGORIES.map((r) => (
                <div key={r.label} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${r.tone}`}>
                  <span className="min-w-16 font-mono text-[10px] font-semibold uppercase tracking-wider">{r.label}</span>
                  <span className="text-[12px] text-ink-dim">{r.body}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-lg border border-teal/25 bg-teal/5 px-4 py-3 text-[12px] leading-relaxed text-teal">
            <span className="font-semibold">Shortcuts:</span>
            <span className="text-ink-dim"> Cmd+Z to undo · Cmd+⇧+Z to redo · Esc to close panels · Tab to cycle agents.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
