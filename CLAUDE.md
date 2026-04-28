# Life OS — Personal Intelligence Platform

## Purpose
Single-user life tracking dashboard with 12 modules, AI agents, and daily potential scoring.
**Goal:** "Help the user discover and become the best version of themselves."

## Stack
- **Backend:** Python 3.12 + FastAPI + Pydantic v2 + supabase-py + anthropic SDK
- **Frontend:** React 18 + TypeScript (strict) + TailwindCSS v3 + Recharts + Lucide React
- **Database:** Supabase — PostgreSQL + pgvector — 16 tables
- **AI:** Claude API (`claude-sonnet-4-20250514`) — backend only, never frontend
- **MCP:** Life OS MCP server (`mcp/lifeos_mcp.py`) + Playwright MCP

## Design system
- **Fonts:** Sora (UI/headings) · JetBrains Mono (ALL numbers and metrics)
- **Colors:** bg `#0A0A0F` · cards `#12121A` · blue `#3B82F6` · amber `#F59E0B` · emerald `#10B981`
- **Aesthetic:** Premium dark analytics OS — Linear × Oura Ring × Bloomberg terminal

## Commands

```bash
# Start everything (uses tmux)
./start-lifeos.sh

# Backend only
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend only
cd frontend && pnpm dev   # → localhost:5173

# Verify backend alive
curl http://localhost:8000/health

# Type check
cd frontend && pnpm tsc --noEmit
cd backend && ruff check .
```

## Project layout
```
life-os/
├── backend/          → FastAPI (routers/ services/ models/ core/)
├── frontend/src/     → React (pages/ components/ services/ types/)
├── mcp/              → Life OS MCP server (lifeos_mcp.py)
├── migrations/       → SQL files — never modify 001_, add new numbered files
└── docs/             → context files — reference as @docs/filename.md
```

For full details → @docs/ARCHITECTURE.md · @docs/DATA_MODELS.md · @docs/DECISIONS.md

## The 12 modules
1. Daily Goals · 2. Sleep & Energy · 3. Supplements · 4. Workout
5. Cognitive Challenge · 6. Mental Health · 7. Body Metrics · 8. Nutrition
9. Deep Work · 10. Learning · 11. Daily Intelligence · 12. Weekly/Monthly Review

## Critical rules — never break

**Code quality:**
- No `any` in TypeScript — ever. Use `unknown` or define proper types.
- No raw SQL — Supabase query builder only.
- No API calls inside React components — use `src/services/api.ts`.
- No Claude API calls from frontend — backend only.
- Business logic in `services/`, not in `routers/`.

**Data safety:**
- Never drop/truncate tables without explicit user confirmation.
- Never log journal text, mood data, or health entries.
- Never commit `.env` files.
- Never modify `migrations/001_initial_schema.sql` — add new numbered files.

**Architecture:**
- All TypeScript types live in `src/types/index.ts`.
- All API calls go through `src/services/api.ts`.
- Supabase client lives in backend only — never exposed to frontend.

## Visual testing workflow
After any frontend change:
1. Use Playwright MCP to open `localhost:5173`
2. Take a screenshot — describe what you see
3. Fix visual issues before marking step complete
4. For mobile testing: resize viewport to 375px, take screenshot

Slash commands available:
- `/visual-test` → full dashboard audit
- `/screenshot [route]` → screenshot of a specific page

## Current build status
See `@docs/PROGRESS.md` for current phase and checked-off steps.
