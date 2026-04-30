# ✅ KRONOS Implementation Checklist

## 🏗️ Phase 1: Database Schema
- [ ] Write `001_kronos_schema.sql` migration file
- [ ] Create `tasks` table with category enum, status enum, all required fields
- [ ] Create `kronos_streaks` table
- [ ] Create `kronos_patterns` table
- [ ] Create `kronos_snapshots` table
- [ ] Create `kronos_analyses` table
- [ ] Enable Row Level Security (RLS) on all 5 tables
- [ ] Add `user_id = auth.uid()` policy to each table
- [ ] Add indexes: `(user_id, category)`, `(user_id, scheduled_date)`, `(user_id, status)`
- [ ] Run migration on Supabase and verify tables exist

## 🧱 Phase 2: Pydantic Models
- [ ] Create `/app/agents/kronos/__init__.py`
- [ ] Create `/app/agents/kronos/models.py` with all Pydantic v2 models:
  - [ ] `TaskCategory` enum
  - [ ] `TaskStatus` enum
  - [ ] `DailyPvE` model
  - [ ] `StreakData` model
  - [ ] `PatternData` model
  - [ ] `PvEScore` model
  - [ ] `KronosAlert` model
  - [ ] `KronosContext` model with `to_prompt_string()` method
  - [ ] `KronosDashboard` model
  - [ ] `KronosAnalysis` model (DB record)
  - [ ] `AnalysisRequest` model (API input)

## 🧱 Phase 3: Core Engine
- [ ] Create `/app/agents/kronos/streak_tracker.py`
  - [ ] `get_streaks(user_id, supabase) -> list[StreakData]`
  - [ ] Handle timezone-aware date comparison
  - [ ] Detect trend (up/down/stable vs. last week)
- [ ] Create `/app/agents/kronos/pattern_analyzer.py`
  - [ ] `get_patterns(user_id, supabase) -> list[PatternData]`
  - [ ] Compute completion rate by day_of_week per category
  - [ ] Compute completion rate by hour_of_day per category
  - [ ] Classify peak_zones and dead_zones
  - [ ] Skip categories with < 7 days data (`insufficient_data` flag)
- [ ] Create `/app/agents/kronos/pve_scorer.py`
  - [ ] `get_pve_scores(user_id, supabase) -> list[PvEScore]`
  - [ ] Daily breakdown for last 30 days
  - [ ] Identify zero_execution_days, best_day, worst_day
  - [ ] Cap ratio at 1.0
- [ ] Create `/app/agents/kronos/context_builder.py`
  - [ ] `build_context(user_id, supabase) -> KronosContext`
  - [ ] Compute `global_consistency_score` (weighted average)
  - [ ] Return null score if < 3 categories have data
  - [ ] Generate `alerts` list (dead zones, streaks at risk)
  - [ ] Implement `to_prompt_string()` — deterministic, structured text block

## 🔗 Phase 4: API Routes
- [ ] Create `/app/routers/kronos.py`
- [ ] `GET /api/kronos/dashboard` → calls `build_context()`, returns `KronosDashboard`
- [ ] `GET /api/kronos/streaks` → returns `list[StreakData]`
- [ ] `GET /api/kronos/patterns` → returns `list[PatternData]`
- [ ] `GET /api/kronos/pve` → returns `list[PvEScore]`
- [ ] `GET /api/kronos/context` → returns `KronosContext` (for other agents)
- [ ] `GET /api/kronos/analysis/history` → returns saved analyses from DB
- [ ] `POST /api/kronos/analysis` → SSE streaming endpoint:
  - [ ] Build KronosContext
  - [ ] Construct Claude messages with KRONOS system prompt
  - [ ] Stream response via `anthropic.messages.stream()`
  - [ ] Yield SSE chunks to frontend
  - [ ] Use `BackgroundTasks` to save completed analysis to DB
- [ ] Register router in `main.py`
- [ ] Add auth dependency to all routes (`get_current_user`)

## 🤖 Phase 5: Claude Integration
- [ ] Create `/app/agents/kronos/claude_agent.py`
- [ ] Implement `KronosAgent` class with `anthropic.AsyncAnthropic` client
- [ ] Define KRONOS system prompt as module constant
- [ ] Method: `stream_analysis(context: KronosContext, analysis_type: str) -> AsyncIterator[str]`
- [ ] Handle `analysis_type`: weekly / category_deep_dive / crisis_intervention
- [ ] Handle Claude API timeout → raise `KronosAnalysisError`
- [ ] Validate streamed output is non-empty before saving

## 🎨 Phase 6: Frontend Components
- [ ] Create `/src/components/kronos/` directory
- [ ] `KronosDashboard.tsx` — main container, fetches `/api/kronos/dashboard`
- [ ] `StreakCard.tsx` — streak display per category with trend arrow
- [ ] `PatternHeatmap.tsx` — day × category grid with color intensity
- [ ] `PvEChart.tsx` — Recharts BarChart, last 4 weeks plan vs. execution
- [ ] `KronosAnalysis.tsx` — SSE streaming viewer with react-markdown
- [ ] `KronosAlerts.tsx` — alert banner list (dead zones, at-risk streaks)
- [ ] Create `/src/hooks/useKronosStream.ts` — manages SSE connection, retry logic
- [ ] Create `/src/api/kronos.ts` — typed API client for all KRONOS endpoints
- [ ] Add KRONOS route to React Router v6 config

## 🧪 Phase 7: Testing
- [ ] Write pytest tests for `streak_tracker.py`:
  - [ ] Streak with no gaps
  - [ ] Streak broken yesterday
  - [ ] Streak broken 3 weeks ago
  - [ ] User with no tasks (empty state)
- [ ] Write pytest tests for `pve_scorer.py`:
  - [ ] 100% execution
  - [ ] 0% execution day
  - [ ] Mixed week
- [ ] Write pytest tests for `context_builder.py`:
  - [ ] `to_prompt_string()` is deterministic
  - [ ] `global_consistency_score` null when < 3 categories
- [ ] Write pytest test for `/api/kronos/dashboard` (mock Supabase)
- [ ] Playwright test: KRONOS dashboard renders streak cards correctly
- [ ] Playwright test: "Generate Analysis" button triggers streaming and renders markdown

## 🚀 Phase 8: Finalization
- [ ] Run `ruff check` on all Python files — zero warnings
- [ ] Run `ESLint + Prettier` on all TypeScript files — zero warnings
- [ ] Verify all routes require authentication
- [ ] Verify RLS blocks cross-user data access
- [ ] Test SSE disconnection + auto-retry
- [ ] Verify empty state (new user) renders correctly without errors
- [ ] Final review against PROMPT.md requirements
