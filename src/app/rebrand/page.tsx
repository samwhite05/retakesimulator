"use client";

export default function RebrandPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ece8e1] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Rebrand Exploration</h1>
          <p className="text-[#7e7a75] max-w-2xl mx-auto leading-relaxed">
            Four visual directions rooted in what the app actually is: a daily tactical puzzle where you play IGL, draw plans on a minimap, and watch them execute. Each direction pulls from a real-world aesthetic that matches the core fantasy.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Direction 1: The Coach's Whiteboard */}
          <MockupFrame
            title="Direction 1: The Coach's Whiteboard"
            description="The authentic IGL experience. Agents are magnet tokens on a dry-erase board. Paths are marker lines. The UI is sticky notes, clipboards, and coffee rings. Grounded in how real teams actually plan rounds."
          >
            <div
              className="min-h-[460px] relative flex flex-col items-center justify-center px-6 overflow-hidden"
              style={{
                background: "#f4f4f2",
                fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive",
              }}
            >
              {/* Whiteboard grid */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "linear-gradient(#c0c0c0 1px, transparent 1px), linear-gradient(90deg, #c0c0c0 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />

              {/* Coffee stain */}
              <div
                className="absolute top-6 right-8 w-24 h-24 rounded-full opacity-20 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, transparent 45%, #8b7355 48%, transparent 52%, #8b7355 55%, transparent 58%, #8b7355 62%, transparent 65%)",
                  transform: "rotate(15deg)",
                }}
              />

              {/* Marker smudge */}
              <div
                className="absolute bottom-20 left-10 w-32 h-8 bg-blue-400/10 rounded-full blur-md rotate-12 pointer-events-none"
              />

              <div className="relative z-10 text-center max-w-sm">
                {/* Sticky note header */}
                <div
                  className="inline-block px-4 py-3 mb-4 shadow-md rotate-[-1deg]"
                  style={{ background: "#fef3c7" }}
                >
                  <p className="text-stone-700 text-sm font-bold">Today&apos;s Drill</p>
                </div>

                <h1
                  className="text-5xl font-bold text-stone-800 mb-1 tracking-tight"
                  style={{ fontFamily: "'Permanent Marker', cursive" }}
                >
                  Retake
                </h1>
                <p className="text-stone-500 text-sm mb-8 rotate-[0.5deg]">
                  Daily tactical puzzle
                </p>

                {/* Scenario card on graph paper */}
                <div
                  className="p-5 mb-6 shadow-lg rotate-[0.5deg]"
                  style={{
                    background: "#fff",
                    backgroundImage:
                      "linear-gradient(#e5e7eb 1px, transparent 1px)",
                    backgroundSize: "100% 24px",
                    border: "2px solid #d1d5db",
                  }}
                >
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">
                    Scenario
                  </p>
                  <h2 className="text-2xl font-bold text-stone-800 mb-1">B Site Retake</h2>
                  <p className="text-stone-500 text-sm mb-4">Map: Ascent</p>

                  {/* Magnet tokens */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full border-2 border-stone-300 bg-blue-500 shadow-sm flex items-center justify-center text-white text-xs font-bold">S</div>
                    <div className="w-8 h-8 rounded-full border-2 border-stone-300 bg-purple-600 shadow-sm flex items-center justify-center text-white text-xs font-bold">O</div>
                    <div className="w-8 h-8 rounded-full border-2 border-stone-300 bg-cyan-400 shadow-sm flex items-center justify-center text-white text-xs font-bold">J</div>
                  </div>

                  <button
                    className="w-full py-2.5 font-bold text-sm text-white bg-stone-800 shadow-md hover:bg-stone-700 transition-colors"
                    style={{ fontFamily: "'Permanent Marker', cursive" }}
                  >
                    Draw the plan →
                  </button>
                </div>

                {/* Small sticky note */}
                <div
                  className="inline-block px-3 py-2 shadow-sm rotate-[2deg]"
                  style={{ background: "#dbeafe" }}
                >
                  <p className="text-stone-600 text-xs">1 puzzle per day</p>
                </div>
              </div>
            </div>
          </MockupFrame>

          {/* Direction 2: Spectre Interface */}
          <MockupFrame
            title="Direction 2: Spectre Interface"
            description="Directly inspired by Valorant's in-game UI language. Sharp hexagonal motifs, the exact palette of the buy menu and agent select, carbon fiber textures, and military-sci-fi precision. Feels like an extension of the game itself."
          >
            <div
              className="min-h-[460px] relative flex flex-col items-center justify-center px-6 overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, #0f1419 0%, #1a2330 50%, #0f1419 100%)",
                fontFamily: "'Rajdhani', 'Eurostile', ui-sans-serif, system-ui, sans-serif",
              }}
            >
              {/* Carbon fiber texture */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 1px, transparent 6px)",
                }}
              />

              {/* Hex pattern */}
              <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="hex" width="28" height="49" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
                    <path d="M14 0L28 8.5v17L14 34 0 25.5v-17L14 0z" fill="none" stroke="#fff" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#hex)" />
              </svg>

              <div className="relative z-10 text-center max-w-sm">
                {/* Top accent bar */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#ff4655] to-transparent mb-6" />

                <p className="text-[#7e8fa3] text-xs font-bold tracking-[0.3em] uppercase mb-3">
                  Daily Tactical Protocol
                </p>

                <h1 className="text-5xl font-black tracking-tight text-[#ece8e1] mb-1 uppercase">
                  Retake
                </h1>
                <div className="flex items-center justify-center gap-2 mb-8">
                  <div className="h-px w-8 bg-[#ff4655]" />
                  <div className="w-1.5 h-1.5 bg-[#ff4655] rotate-45" />
                  <div className="h-px w-8 bg-[#ff4655]" />
                </div>

                {/* Card with hex corners */}
                <div
                  className="relative p-[1px] mb-6"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.15) 100%)",
                    clipPath:
                      "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                  }}
                >
                  <div
                    className="p-6"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(30,40,55,0.95) 0%, rgba(15,20,25,0.98) 100%)",
                      clipPath:
                        "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                    }}
                  >
                    <p className="text-[#7e8fa3] text-[10px] font-bold tracking-[0.25em] uppercase mb-2">
                      Active Scenario
                    </p>
                    <h2 className="text-2xl font-bold text-[#ece8e1] mb-1 uppercase">
                      B Site Retake
                    </h2>
                    <p className="text-[#7e8fa3] text-sm mb-5">
                      Map: <span className="text-[#b8c4d0]">Ascent</span>
                    </p>

                    {/* Ability charge bars */}
                    <div className="flex items-center justify-center gap-3 mb-5">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded bg-[#1a2330] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">S</div>
                        <div className="flex gap-0.5">
                          <div className="w-2 h-1 bg-[#ff4655]" />
                          <div className="w-2 h-1 bg-[#ff4655]" />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded bg-[#1a2330] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">O</div>
                        <div className="flex gap-0.5">
                          <div className="w-2 h-1 bg-white/20" />
                          <div className="w-2 h-1 bg-[#ff4655]" />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded bg-[#1a2330] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">J</div>
                        <div className="flex gap-0.5">
                          <div className="w-2 h-1 bg-[#ff4655]" />
                          <div className="w-2 h-1 bg-white/20" />
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full py-3 font-bold text-xs tracking-[0.2em] uppercase text-[#0f1419] bg-[#ff4655] hover:bg-[#ff5a67] transition-colors"
                      style={{
                        clipPath:
                          "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                      }}
                    >
                      Initialize Plan
                    </button>
                  </div>
                </div>

                <p className="text-[#5a6a7d] text-xs tracking-wide">
                  ONE PROTOCOL PER DAY • NEXT RESET IN 14H
                </p>
              </div>
            </div>
          </MockupFrame>

          {/* Direction 3: After Action Report */}
          <MockupFrame
            title="Direction 3: After Action Report"
            description="A military debrief/document aesthetic. You aren't just playing a puzzle—you're reviewing classified field reports. Typewriter text, redacted stamps, Polaroid map photos, and casualty ledgers. Tells a story with every scenario."
          >
            <div
              className="min-h-[460px] relative flex flex-col items-center justify-center px-6 overflow-hidden"
              style={{
                background: "#c9c5b8",
                fontFamily: "'Courier New', Courier, monospace",
              }}
            >
              {/* Paper grain */}
              <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
                }}
              />

              {/* Coffee ring */}
              <div
                className="absolute bottom-8 right-10 w-28 h-28 rounded-full pointer-events-none opacity-30"
                style={{
                  border: "2px solid #8b7355",
                  boxShadow: "inset 0 0 10px #8b7355",
                }}
              />

              <div className="relative z-10 text-center max-w-sm">
                {/* Classified stamp */}
                <div className="absolute -top-2 -right-2 rotate-12 border-4 border-[#8b0000] text-[#8b0000] px-3 py-1 font-bold text-sm uppercase tracking-wider opacity-80">
                  Classified
                </div>

                <p className="text-stone-600 text-xs font-bold tracking-[0.2em] uppercase mb-4">
                  Field Report // Daily Intel
                </p>

                <h1 className="text-4xl font-bold text-stone-800 mb-1 tracking-tight">
                  RETAKE
                </h1>
                <div className="h-px w-20 bg-stone-600 mx-auto mb-6" />

                {/* Manila folder card */}
                <div
                  className="p-5 mb-6 text-left shadow-xl relative"
                  style={{
                    background: "#e8e4d9",
                    border: "1px solid #a8a49a",
                  }}
                >
                  {/* Paperclip */}
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-10 border-2 border-stone-400 rounded-full"
                    style={{ background: "transparent" }}
                  />

                  <div className="flex items-start gap-4 mb-4">
                    {/* Polaroid */}
                    <div className="bg-white p-2 pb-4 shadow-md rotate-[-2deg] flex-shrink-0">
                      <div className="w-16 h-16 bg-stone-300 flex items-center justify-center text-[10px] text-stone-500 text-center leading-tight">
                        ASCENT<br />B SITE
                      </div>
                    </div>
                    <div>
                      <p className="text-stone-500 text-xs font-bold uppercase tracking-wider mb-1">
                        Operation
                      </p>
                      <h2 className="text-lg font-bold text-stone-800 mb-0.5">B Site Retake</h2>
                      <p className="text-stone-600 text-xs">Codename: ASCENT</p>
                    </div>
                  </div>

                  <div className="border-t border-stone-400/50 pt-3 mb-4">
                    <p className="text-stone-600 text-xs leading-relaxed">
                      <span className="font-bold">OBJECTIVE:</span> Recover spike site B with 3 agents. Utility allotment: smoke ×1, flash ×2, recon ×1.
                    </p>
                  </div>

                  <button className="w-full py-2 font-bold text-xs tracking-widest uppercase text-[#e8e4d9] bg-[#5c4d3c] hover:bg-[#4a3d30] transition-colors border border-[#3d3328]">
                    Open File
                  </button>
                </div>

                <p className="text-stone-600 text-xs">
                  <span className="font-bold">RESTRICTION:</span> One analysis per 24h cycle.
                </p>
              </div>
            </div>
          </MockupFrame>

          {/* Direction 4: Holographic Command Table */}
          <MockupFrame
            title="Direction 4: Holographic Command Table"
            description="The screen IS the map. All UI elements exist as floating overlays directly on the tactical display. Radars sweep, waypoints pulse, and range rings emanate from agents. No cards or panels—just pure tactical interface."
          >
            <div
              className="min-h-[460px] relative flex flex-col items-center justify-center px-6 overflow-hidden"
              style={{
                background: "#0a0f14",
                fontFamily: "'Orbitron', 'Eurostile', ui-sans-serif, system-ui, sans-serif",
              }}
            >
              {/* The tactical map itself is the background */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at 30% 40%, #1a2a1a 0%, transparent 25%), radial-gradient(circle at 70% 60%, #2a1a1a 0%, transparent 20%), radial-gradient(circle at 50% 50%, #1a1a2a 0%, transparent 30%)",
                }}
              />

              {/* Grid overlay */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Radar sweep */}
              <div
                className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(0,255,136,0.08) 360deg)",
                  animation: "radar 4s linear infinite",
                }}
              />

              {/* Range rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-[#00ff88]/20 pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-[#00ff88]/10 pointer-events-none" />

              <style jsx>{`
                @keyframes radar {
                  from { transform: translate(-50%, -50%) rotate(0deg); }
                  to { transform: translate(-50%, -50%) rotate(360deg); }
                }
              `}</style>

              <div className="relative z-10 text-center max-w-sm">
                {/* Floating holographic title */}
                <div className="mb-8">
                  <h1 className="text-5xl font-black tracking-widest text-[#00ff88] mb-1"
                      style={{ textShadow: "0 0 20px rgba(0,255,136,0.4)" }}>
                    RETAKE
                  </h1>
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-px w-12 bg-[#00ff88]/50" />
                    <p className="text-[#00ff88]/70 text-[10px] tracking-[0.3em] uppercase">
                      Tactical Command
                    </p>
                    <div className="h-px w-12 bg-[#00ff88]/50" />
                  </div>
                </div>

                {/* Scenario as map overlay */}
                <div className="relative mb-6">
                  {/* Waypoint marker */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#ff4655]" />
                    <div className="w-8 h-8 rounded-full border-2 border-[#ff4655] flex items-center justify-center bg-[#ff4655]/10 mt-1">
                      <span className="text-[#ff4655] text-xs font-bold">B</span>
                    </div>
                  </div>

                  <div className="border border-[#00ff88]/30 bg-[#0a0f14]/80 backdrop-blur-sm p-5 pt-8">
                    <p className="text-[#00ff88]/60 text-[10px] tracking-[0.25em] uppercase mb-1">
                      Current Operation
                    </p>
                    <h2 className="text-xl font-bold text-[#ece8e1] mb-1">B Site Retake</h2>
                    <p className="text-[#00ff88]/80 text-sm mb-4">Ascent</p>

                    {/* Agent waypoints */}
                    <div className="flex items-center justify-center gap-6 mb-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
                        <span className="text-[10px] text-[#00ff88]/70">SOVA</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                        <span className="text-[10px] text-[#00ff88]/70">OMEN</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                        <span className="text-[10px] text-[#00ff88]/70">JETT</span>
                      </div>
                    </div>

                    <button className="w-full py-2.5 font-bold text-xs tracking-[0.2em] uppercase text-[#0a0f14] bg-[#00ff88] hover:bg-[#33ff9f] transition-colors shadow-[0_0_20px_rgba(0,255,136,0.3)]">
                      Initialize
                    </button>
                  </div>
                </div>

                {/* Bottom status bar */}
                <div className="flex items-center justify-center gap-8 text-[10px] text-[#00ff88]/50 tracking-wider uppercase">
                  <span>Grid: 48×48</span>
                  <span>Zoom: 1.0×</span>
                  <span>Next: 14h</span>
                </div>
              </div>
            </div>
          </MockupFrame>
        </div>
      </div>
    </main>
  );
}

function MockupFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-[#7e7a75] mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="border border-white/5 rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}
