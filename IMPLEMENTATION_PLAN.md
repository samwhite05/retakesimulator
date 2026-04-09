# Retake Roulette — Implementation Plan

## Overview
**Retake Roulette** is a daily Valorant-themed tactical puzzle mini-game. Players are shown a post-plant scenario on a minimap, draw their retake plan (utility placement, agent positioning, movement paths), then watch a turn-based cinematic animation showing how their plan plays out. One scenario per day — come back tomorrow. Watch a rewarded video ad to earn +1 extra play.

**Tagline:** *"Can you retake better than the community?"*

---

## Core User Flow

```
1. Landing page → Today's scenario (e.g., "Ascent B-Site | 3v2 Post-Plant")
2. Play check → 1 free play/day remaining? → Yes: go to briefing. No: offer "Watch ad for +1 play"
3. Ad flow (if needed) → Rewarded video ad plays → +1 play credited
4. Briefing screen → Shows minimap with spike location, enemy positions, your team
5. Planning phase → Player taps to place utility, drags arrows for agent movement
6. Execute → Rule engine evaluates the plan
7. Cinematic phase → Turn-based animation plays out what the player drew
8. Results screen → Score breakdown, what worked/what failed, community comparison
9. Share → Screenshot of plan + result, shareable image
10. Locked → "New scenario tomorrow" or "Watch ad to play again"
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React + TypeScript) |
| Canvas/Drawing | Konva.js (React-Konva wrapper) |
| Backend | Node.js + Express |
| Database | PostgreSQL (scenarios, plans, votes) |
| Caching | Redis (daily scenario rotation, vote counts, play tracking) |
| Ads | Google AdSense Rewarded Ads (web) or AdMob via webview |
| Hosting | Vercel (frontend) + Render/Railway (backend) |
| Analytics | PostHog or Plausible |

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Frontend (Next.js)          │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │ Minimap  │  │ Results  │  │ Share │  │
│  │ Canvas   │  │ Screen   │  │ Modal │  │
│  └──────────┘  └──────────┘  └───────┘  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Animation Engine (Konva)       │   │
│  │  - Reads plan + outcome objects  │   │
│  │  - Renders turn-based sequence   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Planning Engine                 │   │
│  │  - Tap-to-place utility          │   │
│  │  - Drag arrows for movement      │   │
│  │  - Validate plan completeness    │   │
│  └──────────────────────────────────┘   │
└──────────────────┬──────────────────────┘
                   │ REST API
┌──────────────────┴──────────────────────┐
│              Backend (Express)           │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Scenario API │  │ Community API   │  │
│  │ - Get today  │  │ - Submit plan   │  │
│  │ - Get config │  │ - Vote/rank     │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Rule Engine                     │   │
│  │  - Load scenario rules           │   │
│  │  - Evaluate player plan          │   │
│  │  - Generate outcome object       │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Animation Generator             │   │
│  │  - Takes plan + outcome          │   │
│  │  - Builds animation sequence     │   │
│  │  - Sends to frontend for render  │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Play Tracker                    │   │
│  │  - Track plays per user/day      │   │
│  │  - Ad completion callback        │   │
│  │  - Grant bonus play              │   │
│  └──────────────────────────────────┘   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│           PostgreSQL Database            │
│                                          │
│  - scenarios (id, config, rules, date)   │
│  - plans (id, scenario_id, plan_data,    │
│            score, outcome, created_at)   │
│  - votes (plan_id, direction, user_hash) │
│  - plays (user_hash, date, count,        │
│            ad_granted, ad_watched)       │
└──────────────────────────────────────────┘
```

---

## Data Structures

### Scenario

```typescript
interface Scenario {
  id: string;
  name: string;              // "Ascent B-Site | 3v2 Post-Plant"
  map: string;               // "ascent"
  minimapImage: string;      // URL/path to minimap image

  // The setup
  spikeSite: Position;       // Where the spike is planted
  friendlyAgents: Agent[];   // Your team's starting positions
  enemyAgents: EnemyDef[];   // Known enemy positions (what the player sees)
  hiddenEnemies: EnemyDef[]; // Hidden off-angles (not shown to player)
  availableAgents: string[]; // Which agents the player can pick from
  availableUtility: UtilityDef[]; // What utility they have access to

  // Rule-based evaluation
  rules: Rule[];             // Scoring conditions

  // Animation event definitions
  events: ScenarioEvents;    // What animations can trigger
}
```

### Rule

