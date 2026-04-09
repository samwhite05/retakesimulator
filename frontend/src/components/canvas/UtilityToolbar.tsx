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

const UTILITY_COLORS: Record<UtilityType, string> = {
  smoke: "bg-blue-400/20 border-blue-400 text-blue-400",
  flash: "bg-yellow-400/20 border-yellow-400 text-yellow-400",
  mollie: "bg-red-500/20 border-red-500 text-red-500",
  dart: "bg-green-400/20 border-green-400 text-green-400",
  dash: "bg-purple-400/20 border-purple-400 text-purple-400",
  concussion: "bg-pink-400/20 border-pink-400 text-pink-400",
  decoy: "bg-indigo-400/20 border-indigo-400 text-indigo-400",
  gravity_well: "bg-orange-400/20 border-orange-400 text-orange-400",
  nanoswarm: "bg-yellow-300/20 border-yellow-300 text-yellow-300",
  tripwire: "bg-cyan-400/20 border-cyan-400 text-cyan-400",
  trap: "bg-gray-400/20 border-gray-400 text-gray-400",
  heal: "bg-emerald-400/20 border-emerald-400 text-emerald-400",
  revive: "bg-green-400/20 border-green-400 text-green-400",
  wall: "bg-violet-400/20 border-violet-400 text-violet-400",
  turret: "bg-amber-400/20 border-amber-400 text-amber-400",
  sensor: "bg-sky-400/20 border-sky-400 text-sky-400",
  alarm: "bg-red-400/20 border-red-400 text-red-400",
};

// Find ability icon URL by type + agent
function getIconForUtility(type: UtilityType, agentId: string): string | null {
  // Import dynamically to find the ability name for this agent+type combo
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
    // Fallback emoji
    const fallbacks: Record<UtilityType, string> = {
      smoke: "💨", flash: "⚡", mollie: "🔥", dart: "🎯", dash: "💨",
      concussion: "💫", decoy: "👻", gravity_well: "🌀", nanoswarm: "🐝",
      tripwire: "⚠️", trap: "🪤", heal: "💚", revive: "⭐", wall: "🧱",
      turret: "🔫", sensor: "📡", alarm: "🚨",
    };
    return (
      <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>{fallbacks[type] || "?"}</span>
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
      // Try to get ability name
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
    return <p className="text-vtext-dim text-xs">No utility available</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {utilities.map((util) => {
          const isSelected =
            selectedUtility?.type === util.type &&
            selectedUtility.agentId === util.agentId;
          const colorClass = UTILITY_COLORS[util.type] || "bg-gray-400/20 border-gray-400 text-gray-400";

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
                  w-14 h-14 rounded-lg border-2 flex items-center justify-center
                  transition-all touch-manipulation relative overflow-hidden
                  ${colorClass}
                  ${util.isExhausted
                    ? "opacity-30 cursor-not-allowed"
                    : isSelected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-vdark scale-105"
                      : "hover:opacity-80 active:scale-95"
                  }
                `}
                title={util.abilityName || util.type}
              >
                {/* Real ability icon */}
                <AbilityIconImage type={util.type} agentId={util.agentId} size={32} />

                {/* Charge count badge */}
                <span className="absolute bottom-0.5 right-0.5 bg-vdark/80 text-[8px] font-mono px-1 rounded text-vtext">
                  {util.remaining}
                </span>
              </button>
              {/* Agent badge */}
              <span className="absolute -top-1 -left-1 bg-vdark text-[8px] w-4 h-4 flex items-center justify-center rounded text-vtext-dim border border-vtext-dim/20 font-bold">
                {util.agentId[0]?.toUpperCase()}
              </span>

              {/* Tooltip on hover */}
              {util.abilityName && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-vdark border border-vtext-dim/20 rounded text-[10px] text-vtext whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  {util.abilityName}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedUtility && (
        <p className="text-xs text-vtext-dim">
          Selected: <span className="text-vtext font-medium">{selectedUtility.type}</span> — Tap minimap to place
        </p>
      )}
    </div>
  );
}
