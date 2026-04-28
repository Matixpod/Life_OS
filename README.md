# Life OS

A single-user personal intelligence platform that tracks 12 life domains, scores each day with an AI agent, and compresses historical context so the agent's memory stays clean over time.

> **Goal:** help one person discover and become the best version of themselves — across sleep, work, body, mind, and meaning.

---

## What's in here

```
Life_OS/
├── backend/        FastAPI + Pydantic v2 + supabase-py + anthropic SDK
├── frontend/       React 19 + TypeScript (strict) + Tailwind v3 + Recharts
├── mcp/            Life OS MCP server (13 tools, 2 resources)
├── migrations/     Supabase SQL — 16 tables + pgvector
├── docs/           ARCHITECTURE.md · DATA_MODELS.md · DECISIONS.md · PROGRESS.md
├── screenshots/    Visual-test output (desktop + mobile)
└── start-lifeos.sh tmux session launcher (claude / backend / frontend / logs)
```

## The 12 modules

Daily Goals · Sleep & Energy · Supplements · Workout · Cognitive Challenge · Mental Health · Body Metrics · Nutrition · Deep Work · Learning · Daily Intelligence · Weekly/Monthly Review

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript strict, Tailwind 3, Recharts, Lucide |
| Backend | Python 3.12, FastAPI, Pydantic v2, supabase-py, anthropic |
| Database | Supabase (PostgreSQL + pgvector) — 16 tables |
| AI | Claude API (`claude-sonnet-4-20250514`) — backend only |
| MCP | Life OS MCP (`mcp/lifeos_mcp.py`) + Playwright MCP |

## Design system

- **Fonts:** Sora (UI/headings) · JetBrains Mono (every number and metric)
- **Palette:** bg `#0A0A0F` · cards `#12121A` · blue `#3B82F6` · amber `#F59E0B` · emerald `#10B981`
- **Vibe:** premium dark analytics OS — Linear × Oura Ring × Bloomberg terminal

## Getting started

### 1. Configure environment
```bash
cp backend/.env.example backend/.env       # add SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
cp frontend/.env.example frontend/.env     # VITE_API_BASE_URL=http://localhost:8000
```

### 2. Run database migrations
In the Supabase SQL editor, run in order:
1. `migrations/001_initial_schema.sql` (16 tables + pgvector)
2. `migrations/002_seed_data.sql` (single user + 6 supplements + sample data)

### 3. Start everything
```bash
./start-lifeos.sh    # tmux: claude / backend(:8000) / frontend(:5173) / logs
```

Or run pieces individually:
```bash
# Backend
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && pnpm dev          # → http://localhost:5173

# Health check
curl http://localhost:8000/health
```

## Daily flows

- **Morning popup** — first time you open the app each day, log sleep duration, quality, energy, and morning mood. localStorage gates it so you only see it once.
- **Cognitive challenge** — opens an external problem (LeetCode / Project Euler), runs a persistent SVG-ring timer, unlocks a Socratic Claude tutor on expiry or "I need help".
- **Daily intelligence** — Claude curates 3 research-backed insights + a quote, cached once per day.
- **Weekly review** — generates a full markdown review *and* a <400-token JSON snapshot. Snapshots feed the agent so historical context stays cheap and clean.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system diagram and data flows.

## MCP server

The `lifeos` MCP server exposes 13 read/log tools (e.g. `get_today_summary`, `get_cognitive_challenge`, `log_sleep`, `log_workout`, `generate_weekly_review`) so Claude Code can read and update Life OS state directly. See `mcp/lifeos_mcp.py` and `.mcp.json`.

## Visual testing

Run the headless visual harness to screenshot every route at desktop + mobile:
```bash
cd frontend && node scripts/visual-test.mjs
# → ../screenshots/<route>-{desktop,mobile}.png
```

The script reports any browser console errors. The Playwright MCP server (`/visual-test`, `/screenshot <route>`) is the in-Claude alternative.

## Build status

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for current phase, completed checkpoints, and known external blockers.

## Architecture invariants

- All TypeScript types live in `frontend/src/types/index.ts`.
- All API calls go through `frontend/src/services/api.ts`.
- Business logic lives in backend `services/`, never in `routers/`.
- The Supabase client lives only in the backend — never exposed to the browser.
- No raw SQL — Supabase query builder only.
- `migrations/001_initial_schema.sql` is frozen — add new numbered files for changes.

## License

Personal project — single user, no public deployment intended.
