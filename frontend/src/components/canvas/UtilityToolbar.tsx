"use client";

import { useState, useEffect } from "react";
import type { UtilityDef, UtilityType } from "@shared/types";
import { getAbilityIconUrl } from "@shared/assets";

interface UtilityToolbarProps {
  availableUtility: UtilityDef[];
  usedUtility: Record<string, number>;
  selectedUtility: { type: UtilityType; agentId: string } | null;
  onSelectUtility: (type: UtilityType, agentId: string) => void;
}

const UTILITY_BORDER_COLORS: Record<UtilityType, string> = {
  smoke: "border-signal/30",
  flash: "border-warning/30",
  mollie: "border-danger/30",
  dart: "border-success/30",
  dash: "border-cyan/30",
  concussion: "border-cyan/20",
  decoy: "border-signal/20",
  gravity_well: "border-warning/30",
  nanoswarm: "border-warning/20",
  tripwire: "border-cyan/30",
  trap: "border-border-10",
  heal: "border-success/30",
  revive: "border-success/30",
  wall: "border-signal/30",
  turret: "border-warning/30",
  sensor: "border-signal/30",
  alarm: "border-danger/20",
};

const UTILITY_TEXT_COLORS: Record<UtilityType, string> = {
  smoke: "text-signal",
  flash: "text-warning",
  mollie: "text-danger",
  dart: "text-success",
  dash: "text-cyan",
  concussion: "text-cyan",
  decoy: "text-signal",
  gravity_well: "text-warning",
  nanoswarm: "text-warning",
  tripwire: "text-cyan",
  trap: "text-text-muted",
  heal: "text-success",
  revive: "text-success",
  wall: "text-signal",
  turret: "text-warning",
  sensor: "text-signal",
  alarm: "text-danger",
};

// Find ability icon URL by type + agent
function getIconForUtility(type: UtilityType, agentId: string): string | null {
  try {
    const { ALL_AGENTS } = require("@shared/agentAbilities");
    const agent = ALL_AGENTS.find((a: any) => a.id === agentId);
    if (!agent) return null;
    const ability = agent.abilities.find(
      (a: any) => a.type === type && !a.isUltimate
    );
    if (!ability) return null;
    return getAbilityIconUrl(ability.name);
  } catch {
    return null;
  }
}

function AbilityIconImage({
  type,
  agentId,
  size = 28,
}: {
  type: UtilityType;
  agentId: string;
  size?: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = getIconForUtility(type, agentId);
    if (!url) {
      setError(true);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setImg(image);
    };
    image.onerror = () => {
      if (!cancelled) setError(true);
    };
    image.src = url;
    return () => { cancelled = true; };
  }, [type, agentId]);

  if (error || !img) {
    const fallbacks: Record<UtilityType, string> = {
      smoke: "S", flash: "F", mollie: "M", dart: "D", dash: ">",
      concussion: "C", decoy: "D", gravity_well: "G", nanoswarm: "N",
      tripwire: "W", trap: "T", heal: "+", revive: "R", wall: "W",
      turret: "T", sensor: "S", alarm: "!",
    };
    return (
      <span style={{ fontSize: size * 0.5, lineHeight: 1, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.4)" }}>{fallbacks[type] || "?"}</span>
    );
  }

  return (
    <img
      src={img.src}
      alt={type}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

export default function UtilityToolbar({
  availableUtility,
  usedUtility,
  selectedUtility,
  onSelectUtility,
}: UtilityToolbarProps) {
  const utilityGroups = availableUtility.reduce(
    (acc, util) => {
      const key = `${util.type}:${util.agentId}`;
      if (!acc[key]) {
        acc[key] = {
          type: util.type as UtilityType,
          agentId: util.agentId,
          totalCharges: 0,
          abilityName: "",
        };
      }
      acc[key].totalCharges += util.charges;
      try {
        const { ALL_AGENTS } = require("@shared/agentAbilities");
        const agent = ALL_AGENTS.find((a: any) => a.id === util.agentId);
        if (agent) {
          const ability = agent.abilities.find(
            (a: any) => a.type === util.type && !a.isUltimate
          );
          if (ability) acc[key].abilityName = ability.name;
        }
      } catch { }
      return acc;
    },
    {} as Record<string, { type: UtilityType; agentId: string; totalCharges: number; abilityName: string }>
  );

  const utilities = Object.entries(utilityGroups).map(([key, data]) => {
    const used = usedUtility[key] || 0;
    return {
      ...data,
      key,
      remaining: Math.max(0, data.totalCharges - used),
      isExhausted: data.totalCharges - used <= 0,
    };
  });

  if (utilities.length === 0) {
    return <p className="text-text-muted text-xs font-mono">No utility available</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {utilities.map((util) => {
          const isSelected =
            selectedUtility?.type === util.type &&
            selectedUtility.agentId === util.agentId;
          const borderClass = UTILITY_BORDER_COLORS[util.type] || "border-border-10";
          const textClass = UTILITY_TEXT_COLORS[util.type] || "text-text-muted";

          return (
            <div key={util.key} className="relative group">
              <button
                onClick={() => {
                  if (!util.isExhausted) {
                    onSelectUtility(util.type, util.agentId);
                  }
                }}
                disabled={util.isExhausted}
                className={`
                  w-14 h-14 border flex items-center justify-center
                  transition-all touch-manipulation relative overflow-hidden
                  ${borderClass}
                  ${util.isExhausted
                    ? "opacity-20 cursor-not-allowed"
                    : isSelected
                      ? "ring-1 ring-cyan/40 bg-cyan-dim scale-105"
                      : "hover:border-border-12 active:scale-95"
                  }
                `}
                style={{ borderRadius: 4 }}
                title={util.abilityName || util.type}
              >
                {/* Real ability icon */}
                <AbilityIconImage type={util.type} agentId={util.agentId} size={32} />

                {/* Charge count badge */}
                <span className={`absolute bottom-0.5 right-0.5 bg-void/90 text-[8px] font-mono px-1 text-text-muted`} style={{ borderRadius: 2 }}>
                  {util.remaining}
                </span>
              </button>
              {/* Agent badge */}
              <span className="absolute -top-1 -left-1 bg-void text-[8px] w-4 h-4 flex items-center justify-center border border-border-08 font-mono font-bold text-text-muted" style={{ borderRadius: 2 }}>
                {util.agentId[0]?.toUpperCase()}
              </span>

              {/* Tooltip on hover */}
              {util.abilityName && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-pure-black border border-border-10 text-[10px] text-text-primary font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20" style={{ borderRadius: 4, letterSpacing: "0.3px" }}>
                  {util.abilityName}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedUtility && (
        <p className="text-xs text-text-muted font-mono" style={{ letterSpacing: "0.3px" }}>
          SELECTED: <span className="text-text-primary">{selectedUtility.type.toUpperCase()}</span> — TAP MAP TO PLACE
        </p>
      )}
    </div>
  );
}
