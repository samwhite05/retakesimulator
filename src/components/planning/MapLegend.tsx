"use client";

interface LegendItem {
  color: string;
  label: string;
  dashed?: boolean;
}

const ITEMS: LegendItem[] = [
  { color: "var(--color-teal)", label: "Safe segment" },
  { color: "var(--color-amber)", label: "Trade segment" },
  { color: "var(--color-valorant-red)", label: "Open / sightline" },
  { color: "var(--color-amber)", label: "Hold waypoint", dashed: true },
  { color: "var(--color-violet)", label: "Smokes" },
];

export default function MapLegend() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border-08 bg-pure-black/80 px-3 py-2 text-[10px] uppercase tracking-wider text-ink-dim backdrop-blur-md">
      <div className="mb-1 text-[9px] font-semibold tracking-[0.2em] text-ink-mute">Legend</div>
      <div className="space-y-1">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-5"
              style={{
                background: item.dashed
                  ? `repeating-linear-gradient(90deg, ${item.color} 0 3px, transparent 3px 6px)`
                  : item.color,
              }}
            />
            <span className="text-ink-dim">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