```typescript
interface Rule {
  id: string;
  description: string;       // "Clear Market angle before pushing"
  category: "critical" | "important" | "minor";
  points: number;            // e.g., 40, 25, 15

  // Evaluation logic — checks the plan object
  evaluate: (plan: PlayerPlan) => {
    passed: boolean;
    detail: string;          // "Mollie placed at Market entrance — angle blocked"
  };
}
```

### PlayerPlan

```typescript
interface PlayerPlan {
  agentSelection: string[];         // Which agents picked (e.g., ["sova", "omen", "jett"])
  agentPositions: Position[];       // Where each agent starts
  utilityPlacements: UtilityItem[]; // Utility placed on minimap (type, position, target)
  movementArrows: Arrow[];          // Drawn movement paths per agent
  smokePlacements: Position[];      // Smoke locations
  flashPaths: LinePath[];           // Flash trajectories
  molliePlacements: Position[];     // Mollie/incendiary spots
  dartPaths: LinePath[];            // Sova/Skye dart paths
}
```

### Outcome (generated by rule engine)

```typescript
interface Outcome {
  score: number;            // 0-100
  scoreBreakdown: RuleResult[];
  tier: "clean" | "messy" | "failed";  // Based on score thresholds

  // Generated events — what happens in the animation
  events: AnimationEvent[]; // e.g., [{type: "kill", victim: "jett", location: treePos}]

  // Text feedback
  summary: string;          // "Messy retake — you got the spike but lost 2 agents"
  highlights: string[];     // ["Sova dart revealed 2 enemies", "Market was well-blocked"]
  mistakes: string[];       // ["Tree angle left unchecked — Omen flanked"]
}
```

### AnimationEvent

```typescript
interface AnimationEvent {
  type: "kill" | "flash" | "mollie_hit" | "smoke_deploy" | "dash" | "reveal" | "defuse" | "spike_explosion";
  actor: string;            // Agent name
  position: Position;       // Where on the minimap
  target?: string;          // Target agent (for kills/flashes)
  delay: number;            // ms from animation start
  duration: number;         // ms this event plays for
}
```

---

## Core Systems

### 1. Minimap Canvas (Planning Phase)

**Features:**
- Displays Valorant minimap as background
- **Tap-to-place utility:** Tap a utility icon from the toolbar → tap on minimap to place it
- **Drag arrows:** Tap an agent token → drag to draw their movement path (creates a curved arrow)
- **Pan/zoom** on minimap for precision
- **Undo/redo** support
- **Clear all** button
- **Submit plan** button (validates plan is complete before enabling)

**Mobile UX:**
- Large tap targets (min 44px)
- Utility toolbar scrolls horizontally
- Bottom sheet for agent selection
- Haptic feedback on place

**Tech:** React-Konva with a background image layer + interactive layers for utility/arrows/tokens

### 2. Rule Evaluation Engine

**How it works:**
1. Player submits `PlayerPlan`
2. Backend loads the scenario's `Rule[]` array
3. Each rule's `evaluate()` function runs against the plan
4. Results are scored, tier determined, events generated

**Example rules for Ascent B-Site 3v2:**

```
Rule: "Market angle must be cleared" (critical, 40pts)
  Pass conditions: utility placed covering Market entrance
                   OR agent positioned to peek Market
                   OR Sova dart path through Market

Rule: "B Main must be blocked" (important, 25pts)
  Pass conditions: mollie placed in B Main
                   OR smoke placed blocking B Main

Rule: "Entry must be flashed" (important, 20pts)
  Pass conditions: flash path overlaps with entry agent's movement arrow

Rule: "Agents should not overextend without support" (minor, 15pts)
  Pass conditions: no agent arrow extends > 60% into site without another agent's arrow nearby
```

**Score thresholds:**
- 80-100 → "Clean retake"
- 50-79 → "Messy but successful"
- 0-49 → "Retake failed"

### 3. Animation Generator

**Takes:** `PlayerPlan` + `Outcome`
**Produces:** `AnimationEvent[]` array (timeline)

**Logic:**
```
For each utility placement in plan:
  → Add utility_deploy event at that position

For each movement arrow in plan:
  → Add dash event following that path

For each FAILED rule:
  → Generate consequence events
    (e.g., "Tree uncleared" → spawn hidden Omen at Tree → kill nearest agent)

For each PASSED rule:
  → Generate success events
    (e.g., "Market cleared" → reveal enemies at Market → enemies scatter)

Calculate deaths based on score tier:
  Clean (80-100): 0-1 agents die
  Messy (50-79): 1-2 agents die
  Failed (0-49): 2-3 agents die

Spike defuse if score ≥ 50
```

