# Retake Roulette

**A daily Valorant tactical puzzle mini-game.**

One post-plant scenario per day. Draw your retake plan on the minimap — place utility, draw agent movement paths — then execute and watch a unique cinematic show how your plan plays out. Compare your score with the community. Come back tomorrow for a new scenario.

---

## How It Works

1. **Land** → Today's scenario loads (e.g., "Ascent B-Site | 3v2 Post-Plant")
2. **Plan** → Tap to place utility, drag to draw agent movement arrows on the minimap
3. **Execute** → Rule engine evaluates your plan against tactical criteria
4. **Watch** → A unique cinematic animation plays, generated from YOUR actual plan
5. **Results** → Score breakdown, what worked, what failed, community comparison
6. **Share** → Screenshot your plan + result
7. **Locked** → 1 free play/day, watch an ad for +1 extra

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (React + TypeScript) |
| Canvas | Konva.js + React-Konva |
| Styling | Tailwind CSS 4 |
| Backend | Node.js + Express (TypeScript) |
| Database | PostgreSQL |
| Ads | Google AdSense Rewarded (web) |
| Hosting | Vercel (frontend) + Render (backend) |

---

## Deployment

### Deploy to Render (All-in-One)

This project includes a `render.yaml` blueprint for easy deployment:

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New +** → **Blueprint**
4. Connect your repository
5. Render will auto-detect `render.yaml` and create:
   - PostgreSQL database
   - Backend API service
   - Frontend Next.js service

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## Project Structure

```
retakesimulator/
├── frontend/              # Next.js app
│   ├── src/
│   │   ├── app/           # Pages (home, planning, results)
│   │   └── components/    # Canvas, animation, UI components
│   └── ...
├── backend/               # Express API
│   ├── src/
│   │   ├── engine/        # Rule engine + animation generator
│   │   ├── routes/        # API routes
│   │   ├── scenarios/     # Scenario definitions
│   │   └── db.ts          # Database setup
│   └── ...
├── shared/                # Shared TypeScript types
│   └── types.ts
├── assets/                # Minimap images, agent/utility icons
└── IMPLEMENTATION_PLAN.md # Full spec
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- (Optional) Redis for caching

### 1. Clone & Install

```bash
cd retakesimulator
npm install          # Root (concurrently)
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 2. Set up Database

```bash
# Create the database
createdb retake_roulette
```

Update `backend/.env` with your database URL.

### 3. Run

```bash
# Development (both frontend + backend)
npm run dev

# Or individually
npm run dev:frontend   # Next.js on :3000
npm run dev:backend    # Express on :4000
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build for Production

```bash
npm run build
npm start   # Starts backend only (frontend should be deployed to Vercel)
```

---

## Adding New Scenarios

Scenarios are defined in `backend/src/scenarios/`. To add one:

1. Create a new file: `backend/src/scenarios/ascent-a-3v2.ts`
2. Export a `Scenario` object (see `ascent-b-3v2.ts` as template)
3. Add it to `backend/src/scenarios/index.ts`
4. Set the `releaseDate` to schedule when it goes live

Scenarios auto-seed into the database on server startup.

---

## Current Status

**Phase 1 — Foundation** ✅ Complete
- [x] Project scaffold (Next.js + Express)
- [x] Database setup + migrations
- [x] Shared TypeScript types
- [x] First scenario definition (Ascent B-Site 3v2)
- [x] Rule engine (rule evaluation + scoring)
- [x] Animation generator (plan → event timeline)
- [x] Minimap canvas (tap-to-place utility, drag arrows)
- [x] Results page (score breakdown, highlights, mistakes)
- [x] Valorant-themed UI shell

**Phase 2 — Animation Rendering** 🚧 Next
- [ ] Konva animation renderer (event timeline → visual playback)
- [ ] Utility effects (smoke expand, flash detonate, mollie erupt)
- [ ] Agent movement along paths
- [ ] Kill/death animations
- [ ] Sound effects

**Phase 3 — Polish & Launch**
- [ ] Real minimap images (Valorant assets)
- [ ] Agent icon tokens
- [ ] Utility icons
- [ ] Mobile optimization
- [ ] Ad integration (Google AdSense)
- [ ] Community voting
- [ ] Share/screenshot feature
- [ ] More scenarios (3-5 total)
- [ ] Deploy

---

## License

Fan project — not affiliated with Riot Games or Valorant.
