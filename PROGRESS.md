# Retake Roulette — Rebuild Progress

## Overview
Complete ground-up rebuild of Retake Roulette. The old codebase (Next.js frontend + Express backend, "dot-in-circle" rule engine, empty animation folder) was deleted and replaced with a single Next.js 15 app using a real tactical simulation engine and cinematic playback.

---

## Completed

### Architecture
- [x] Deleted old `frontend/`, `backend/`, `shared/` directories
- [x] Initialized new Next.js 15 + TypeScript + Tailwind CSS 4 project
- [x] Set up Prisma ORM with SQLite database
- [x] Consolidated to single deployable app (no separate Express backend)
- [x] Removed CORS complexity and dual-deployment surface

### Data & Types
- [x] Defined comprehensive TypeScript types (`Scenario`, `PlayerPlan`, `SimulationLog`, `GameEvent`, etc.)
- [x] Built agent roster with 23 agents and proper ability mappings
- [x] Created Ascent B-site 3v2 scenario with 16×16 tile grid
- [x] Implemented tile types: `walkable`, `wall`, `chokepoint`, `cover`, `exposed`, `high_ground`, `spike_zone`

### Simulation Engine
- [x] **Grid system** with BFS pathfinding and role-based movement costs
- [x] **Vision system** with raycasted LOS blocked by walls, smokes, and raised walls
- [x] **Ability effects** properly modeled:
  - `smoke` — blocks LOS in radius
  - `flash` — travels and detonates in cone, blinds enemies
  - `mollie` / `nanoswarm` — denies area, deals damage on entry
  - `dart` — reveals enemies in radius at endpoint
  - `dash` — extended movement (6 tiles), ignores choke penalties
  - `wall` — blocks movement and LOS
  - `trap` — invisible until triggered, deals 80 damage
  - `heal` / `concussion` — support effects
- [x] **Combat resolution** with tactical variance:
  - Advantage modifiers: cover, high ground, flashes, hidden angles, numerical advantage
  - Win chance clamped 10%-90%, randomized duel outcome
  - Damage ranges per weapon type
- [x] **Turn-based runner**: Setup → Utility → Movement → Combat → Spike
- [x] **Scoring system**: spike defuse, casualties, defender clears, utility efficiency

### Frontend — Canvas
- [x] Built `TacticalMap` with React-Konva
- [x] Responsive canvas (fills container, maintains aspect ratio — not forced square)
- [x] Grid overlay shown by default with A-P / 1-16 coordinate labels
- [x] Color-coded tiles: walls (dark), chokepoints (orange), cover (green), exposed (red tint), spike zone (red)
- [x] Agent tokens with agent icon clipping and team colors (attackers green, defenders red)
- [x] Reachable tile highlighting in cyan during movement mode
- [x] Utility placement rendering (smoke circles, flash cones, mollie zones, dart paths)
- [x] Movement path rendering as dashed cyan lines

### Frontend — Planning UI
- [x] Agent sidebar with agent cards, role info, and movement range
- [x] Ability buttons with charge counters and selection states
- [x] "Set movement path" mode with tile-click destination assignment
- [x] Active tool indicator overlay on canvas
- [x] Clear plan and Execute Plan buttons
- [x] Plan state syncs to URL for sharing

### Frontend — Animation
- [x] Built `CinematicPlayer` that plays the `SimulationLog`
- [x] Phase banners ("UTILITY PHASE", "MOVEMENT PHASE", etc.)
- [x] Agent spawn, move, and dash animations
- [x] Smoke expand, flash detonate, wall raise effects
- [x] Damage number popups and death markers
- [x] Auto-plays on results page with replay button
- [x] Score reveal screen after cinematic completes

### Frontend — Pages
- [x] **Landing page (`/`)**: shows today's scenario, play button, countdown to next puzzle
- [x] **Planning page (`/planning`)**: tactical map + agent panel
- [x] **Results page (`/results`)**: cinematic, score, tier, breakdown, highlights, mistakes, community rank

### Backend — API Routes
- [x] `GET /api/scenarios/today` — returns today's scenario with play limit status
- [x] `POST /api/plans` — validates plan, runs simulation, saves result, returns outcome + log + rank
- [x] Daily play limit enforced server-side (1 play per day per user)
- [x] User identity derived from IP + user-agent hash server-side
- [x] No unprotected admin routes in production

### State Management
- [x] Zustand store for plan editing state
- [x] `localStorage` persistence for draft plans
- [x] URL encoding for plan sharing

### Build & Deploy
- [x] Clean TypeScript build passes
- [x] Database migrations set up with Prisma
- [x] Scenario seeding script

---

## Known Issues / Polish TODO
- [ ] Sound effects during cinematic playback
- [ ] Mobile touch gestures (pinch-to-zoom on canvas)
- [ ] Screenshot/export feature for plan + result sharing
- [ ] Additional scenarios beyond Ascent B-site
- [ ] Community plan gallery and voting UI
- [ ] Agent icon fallback for missing image files

---

## Key Improvements Over Old Build

| Aspect | Old Build | New Build |
|--------|-----------|-----------|
| Backend architecture | Separate Express app | Next.js API routes only |
| Rule engine | "Dot in circle" geometry | Full turn-based tactical simulation |
| Movement | Freeform arrows, no rules | Grid-based BFS with role-enforced ranges |
| Utility | Generic placement dots | Proper simulation effects (LOS, denial, reveals) |
| Combat | Arbitrary deaths by score tier | Advantage-based duels with variance |
| Animation | Empty folder, no playback | Real Konva cinematic engine |
| State | 10 scattered `useState` hooks | Zustand + URL sync + localStorage |
| Canvas | Forced square, hidden grid | Responsive, grid-first, aspect-ratio aware |
| Security | Unprotected admin routes | No admin routes, server-side limits |
| Sharing | `sessionStorage` only | URL-encoded plans |
