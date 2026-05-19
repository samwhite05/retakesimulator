# AGENTS.md — Retake Roulette

> This file is written for AI coding agents. It describes the project architecture, conventions, and workflows so you can be productive without guessing.

---

## Project Overview

**Retake Roulette** is a daily Valorant tactical puzzle game. Players act as the IGL (in-game leader): they plan agent positions, utility placement, and movement paths for a retake scenario, submit the plan, then watch a cinematic turn-based simulation play out. Results are scored, tiered, and ranked against the community.

The app is a single Next.js 16 deployable (no separate backend server). It was rebuilt from scratch to replace an older Express+Next.js dual-stack codebase with a unified tactical simulation engine and a React-Konva canvas frontend.

---

## Technology Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.2.3 (App Router) |
| Language | TypeScript 5 (strict mode) |
| React | 19.2.4 |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"` + `@theme` in `globals.css`) |
| Canvas | React-Konva + Konva |
| State | Zustand (client), persisted to `localStorage` |
| Database | Prisma ORM + SQLite (`prisma/dev.db`) |
| Fonts | Inter (sans), JetBrains Mono (mono) via `next/font/google` |
| Package Manager | npm |

---

## Build & Development Commands

```bash
# Install dependencies and generate Prisma client
npm install

# Development server (localhost)
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint
npm run lint

# Database migrations
npx prisma migrate dev
npx prisma migrate deploy

# Seed scenarios into DB
npx prisma db seed
```

- `postinstall` automatically runs `prisma generate`.
- The dev server binds to `localhost` (`-H localhost`).
- There is **no test suite** in the project at this time.

---

## Project Structure

```
src/
  app/                 # Next.js App Router
    page.tsx           # Landing page (Server Component, async)
    planning/          # Tactical planning page (Client Component)
    results/           # Cinematic results page (Client Component)
    scenario-editor/   # Grid/minimap editor (gated by env var)
    mockup/            # UI mockup page
    rebrand/           # Rebrand exploration page
    api/
      scenarios/today/route.ts   # GET today's scenario + play limit status
      plans/route.ts             # POST commit a plan
      runs/route.ts              # POST start an interactive run
      runs/[id]/decide/route.ts  # POST resume run with a decision choice
      scenarios/save-author/route.ts  # Save scenario author data

  components/
    animation/         # CinematicPlayer, InteractiveCinematicPlayer, DecisionOverlay, UtilityFx
    canvas/            # TacticalMap, UtilityGlyph
    landing/           # CountdownBadge, DailyStats
    planning/          # AgentRail, BriefingRail, UtilityBay, PlanningTopBar, HelpModal, etc.
    results/           # GradeCardDownload

  engine/simulation/   # Core tactical engine
    runner.ts          # Turn-based sim runner (setup → utility → movement → combat → spike)
    grid.ts            # BFS pathfinding, tile utilities
    vision.ts          # Raycasted LOS
    abilities.ts       # Utility resolution (smokes, flashes, mollies, etc.)
    combat.ts          # Duel resolution with advantage modifiers
    exposure.ts        # Path exposure calculation
    rng.ts             # Deterministic RNG from seed
    simState.ts        # Simulation state types and serialization
    decisions/         # Emergent decision system
      detectors.ts     # Detect decision triggers during simulation
      catalog.ts       # Choice definitions and effect application
      grading.ts       # Grade decisions retrospectively

  lib/                 # Utilities and domain helpers
    db.ts              # PrismaClient singleton with SQLite path normalization
    crypto.ts          # User hash from IP + user-agent
    scenarios.ts       # Scenario registry and daily rotation
    scenarioGrid.ts    # Grid resolution from minimap image or authoritative grid
    planValidation.ts  # Client/server plan completeness checks
    playLimits.ts      # Daily play cap enforcement logic
    constants.ts       # Agent roster, ability defs, movement budgets, damage tables
    urlUtf8Payload.ts  # URL encoding for plan sharing

  scenarios/           # Scenario definitions
    ascent-b-3v2.ts    # Current live scenario
    ascent-b-3v2-author.json

  store/
    planStore.ts       # Zustand store for plan editing (undo/redo, localStorage persist)

  types/
    index.ts           # Shared TypeScript types (Scenario, PlayerPlan, SimulationLog, etc.)

prisma/
  schema.prisma        # SQLite schema: Scenario, Plan, Run
  seed.ts              # Seeds scenarios into the DB
  migrations/          # Prisma migrations
```

---

## Code Style Guidelines

- **Path alias**: use `@/*` for imports from `src/`.
- **File naming**:
  - Components: `PascalCase.tsx`
  - Utilities / engine files: `camelCase.ts`
  - API routes: Next.js convention `route.ts` inside descriptive folders
