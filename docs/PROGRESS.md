# 📊 KRONOS — Progress

## ✅ Completed
*(nothing yet — starting from scratch)*

## 🔄 In Progress
- [ ] Initial planning and architecture design

## ⬜ Not Started

### Database
- [ ] `001_kronos_schema.sql` migration
- [ ] Tables: tasks, kronos_streaks, kronos_patterns, kronos_snapshots, kronos_analyses
- [ ] RLS policies on all tables

### Backend — Models
- [ ] `/app/agents/kronos/models.py` — all Pydantic v2 models

### Backend — Engine
- [ ] `/app/agents/kronos/streak_tracker.py`
- [ ] `/app/agents/kronos/pattern_analyzer.py`
- [ ] `/app/agents/kronos/pve_scorer.py`
- [ ] `/app/agents/kronos/context_builder.py`
- [ ] `/app/agents/kronos/claude_agent.py`
- [ ] `/app/agents/kronos/exceptions.py`

### Backend — API
- [ ] `/app/routers/kronos.py` — all 7 routes
- [ ] Register router in `main.py`

### Frontend
- [ ] `/src/api/kronos.ts` — typed API client
- [ ] `/src/hooks/useKronosStream.ts` — SSE hook
- [ ] `/src/components/kronos/KronosDashboard.tsx`
- [ ] `/src/components/kronos/StreakCard.tsx`
- [ ] `/src/components/kronos/PatternHeatmap.tsx`
- [ ] `/src/components/kronos/PvEChart.tsx`
- [ ] `/src/components/kronos/KronosAnalysis.tsx`
- [ ] `/src/components/kronos/KronosAlerts.tsx`
- [ ] Add KRONOS route to React Router

### Testing
- [ ] pytest: streak_tracker (4 scenarios)
- [ ] pytest: pve_scorer (3 scenarios)
- [ ] pytest: context_builder (2 scenarios)
- [ ] pytest: dashboard endpoint (mocked Supabase)
- [ ] Playwright: dashboard renders
- [ ] Playwright: analysis stream renders

## 🚧 Known Blockers / Open Questions
- [ ] Confirm `tasks` table doesn't already exist under a different name in the 16+ table schema
- [ ] Confirm auth dependency name in existing codebase (`get_current_user` or different)
- [ ] Confirm Supabase client import pattern used in existing routers
- [ ] Decide: does the existing system have a `user_id` concept or use Supabase `auth.uid()` directly?

## 📅 Suggested Implementation Order
1. SQL migration → run on Supabase, verify
2. Pydantic models → no external dependencies, test immediately
3. streak_tracker → simplest logic, easiest to test
4. pve_scorer → second simplest
5. pattern_analyzer → most complex query logic
6. context_builder → depends on all three above
7. claude_agent → depends on context_builder
8. API routes → wire everything together
9. Frontend API client → define types
10. Frontend components → build from bottom up (StreakCard first, Dashboard last)
