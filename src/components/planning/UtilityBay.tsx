"use client";

import type { UtilityItem } from "@/types";
import { getAbilityIconUrl } from "@/lib/assets";
import { getAbilityDisplayInfo, getAgentDef, UtilityTone } from "@/lib/constants";

interface UtilityBayProps {
  utilityPlacements: UtilityItem[];
  totalUtilityCharges: number;
  canSimulate: boolean;
  simulating: boolean;
  onClear: () => void;
  onSimulate: () => void;
  onRemoveUtility: (id: string) => void;
  remainingSeconds?: number;
}

/** Tailwind class bundles per utility tone. Keeping this close to the bay so
 *  restyling one util type can't leak into the glyph palette or the feed. */
const TONE_CHIP: Record<UtilityTone, string> = {
  violet:
    "border-violet/35 bg-violet/[0.08] text-violet hover:border-violet/60 hover:bg-violet/[0.14]",
  amber:
    "border-amber/35 bg-amber/[0.08] text-amber hover:border-amber/60 hover:bg-amber/[0.14]",
  red:
    "border-valorant-red/35 bg-valorant-red/[0.08] text-valorant-red hover:border-valorant-red/60 hover:bg-valorant-red/[0.14]",
  teal:
    "border-teal/35 bg-teal/[0.08] text-teal hover:border-teal/60 hover:bg-teal/[0.14]",
  iron:
    "border-border-14 bg-surface/60 text-ink-dim hover:border-border-20 hover:bg-surface",
};

const SLOT_LABEL: Record<"C" | "Q" | "E" | "X", string> = {
  C: "C",
  Q: "Q",
  E: "E",
  X: "X",
};

export default function UtilityBay({
  utilityPlacements,
  totalUtilityCharges,
  canSimulate,
  simulating,
  onClear,
  onSimulate,
  onRemoveUtility,
  remainingSeconds,
}: UtilityBayProps) {
  const usedCount = utilityPlacements.length;
  return (
    <div className="flex items-center gap-3 border-t border-border-06 bg-pure-black/85 px-5 py-3 backdrop-blur-md">
      <div className="flex min-w-[150px] flex-col">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-mute">
          Utility drafted
        </div>
        <div className="font-mono text-[13px] text-ink">
          {usedCount} <span className="text-ink-mute">/ {totalUtilityCharges}</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-x-auto">
        {usedCount === 0 ? (
          <div className="flex h-10 items-center text-[11px] italic text-ink-mute">
            Tap an ability in the left rail, then tap the map to place it.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {utilityPlacements.map((u) => {
              const info = getAbilityDisplayInfo(u.agentId, u.type);
              const agentDisplay = getAgentDef(u.agentId)?.displayName ?? u.agentId;
              const iconUrl = getAbilityIconUrl(info.name);
              const tone = TONE_CHIP[info.tone];
              const slot = info.slot ? SLOT_LABEL[info.slot] : null;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onRemoveUtility(u.id)}
                  title={`${agentDisplay} · ${info.name} — click to remove`}
                  className={`group relative flex h-10 items-center gap-2 rounded-md border pl-1.5 pr-3 transition-all ${tone}`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-pure-black/40">
                    {iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={iconUrl}
                        alt=""
                        className="h-6 w-6 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      {info.name}
                    </span>
                    <span className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-ink-mute">
                      {agentDisplay}
                    </span>
                  </div>
                  {slot && (
                    <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-sm border border-current/30 bg-pure-black/50 font-mono text-[9px] font-semibold">
                      {slot}
                    </span>
                  )}
                  <span className="pointer-events-none ml-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-80">
                    ✕
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {typeof remainingSeconds === "number" && (
        <div className="hidden flex-col text-right md:flex">
          <div className="text-[9px] uppercase tracking-[0.2em] text-ink-mute">
            Spike
          </div>
          <div className="font-mono text-[13px] text-valorant-red">
            {Math.max(0, remainingSeconds).toString().padStart(2, "0")}.0s
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onClear}
        className="flex h-9 items-center gap-1.5 rounded-md border border-border-10 px-3 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-valorant-red/40 hover:text-valorant-red"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
        </svg>
        Clear
      </button>

      <button
        type="button"
        onClick={onSimulate}
        disabled={!canSimulate || simulating}
        className="flex h-9 items-center gap-2 rounded-md bg-valorant-red px-5 text-[12px] font-semibold uppercase tracking-wider text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {simulating ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Running
          </>
        ) : (
          <>
            Run simulation
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