- **Types**: strict TypeScript is enabled. Prefer explicit return types on public engine functions.
- **Comments**: JSDoc-style block comments are used for non-obvious engine behavior and design rationale.
- **Tailwind v4**: colors and fonts are defined in `src/app/globals.css` via `@theme`. Do not use a separate `tailwind.config.js`.
- **Dark theme only**: the app uses a warm-charcoal palette (`#0b0d11` background, `#e9e4d6` text) with Valorant-red (`#ff4655`) and amber (`#f5b13c`) accents.

---

## Runtime Architecture

### Pages
- `/` — Landing (Server Component). Fetches today's scenario from `src/lib/scenarios.ts`, checks the user's daily play limit via Prisma, and renders stats.
- `/planning` — Planning (Client Component). Players place agents, draw paths, add hold waypoints, and draft utility. State is managed by Zustand (`planStore.ts`) and synced to the URL for sharing.
- `/results` — Results (Client Component). Plays the cinematic simulation log, shows score, tier, rank, and decision grades.
- `/scenario-editor` — Grid/minimap editor. Gated by `SCENARIO_EDITOR_ACCESS_TOKEN`; returns 404 if not enabled.

### API Flow
1. `GET /api/scenarios/today` — returns the scenario + `playsRemaining`.
2. `POST /api/plans` — validates and persists the player's plan, enforces the daily 1-play cap.
3. `POST /api/runs` — starts an interactive run: seeds the sim, runs until the first emergent decision (or end of round), and returns a `runId` + segment + optional `pendingDecision`.
4. `POST /api/runs/[id]/decide` — resumes the run with a chosen decision, runs to the next decision or finalization.

### Simulation Engine
The engine runs in deterministic phases on the server:
1. **setup** — spawn agents.
2. **utility** — resolve planned utility placements in order.
3. **movement** — move agents along their planned paths (sorted by path length); high-exposure paths can cause mid-movement deaths.
4. **combat** — turn-based duels (attackers by role priority, then unengaged defenders return fire); the spike timer burns 5 seconds per combat substep.
5. **spike** — resolve defuse or explosion based on survivors and site control.

Emergent **decision points** pause the cinematic mid-run (e.g., "first contact", "ally down", "utility window", "spike threshold", "recon info", "low hp duel"). The player's choice is graded retrospectively and contributes to the final score.

### State Management
- **Plan editing**: Zustand (`usePlanStore`) with undo/redo (40-step limit) and `localStorage` persistence key `retake-plan-draft-v4`.
- **Plan sharing**: encoded as a compressed URL query param via `lib/urlUtf8Payload.ts`.
- **Run state**: persisted in the DB (`Run` model) with a 10-minute TTL.

---

## Daily Play Limits

- Production enforces **1 official run per day per user**.
- User identity is a hash of `x-forwarded-for` + `user-agent` (see `src/lib/crypto.ts`).
- Limits are **disabled in dev** (`next dev`) unless `DISABLE_DAILY_PLAY_LIMIT=false` is explicitly set.
- After the daily official run is used, the UI switches to "scrim mode" (unlimited practice).

---

## Database

Prisma schema defines three models:
- `Scenario` — scenario metadata + JSON config.
- `Plan` — committed player plan, final score, tier, and outcome JSON.
- `Run` — ephemeral interactive run state (sim state, history, pending decision, final log).

SQLite path handling is normalized in `src/lib/db.ts` so the Prisma CLI and Next.js runtime agree on the same file regardless of `process.cwd()`.

---

## Deployment

A `render.yaml` blueprint is included for Render.com:
- Build: `npm ci && npm run build`
- Start: `npm run start`
- Default DB: `file:./prisma/dev.db` (SQLite). The blueprint notes that Postgres can be swapped later.

---

## Security Considerations

- There are **no admin routes** in production.
- Play limiting happens server-side; never trust the client for cap enforcement.
- The scenario editor is gated by an env token (`SCENARIO_EDITOR_ACCESS_TOKEN`) and returns 404 when disabled.

---

## Notes for Agents

- **No tests exist** — verify behavior manually via the dev server or by reading engine code carefully.
- The tactical map uses **React-Konva**; visual changes to the canvas should be made in `src/components/canvas/TacticalMap.tsx` or `UtilityGlyph.tsx`.
- The **engine is deterministic**; if you change combat, movement, or ability logic, you may alter existing scenario balance.
- When adding a new scenario, you must:
  1. Define it in `src/scenarios/`.
  2. Export and register it in `src/lib/scenarios.ts` (`ALL_SCENARIOS`).
  3. Run `npx prisma db seed` (or let the app seed it).
- Legacy two-wave plan fields (`entryMovementPaths`, `repositionMovementPaths`) are still read by `normalizePlayerPlan` for backward compatibility, but the UI is now single-stage planning.