**The key insight:** The animation events reference the player's ACTUAL positions, paths, and utility placements. So even though the event TYPES are from a fixed vocabulary, the COMBINATION is unique every time because the input is unique.

### 4. Animation Renderer (Frontend)

**Takes:** `AnimationEvent[]` timeline
**Renders:** Turn-based Konva animation on the minimap

**Sequence:**
1. Turn 1: "Your Setup" — agents appear at plan positions, utility icons glow
2. Turn 2: "Utility Phase" — utility fires/smokes deploy/darts travel (animated)
3. Turn 3: "Push Phase" — agents move along drawn arrows, flashes detonate
4. Turn 4: "Resolution" — kills happen, survivors reach spike, defuse or fail
5. Final: "Result" — score display, highlights/mistakes

**Animation details:**
- Agent tokens slide along paths
- Utility effects have visual animations (expanding circles for mollie, arcs for flashes)
- Kills show X icon + fade
- Camera shakes on explosions
- Sound effects (optional, Valorant-inspired)
- Speed controls: 1x, 2x, skip

### 5. Daily Scenario System

**How it works:**
- Each scenario has a `releaseDate` field
- Backend serves the scenario where `releaseDate === today`
- Redis caches "today's scenario" for fast lookup
- If no scenario for today → fallback to a default

**Future:** Scenarios can be authored via JSON and scheduled in advance. Admin panel for adding new ones.

### 6. Community Plans & Voting

**Anonymous identification:**
- Browser fingerprint (cookie-based hash) = anonymous user ID
- Submit plan → stored in DB with score
- See community's top-voted plans (upvote/downvote)
- Filter by "Highest Score" or "Most Popular"

**Share:**
- Generate a shareable image: minimap + your plan overlay + score badge
- Download or copy to clipboard
- Pre-formatted for Twitter/Instagram stories

### 7. Ad System (Rewarded Video)

**How it works:**
1. User lands on today's scenario → check `plays` table for their `user_hash` + today's date
2. If `count === 0` → free play, proceed to briefing
3. If `count >= 1` → show "No free plays remaining. Watch a 30s ad for +1 play?"
4. User clicks → rewarded video ad plays (Google AdSense)
5. Ad completes → callback hits `/api/ads/complete` → `ad_granted = true`, `count++`
6. User proceeds to briefing
7. If user skips/closes ad → no play granted, back to landing

**Implementation:**
- Google AdSense for web rewarded ads (or AdMob if wrapping in webview later)
- Frontend: `<RewardedAd>` component with loading state, skip detection
- Backend: `/api/plays/check` (GET remaining plays), `/api/ads/complete` (POST ad completion)
- Rate limit: max 3 extra plays/day (prevent ad spam)
- Revenue tracking: store `ad_revenue` per play for analytics

**UX considerations:**
- Ad should never interrupt mid-game — only as a gate BEFORE planning
- Clear messaging: "1 play used today. Watch a short ad to unlock another?"
- Loading state: "Preparing ad…" → "Ad playing…" → "Play unlocked!"
- Fallback: If ad network unavailable → "Ads temporarily unavailable, try again later"

---

## Visual Design (Authentic Valorant Theme)

**Color Palette:**
- Primary: `#FF4655` (Valorant red)
- Background: `#0F1923` (dark navy)
- Surface: `#1A2634` (dark card)
- Text: `#ECE8E1` (warm white)
- Accent: `#1DF5A0` (success green), `#FFB900` (warning amber)
- Utility: `#5BCEFA` (blue), `#FF6B9D` (pink)

**Typography:**
- Headings: `Tungsten` or `Oswald` (bold, condensed — Valorant style)
- Body: `Inter` or `Roboto`
- Numbers: `DIN` style for scores

**UI Elements:**
- Angular/hexagonal card borders (Valorant style)
- Glowing accent lines on hover
- Smooth slide-in animations
- Particle effects on score reveal

---

## File Structure

