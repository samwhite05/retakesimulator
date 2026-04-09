# Retake Roulette — Handover Document

**Last Updated:** April 9, 2026
**Commit:** `e014dac` (main)
**Status:** Phase 1 complete, Phase 2 in progress

---

## 📊 Current Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ✅ Complete | 100% |
| Phase 2: Animation Rendering | 🚧 In Progress | 40% |
| Phase 3: Polish & Launch | ⏳ Not Started | 0% |

**Servers:** Frontend on `localhost:3000`, Backend on `localhost:4000`
**Database:** PostgreSQL (`retake_roulette`) — tables auto-created on startup
**Assets:** 22 agent icons + 119 ability icons in `.webp` format, served from `frontend/public/assets/`

---

## ✅ What's Built & Working

### Core Game Loop
- [x] Landing page → loads today's scenario
- [x] Planning phase → 16×16 tile grid minimap with agent positioning
- [x] Rule-based evaluation engine → scores plans, generates outcomes
- [x] Animation event generator → converts plan + outcome → event timeline
- [x] Results page → score breakdown, highlights, mistakes
- [x] Daily scenario rotation → one scenario per day, auto-seeded

### Tile Grid System (New)
- [x] 16×16 tactical grid overlay on minimap
- [x] Tile types: walkable, wall, chokepoint, cover, exposed, high_ground, spike_zone
- [x] Chess-style movement: role-based limits (Duelist=4, Controller=3, Sentinel=2)
- [x] Movement cost system: chokepoint=2×, exposed=1.5×, cover=0.5×
- [x] BFS pathfinding for reachable tiles
- [x] Ascent + Haven grid definitions with realistic wall/chokepoint placement

### Utility Coverage Visualization (New)
- [x] Each utility renders its actual shape on the grid
- [x] Smoke = circle (agent-specific size: Brim 3.5, Omen 3.0, Astra 3.2)
- [x] Flash = directional cone, Mollie = damage circle, Dart = reveal circle
- [x] Breach stun = rectangle, Wall = line, Turret = detection circle
- [x] Semi-transparent tile overlays show coverage areas

### Planning UX (Redesigned)
- [x] Character-grouped sidebar with collapsible ability cards
- [x] Real ability icons loaded from `.webp` assets
- [x] Dot-based charge counters (●●○ = 2/3 used)
- [x] Drag-to-move agents on minimap (snaps to tile centers)
- [x] Active tool indicator bar above minimap
- [x] Movement range highlighting (green tiles = reachable)

### Admin Scenario Creator (Complete Overhaul)
- [x] Interactive minimap canvas with tile grid overlay
- [x] Agent grid picker (22 agents with face icons, no dropdown)
- [x] Per-agent utility preview with real icons and charge counts
- [x] Attacker spawn placement tool (P1, P2, P3 positions)
- [x] Defender/hidden enemy placement with agent selector
- [x] JSON preview, copy to clipboard, save to database
- [x] Saved scenarios list (localStorage + DB)

### Backend API
- [x] `/api/scenarios/today` — Get today's scenario
- [x] `/api/plans` — Submit plan, get scored outcome
- [x] `/api/plans/community/:id` — Get top community plans
- [x] `/api/votes` — Vote on community plans
- [x] `/api/ads/check` + `/api/ads/complete` — Rewarded ad tracking
- [x] `/api/admin/scenarios` — CRUD for scenario management

### Data Layer
- [x] 22 agents with correct Valorant abilities (C/Q/E/X slots)
- [x] 119 ability icons mapped to actual `.webp` files
- [x] Position pools for Ascent (A/B) and Haven (A/B/C) with retakeSpawns
- [x] Line-of-sight raycasting engine (pixel-sampling on minimap images)

### Visual Design
- [x] Valorant-themed UI (red/navy palette, Oswald headings, glow effects)
- [x] Circular agent face crops (no glow, clean borders)
- [x] Tile grid overlay with terrain color coding
- [x] Responsive layout (desktop sidebar → mobile bottom sheet)

---

## 🚧 What's Next (Phase 2 Priorities)

### 1. Konva Animation Renderer (Highest Priority)
**Status:** Engine exists, renderer not built
**What:** Turn the `AnimationEvent[]` timeline into a visual cinematic playback on the minimap.
**Details:**
- The backend already generates event timelines (spawn → utility → push → resolution)
- Need a `AnimationPlayer.tsx` component that reads events and renders them frame-by-frame
- Each event type needs a visual: smoke expanding, flash detonating, agents moving along paths, kills happening
- Should play automatically after plan submission, with speed controls (1×, 2×, skip)
- **Estimated effort:** 2-3 days

### 2. Real Agent/Ability Icons in UI
**Status:** Assets exist, partially wired
**What:** Wire the 119 ability `.webp` icons into every place they're used (toolbar, results, admin preview).
**Details:**
- `UtilityToolbar` loads ability icons but falls back to emoji if image fails
- Results page should show icons for highlights/mistakes
- Admin preview should show actual icons instead of text names
- **Estimated effort:** 1 day

