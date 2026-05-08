# ✅ PROMETHEUS Implementation Checklist

## 🗄️ Phase 1: Database
- [ ] Run `supabase_migration.sql` in Supabase SQL editor
- [ ] Verify 4 new tables exist: `prometheus_exercises`, `prometheus_sessions`, `prometheus_session_exercises`, `prometheus_reports`
- [ ] Confirm RLS policies are active

## ⚙️ Phase 2: Backend — Config & Models
- [ ] Add 4 `TABLE_PROMETHEUS_*` constants to `backend/core/config.py`
- [ ] Add `ExerciseSet`, `ExerciseCreate`, `SessionExerciseCreate`, `SessionCreate`, `ParseExerciseRequest`, `ParseExerciseResponse`, `PrometheusMessage`, `PrometheusChatRequest`, `WeeklyReportRequest` to `backend/models/schemas.py`

## 🔧 Phase 3: Backend — Service
- [ ] Create `backend/services/prometheus_service.py`
- [ ] Implement `get_exercise_library()`
- [ ] Implement `upsert_exercise()`
- [ ] Implement `create_session()` — also writes to `workout_sessions` for dashboard compat
- [ ] Implement `get_sessions(days_back=30)` — includes exercises via join
- [ ] Implement `get_session_with_exercises(session_id)`
- [ ] Implement `get_muscle_recovery_map()` — 96h linear decay, returns `dict[str, float]`
- [ ] Implement `save_weekly_report()` and `get_latest_weekly_report()`

## 🤖 Phase 4: Backend — PROMETHEUS Agent
- [ ] Create `backend/agents/prometheus/__init__.py`
- [ ] Create `backend/agents/prometheus/agent.py`
- [ ] Implement `parse_exercise(text, provider)` — returns `ParseExerciseResponse`
- [ ] Implement `chat(messages, session_history, provider)` — returns `str`
- [ ] Implement `generate_weekly_report(sessions, provider)` — returns `dict`
- [ ] All 3 functions use `AIProvider` abstraction (no direct Anthropic calls)
- [ ] Strip `json ` fences before parsing AI JSON responses

## 🌐 Phase 5: Backend — Router
- [ ] Create `backend/routers/prometheus.py` with prefix `/prometheus`
- [ ] `GET /exercises` with optional `?search=` query param
- [ ] `POST /exercises` — upsert exercise to library
- [ ] `POST /exercises/parse` — AI parse → `ParseExerciseResponse`
- [ ] `POST /sessions` — create session + exercises, returns session
- [ ] `GET /sessions` with `?days_back=30`
- [ ] `GET /sessions/{id}`
- [ ] `GET /recovery` → recovery map
- [ ] `POST /chat` — SSE streaming, inject session history as context
- [ ] `GET /report?week_start=YYYY-MM-DD`
- [ ] `POST /report/generate` — SSE streaming weekly report
- [ ] Register router in `backend/main.py`: `app.include_router(prometheus_router, prefix="/api")`

## 🎨 Phase 6: Frontend — Types & API
- [ ] Copy `prometheus_types.ts` → `frontend/src/types/prometheus.ts`
- [ ] Install `react-muscle-highlighter`: `npm install react-muscle-highlighter`
- [ ] Create `frontend/src/api/prometheus.ts` — all endpoints + SSE helpers

## 🖥️ Phase 7: Frontend — Components
- [ ] Create `frontend/src/components/prometheus/BodyMap.tsx` using `react-muscle-highlighter`, `recoveryMapToBodyParts()`, front/back toggle
- [ ] Create `frontend/src/components/prometheus/ExerciseInput.tsx` — textarea + parse button + result card
- [ ] Create `frontend/src/components/prometheus/WorkoutLog.tsx` — today's session + recent history
- [ ] Create `frontend/src/components/prometheus/MuscleRecoveryBar.tsx` — horizontal progress bars per muscle
- [ ] Create `frontend/src/components/prometheus/WeekView.tsx` — 7×16 heatmap table + neglected muscles
- [ ] Create `frontend/src/components/prometheus/PrometheusChat.tsx` — SSE streaming chat, auto-scroll
- [ ] Create `frontend/src/components/prometheus/WeeklyReport.tsx` — report display + generate button with SSE
- [ ] Create `frontend/src/components/prometheus/PrometheusPage.tsx` — 3-tab layout, data loading

## 🔗 Phase 8: Integration
- [ ] Replace `frontend/src/pages/Workout.tsx` placeholder with `<PrometheusPage />`
- [ ] Update `Sidebar.tsx`: change "Workout" label → "PROMETHEUS"
- [ ] Verify `/workout` route renders PROMETHEUS page in the app
- [ ] Verify dashboard `WorkoutSummary` still works (session writes to `workout_sessions`)

## 🧪 Phase 9: Smoke Tests
- [ ] POST `/api/prometheus/exercises/parse` with `{"text": "Wyciskanie na klatę 12x80kg 10x85kg"}` → valid JSON response
- [ ] POST `/api/prometheus/sessions` with parsed exercise → 201
- [ ] GET `/api/prometheus/recovery` → object with muscle keys and float values
- [ ] Frontend: open `/workout`, see PROMETHEUS page load
- [ ] Frontend: type exercise, click Add, see body map update
- [ ] Frontend: open PROMETHEUS tab, send chat message, see streaming response

## 🏁 Phase 10: Polish
- [ ] All TypeScript errors resolved (`tsc --noEmit`)
- [ ] No `any` types in `prometheus.ts` or component files
- [ ] Loading states on all async operations
- [ ] Error boundaries / inline error messages on failed API calls
- [ ] Body map front/back toggle works and shows correct muscles
- [ ] Heatmap accurately reflects 7-day history
