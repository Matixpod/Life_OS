# ✅ ARES — Implementation Checklist

## 🏗️ Phase 1: Database
- [ ] Create `migrations/007_ares_schema.sql`
  - [ ] `ares_scores` table
  - [ ] `ares_analyses` table
  - [ ] RLS + owner policies on both
  - [ ] Indexes on user_id + timestamp
- [ ] Run migration on Supabase

## 🧱 Phase 2: Models
- [ ] Create `/app/agents/ares/__init__.py`
- [ ] Create `/app/agents/ares/models.py`
  - [ ] `VitalitySubcategory` enum
  - [ ] `ToneMode` enum (peak/good/needs_work/crisis)
  - [ ] `SubcategoryScore` model
  - [ ] `AresScoreResult` model
  - [ ] `AresContext` model with `to_prompt_string()`
  - [ ] `AresDashboard` model
  - [ ] `AresAnalysis` model (DB record)

## ⚙️ Phase 3: Core Engine
- [ ] Create `/app/agents/ares/vitality_scorer.py`
  - [ ] Polish keyword dict per subcategory (extensible)
  - [ ] `detect_subcategory(title) -> VitalitySubcategory | None`
  - [ ] `compute_subcategory_score(tasks, subcategory, days=14) -> float`
  - [ ] Floor of 20 when 0 tasks detected
  - [ ] `compute_health_score(user_id, supabase) -> AresScoreResult`
  - [ ] Weights: activity=0.35, nutrition=0.30, sleep=0.20, hydration=0.15
  - [ ] Save to ares_scores table
- [ ] Create `/app/agents/ares/context_builder.py`
  - [ ] `build_ares_context(user_id, supabase) -> AresContext`
  - [ ] Fetch KRONOS context (import or HTTP call)
  - [ ] Compute score_delta vs previous ares_score
  - [ ] Determine tone_mode from score threshold
  - [ ] `to_prompt_string()` — deterministic output
- [ ] Create `/app/agents/ares/ares_agent.py`
  - [ ] ARES system prompt (Polish, as defined in PROMPT.md)
  - [ ] Uses `AIProviderFactory.get_provider_for_agent("ares", user_id, supabase)`
  - [ ] `stream_analysis(context: AresContext) -> AsyncIterator[str]`
  - [ ] BackgroundTask: save completed analysis to ares_analyses

## 🔗 Phase 4: API Routes
- [ ] Create `/app/routers/ares.py`
- [ ] `GET /api/v1/ares/dashboard` → AresDashboard
- [ ] `GET /api/v1/ares/score` → AresScoreResult
- [ ] `GET /api/v1/ares/score/history` → last 30 scores
- [ ] `POST /api/v1/ares/analysis` → SSE stream
- [ ] `GET /api/v1/ares/analysis/history` → list[AresAnalysis]
- [ ] `GET /api/v1/ares/context` → AresContext (debug)
- [ ] All routes use `get_current_user`
- [ ] Register router in `main.py`

## 🎨 Phase 5: Frontend Components
- [ ] Create `/src/components/ares/` directory
- [ ] `HealthScoreGauge.tsx` — pure SVG radial gauge
  - [ ] Animated arc fill on mount
  - [ ] Color zones: red/amber/green/emerald
  - [ ] Score + tone label in center
- [ ] `SubcategoryBar.tsx` — single sub-category progress bar
  - [ ] Lucide icon per subcategory
  - [ ] Animated fill
  - [ ] Tasks count subtitle
- [ ] `AresTrendChart.tsx` — Recharts LineChart 14 days
  - [ ] Reference lines at 40, 60, 80
  - [ ] Handles null gaps gracefully
  - [ ] Tooltip with score + delta
- [ ] `AresAnalysis.tsx` — SSE streaming viewer
  - [ ] Uses useKronosStream hook (or new useAresStream)
  - [ ] react-markdown rendering
  - [ ] Current score badge at top
- [ ] `AresDashboard.tsx` — main container
  - [ ] HealthScoreGauge (large, top center)
  - [ ] 4x SubcategoryBar
  - [ ] AresTrendChart
  - [ ] "Generuj analizę" button
  - [ ] AresAnalysis (streaming)
  - [ ] Empty state for new users
- [ ] `/src/api/ares.ts` — typed API client
- [ ] Add `/ares` route to React Router
- [ ] Add ARES link in sidebar

## 🧪 Phase 6: Tests
- [ ] `test_vitality_scorer.py`
  - [ ] `detect_subcategory` — matches Polish keywords correctly
  - [ ] `detect_subcategory` — returns None for unrelated task
  - [ ] `compute_subcategory_score` — 14/14 days = 100
  - [ ] `compute_subcategory_score` — 0 tasks = 20 (floor)
  - [ ] `compute_health_score` — weighted average correct
- [ ] `test_ares_context_builder.py`
  - [ ] `to_prompt_string()` deterministic
  - [ ] score_delta is None for first analysis
  - [ ] tone_mode correct per threshold (test boundary: 80.00 = peak)
- [ ] `test_ares_router.py`
  - [ ] Dashboard returns 200 with correct shape
  - [ ] Empty state (no vitality tasks) returns 200, not 500

## 🚀 Phase 7: Finalization
- [ ] `ruff check app/agents/ares/ app/routers/ares.py`
- [ ] `pnpm tsc --noEmit`
- [ ] `pnpm eslint src/components/ares/`
- [ ] Verify ARES uses AI Provider abstraction (not hardcoded Claude)
- [ ] Verify ARES analysis switches provider when AI settings changed
- [ ] Test empty state (no vitality tasks)
- [ ] Test Polish text in analysis output
- [ ] Add ARES to sidebar navigation