### 3. Mobile Optimization
**Status:** Basic responsive layout exists
**What:** Full mobile-first polish for the planning experience.
**Details:**
- Bottom sheet pattern for sidebar on mobile (swipe up/down)
- Larger touch targets for tile selection (min 44px)
- Pinch-to-zoom on minimap for precision placement
- Haptic feedback on utility placement
- Simplified toolbar (horizontal scroll with snap)
- **Estimated effort:** 2-3 days

### 4. Ad Integration
**Status:** API endpoints exist, frontend not wired
**What:** Google AdSense rewarded video ads for extra plays.
**Details:**
- Frontend `<RewardedAd>` component with loading/error states
- Ad gate: "1 play used. Watch a 30s ad for +1 play?"
- Callback to `/api/ads/complete` on ad completion
- Rate limit: max 3 extra plays/day
- Revenue tracking in `plays` table
- **Estimated effort:** 2 days

### 5. Community Plans & Voting
**Status:** API endpoints exist, UI not built
**What:** See how other players solved the same scenario.
**Details:**
- "Community Solutions" tab on results page
- Grid of top plans (score + votes), tap to view plan overlay on minimap
- Upvote/downvote with anonymous user hash
- "Most Popular" vs "Highest Score" sorting
- **Estimated effort:** 2-3 days

### 6. Share/Screenshot Feature
**Status:** Basic text share exists
**What:** Generate shareable images of plans + results.
**Details:**
- `html2canvas` or `dom-to-image` to capture minimap + overlay
- Generate image with score badge, plan overlay, community rank
- Pre-formatted for Twitter/X and Instagram Stories
- Download or copy to clipboard
- **Estimated effort:** 1-2 days

### 7. More Scenarios (3-5 total)
**Status:** 1 scenario (Ascent B 3v2)
**What:** Build varied scenarios across maps and difficulty.
**Details:**
- Ascent A-site 3v2 (different angles, Tower/Heaven positions)
- Haven C-site 2v3 (harder, fewer attackers)
- Haven B-site 4v2 (easier, more attackers)
- Ascent B-site 3v3 (balanced, hidden enemies)
- Use admin creator to build, test, and save each one
- **Estimated effort:** 1 day per scenario

---

## 🔧 How to Run

### Development
```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
npm install  # root (concurrently)

# Start both servers
npm run dev

# Or individually
npm run dev:frontend  # http://localhost:3000
npm run dev:backend   # http://localhost:4000
```

### Database
```bash
# Create database (first time only)
createdb retake_roulette

# Tables auto-create on backend startup
# Scenarios auto-seed on startup
```

### Production Build
```bash
npm run build          # Builds frontend + backend
npm run build:frontend # Next.js production build
npm run build:backend  # TypeScript compilation
npm start              # Start backend (frontend → Vercel)
```

