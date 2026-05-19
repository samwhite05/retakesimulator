"use client";

import { useEffect, useRef } from "react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    num: "01",
    title: "Drop your squad",
    body: "In the squad rail, tap an agent, then tap a highlighted spawn tile. Tap a placed agent again to move them before you route.",
  },
  {
    num: "02",
    title: "Draft pre-contact utility",
    body: "Each placed agent shows ability chips with charges. Tap a chip, then tap the map to aim or place. Only pre-contact utility belongs here — reactive util happens during live decisions.",
  },
  {
    num: "03",
    title: "Draw routes (Route)",
    body: "Under each agent, tap the teal Route button, then tap the map to set their path to first contact. If no path appears, try a tile closer to the site or adjust your spawn.",
  },
  {
    num: "04",
    title: "Commit & execute",
    body: "When the briefing checklist is satisfied, press Commit & Execute in the bottom bar. You’ll watch the run; after first contact the sim pauses for timed tactical choices (number keys 1–3).",
  },
];

const RULE_CATEGORIES: { label: string; body: string; tone: string }[] = [
  { label: "Critical", body: "Defuse (wipe site or tap spike uncontested)", tone: "text-valorant-red border-valorant-red/30" },
  { label: "Important", body: "Keep the squad alive and break enemy sightlines", tone: "text-amber border-amber/30" },
  { label: "Minor", body: "Use utility efficiently — don't waste charges", tone: "text-ink-dim border-border-10" },
];

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const closeBtn = closeBtnRef.current;
    closeBtn?.focus();

    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="help-modal-title"
    >
      <div
        className="absolute inset-0 bg-pure-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border-10 bg-surface/95 shadow-[0_0_60px_rgba(0,0,0,0.7)]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber/40 to-transparent" />

        <div className="flex items-center justify-between border-b border-border-06 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute">Retake</p>
            <h2 id="help-modal-title" className="mt-0.5 text-xl font-semibold tracking-tight text-ink">
              How it works
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-08 text-ink-mute transition-colors hover:border-border-12 hover:bg-surface hover:text-ink"
            aria-label="Close help"
          >
            <span className="text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          <p className="text-[13px] leading-relaxed text-ink-dim">
            You&apos;re the IGL. Two teammates are down, spike is planted, and you plan the retake on the minimap. After you
            commit, the sim plays out with live decision points — your grade reflects both the plan and those calls.
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
            <span className="text-ink-dim">
              {" "}
              ⌘Z undo · ⇧⌘Z redo · Esc closes this panel · during live decisions, press 1 / 2 / 3 to pick an option.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
