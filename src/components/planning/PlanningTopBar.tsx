"use client";

interface PlanningTopBarProps {
  scenarioName: string;
  mapName: string;
  activeStep: 1 | 2 | 3 | 4;
  onBack: () => void;
  onHelp: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const STEPS: { id: 1 | 2 | 3 | 4; label: string; hint: string }[] = [
  { id: 1, label: "Place", hint: "Drop your squad" },
  { id: 2, label: "Utility", hint: "Draft smokes & flashes" },
  { id: 3, label: "Paths", hint: "Draw routes with hold points" },
  { id: 4, label: "Simulate", hint: "Run the retake" },
];

function IconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-border-08 text-ink-dim transition-colors hover:border-border-12 hover:bg-surface hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

export default function PlanningTopBar({
  scenarioName,
  mapName,
  activeStep,
  onBack,
  onHelp,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: PlanningTopBarProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-06 bg-pure-black/85 px-5 py-3 backdrop-blur-md">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-ink-dim transition-colors hover:text-ink"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-valorant-red/40 bg-valorant-red/10 text-valorant-red">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">Retake<span className="text-valorant-red">.</span></span>
        </button>
        <div className="h-6 w-px bg-border-08" />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-mute">Today&apos;s scenario</div>
          <div className="truncate text-sm font-medium text-ink">{scenarioName} · <span className="text-ink-dim">{mapName}</span></div>
        </div>
      </div>

      <nav className="hidden items-center gap-1 md:flex" aria-label="Planning progress">
        {STEPS.map((step, idx) => {
          const done = step.id < activeStep;
          const active = step.id === activeStep;
          return (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors ${
                  active
                    ? "bg-amber/15 text-amber ring-1 ring-amber/30"
                    : done
                      ? "text-teal"
                      : "text-ink-mute"
                }`}
                title={step.hint}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                    active
                      ? "bg-amber text-pure-black"
                      : done
                        ? "bg-teal text-pure-black"
                        : "bg-surface text-ink-mute"
                  }`}
                >
                  {done ? "✓" : step.id}
                </span>
                {step.label}
              </div>
              {idx < STEPS.length - 1 && <div className="h-px w-4 bg-border-08" />}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-1.5">
        <IconButton onClick={onUndo} label="Undo (⌘Z)" disabled={!canUndo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
          </svg>
        </IconButton>
        <IconButton onClick={onRedo} label="Redo (⇧⌘Z)" disabled={!canRedo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
          </svg>
        </IconButton>
        <IconButton onClick={onHelp} label="How to play">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </IconButton>
      </div>
    </header>
  );
}