### Environment Variables
```
# backend/.env
PORT=4000
DATABASE_URL=postgresql://localhost:5432/retake_roulette
FRONTEND_URL=http://localhost:3000

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 📁 Key File Reference

| File | Purpose |
|------|---------|
| `shared/types.ts` | All TypeScript interfaces (Scenario, PlayerPlan, Outcome, etc.) |
| `shared/agentAbilities.ts` | 22 agents with correct abilities (C/Q/E/X) |
| `shared/assets.ts` | Agent + ability icon file mapping |
| `shared/positionPools.ts` | Defender positions + retakeSpawns per site |
| `shared/tileGrid.ts` | Tile engine, utility coverage shapes, movement rules |
| `shared/mapGrids.ts` | Ascent + Haven 16×16 grid definitions |
| `backend/src/engine/ruleEngine.ts` | Rule evaluation + scoring logic |
| `backend/src/engine/animationGenerator.ts` | Plan → AnimationEvent[] timeline |
| `backend/src/engine/lineOfSight.ts` | Raycasting on minimap pixels |
| `backend/src/scenarios/ascent-b-3v2.ts` | First scenario definition |
| `frontend/src/components/canvas/MinimapCanvas.tsx` | Main minimap + tile grid + agent rendering |
| `frontend/src/components/canvas/UtilityToolbar.tsx` | Ability toolbar with real icons |
| `frontend/src/app/planning/page.tsx` | Planning page (redesigned sidebar) |
| `frontend/src/app/admin/create/page.tsx` | Admin scenario creator |
| `frontend/src/app/results/page.tsx` | Results + score breakdown |

---

## 🎯 Architecture Decisions

### Why tile grid instead of free-form movement?
Chess-style movement adds strategic depth. Players must think about range, chokepoints, and exposure instead of just dragging anywhere. It makes the puzzle feel like a tactical board game rather than a drawing tool.

### Why utility coverage shapes?
A dot for a smoke is useless. Players need to see the actual area affected. Circles for smokes/darts, cones for flashes, rectangles for wall-bang stuns — this makes the planning phase actually informative.

### Why pre-scripted animation engine instead of simulation?
Dynamic simulation produces weird edge cases. Pre-scripted events triggered by rule outcomes gives controlled, cinematic moments while still feeling responsive to the player's choices.

### Why anonymous users?
No signup friction for a daily puzzle. Browser fingerprint = anonymous ID. Accounts can be added later for streaks/stats if engagement proves the concept.

---

## ⚠️ Known Issues & TODOs

| Priority | Issue | Details |
|----------|-------|---------|
| 🔴 High | Animation renderer not built | `AnimationPlayer.tsx` component needed |
| 🔴 High | Ad integration not wired | `RewardedAd` component needed |
| 🟡 Medium | Mobile UX rough | Bottom sheet, pinch-to-zoom, haptics |
| 🟡 Medium | Community voting UI not built | Results page needs community tab |
| 🟡 Medium | Share image generation | `html2canvas` integration needed |
| 🟢 Low | Only 1 scenario built | Need 3-5 more for variety |
| 🟢 Low | Waylay/Iso/Clove agent icons missing | Some newer agents lack `.webp` assets |
| 🟢 Low | Viper's Pit icon filename mismatch | Should be `Vipers_Pit.webp` (verify) |
| 🟢 Low | Tile grid toggle not in UI | Add grid on/off toggle in planning page |

---

## 📝 Notes for Next Developer

### Adding a New Agent
1. Add to `ALL_AGENTS` in `shared/agentAbilities.ts` with 4 abilities
2. Add icon mapping in `shared/assets.ts` (`AGENT_ICONS`)
3. Drop `.webp` icon into `assets/agents/` and `frontend/public/assets/agents/`
4. Add ability icon mapping in `ABILITY_ICONS`
5. Drop ability `.webp` into `assets/utility/` and `frontend/public/assets/utility/`

### Adding a New Map
1. Define 16×16 grid in `shared/mapGrids.ts` (`buildXxxGrid()`)
2. Define position pools in `shared/positionPools.ts` (`XXX_POSITIONS`)
3. Drop minimap `.png` into `assets/minimaps/` and `frontend/public/assets/minimaps/`
4. Add to `ALL_MAP_POSITIONS` and `ALL_GRIDS` registries

### Adding a New Scenario
1. Use admin creator at `/admin/create` (easiest)
2. Or define manually in `backend/src/scenarios/` following `ascent-b-3v2.ts` pattern
3. Set `releaseDate` to schedule when it goes live
4. Scenario auto-seeds into DB on backend startup

### Testing the Rule Engine
```bash
# Submit a test plan via API
curl -X POST http://localhost:4000/api/plans \
  -H "Content-Type: application/json" \
  -H "X-User-Hash: test-user" \
  -d '{"plan":{"scenarioId":"ascent-b-3v2-001","agentSelection":["sova","omen","jett"],"agentPositions":[...],"utilityPlacements":[...],"movementArrows":[...],"createdAt":"2026-04-09T13:00:00Z"}}'
```

### Database Schema
```sql
scenarios   (id, config JSONB, rules JSONB, release_date, created_at)
plans       (id, scenario_id, user_hash, plan_data JSONB, score, tier, outcome JSONB, created_at)
votes       (id, plan_id, user_hash, direction ±1, created_at)
plays       (id, user_hash, date, count, ad_granted, ad_watched, ad_revenue, created_at)
```

---

## 🚀 Deployment Checklist

- [ ] Frontend → Vercel (auto-deploy from `main`)
- [ ] Backend → Render/Railway (Node.js service)
- [ ] PostgreSQL → Managed database (Render/Railway/Supabase)
- [ ] Redis → Managed cache (optional, for vote counts)
- [ ] Google AdSense → Rewarded ad unit configured
- [ ] Environment variables set on all platforms
- [ ] Custom domain configured
- [ ] SSL/HTTPS enabled
- [ ] Analytics (PostHog/Plausible) configured
- [ ] Error tracking (Sentry) configured
- [ ] Backup strategy for database
- [ ] Monitoring/alerts set up

---

## 💰 Monetization Notes

- **Rewarded ads:** $0.01-$0.05 per completed ad (varies by region)
- **Expected usage:** 1 free play + ~1.5 ad plays per user/day
- **Revenue estimate:** At 1,000 DAU → ~$15-$75/day ($450-$2,250/month)
- **Future:** Optional premium tier ($3/month) for unlimited plays, no ads, early access to scenarios

---

**Next action:** Build the Konva animation renderer (`AnimationPlayer.tsx`). This is the missing piece that makes the game feel complete — without it, players plan but never see the cinematic payoff.