```
retakesimulator/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── MinimapCanvas.tsx       # Main drawing canvas
│   │   │   │   ├── UtilityToolbar.tsx      # Utility selection bar
│   │   │   │   ├── AgentToken.tsx          # Draggable agent icon
│   │   │   │   ├── ArrowLayer.tsx          # Movement arrow drawing
│   │   │   │   └── UtilityLayer.tsx        # Utility placement layer
│   │   │   ├── animation/
│   │   │   │   ├── AnimationPlayer.tsx     # Orchestrates the cinematic
│   │   │   │   ├── TurnRenderer.tsx        # Renders each turn
│   │   │   │   └── effects/                # Utility/kill/flash effects
│   │   │   ├── results/
│   │   │   │   ├── ScoreBreakdown.tsx      # Rule-by-rule results
│   │   │   │   ├── CommunityPlans.tsx      # Top community plans
│   │   │   │   └── ShareModal.tsx          # Screenshot/share
│   │   │   └── ui/
│   │   │       ├── ValorantCard.tsx        # Themed card component
│   │   │       ├── ScoreBadge.tsx          # Score display
│   │   │       └── Button.tsx              # Themed buttons
│   │   ├── pages/
│   │   │   ├── index.tsx                   # Landing / today's scenario
│   │   │   ├── planning.tsx                # Planning phase
│   │   │   ├── cinematic.tsx               # Animation playback
│   │   │   └── results.tsx                 # Score + community
│   │   ├── engine/
│   │   │   ├── ruleEngine.ts               # Rule evaluation logic
│   │   │   ├── animationGenerator.ts       # Plan → event timeline
│   │   │   └── scenarioLoader.ts           # Loads today's scenario
│   │   ├── hooks/
│   │   │   ├── usePlan.ts                  # Plan state management
│   │   │   └── useScenario.ts              # Scenario data
│   │   └── styles/
│   │       ├── globals.css
│   │       └── valorant-theme.css
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── scenarios.ts                # GET /api/scenarios/today
│   │   │   ├── plans.ts                    # POST /api/plans, GET /api/plans/community
│   │   │   └── votes.ts                    # POST /api/votes
│   │   ├── engine/
│   │   │   ├── ruleEngine.ts               # Server-side rule evaluation
│   │   │   └── animationGenerator.ts       # Generates event timeline
│   │   ├── scenarios/
│   │   │   ├── ascent-b-3v2.ts             # First scenario definition
│   │   │   └── index.ts
│   │   └── index.ts                        # Express app entry
│   └── package.json
│
├── shared/
│   └── types.ts                            # Shared TypeScript types
│
└── assets/
    ├── minimaps/                            # Map images
    ├── agents/                              # Agent icon tokens
    └── utility/                             # Utility icons
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Scaffold Next.js + Express project
- [ ] Set up PostgreSQL + basic migrations
- [ ] Build minimap canvas with tap-to-place utility
- [ ] Build arrow drawing system (drag to create movement paths)
- [ ] Build Valorant-themed UI shell (colors, fonts, cards)
- [ ] Create scenario data structure
- [ ] Author first scenario: Ascent B-Site 3v2

### Phase 2: Rule Engine (Week 2-3)
- [ ] Build rule evaluation engine (server-side)
- [ ] Define 8-10 rules for first scenario
- [ ] Build scoring system + tier determination
- [ ] Test with sample plans (verify edge cases)

### Phase 3: Animation Engine (Week 3-5)
- [ ] Build animation generator (plan + outcome → event timeline)
- [ ] Build animation renderer (Konva turn-based playback)
- [ ] Implement all effect types: utility, kills, flashes, smokes, dashes
- [ ] Add sound effects (Valorant-inspired, not copied)
- [ ] Speed controls + skip button

### Phase 4: Results & Community (Week 5-6)
- [ ] Build results screen with score breakdown
- [ ] Build community plans viewer (upvote/downvote)
- [ ] Build share/screenshot feature
- [ ] Anonymous user identification (browser fingerprint)
- [ ] Build play tracking system (plays table, daily reset)
- [ ] Integrate Google AdSense rewarded ads
- [ ] Build RewardedAd component + ad gate flow

### Phase 5: Daily System & Polish (Week 6-7)
- [ ] Build daily scenario rotation
- [ ] Add 2-3 more scenarios (Ascent A-site, Haven C-site)
- [ ] Mobile optimization (touch targets, responsive layout)
- [ ] Performance optimization (canvas rendering, lazy loading)
- [ ] Analytics setup (PostHog)
- [ ] Deploy to Vercel + Render

### Phase 6: Launch Prep (Week 7-8)
- [ ] Beta testing with friends/community
- [ ] Bug fixes, edge case handling
- [ ] Content creation (5-7 scenarios queued)
- [ ] Social media prep (share images look good)
- [ ] Soft launch → iterate → full launch

---

## Future Enhancements (Post-MVP)
- User accounts (optional) — saved plans, stats, streaks
- More maps/scenarios — community-voted scenario requests
- Difficulty tiers — Iron to Radiant difficulty levels
- Custom scenario builder — users create/share their own puzzles
- Multiplayer — compete on same scenario in real-time
- Leaderboards — weekly/monthly rankings
- Agent-specific challenges — "Only Sova tools allowed"
- Valorant API integration — pull live map/agent data