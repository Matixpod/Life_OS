# 🏗️ TASK SYSTEM — Architecture

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                          │
│                                                                     │
│  TaskDashboard                                                      │
│  ├── QuickAdd (always visible, N shortcut)                         │
│  ├── [Tab: Dziś]    → DailyView                                    │
│  │     ├── CategoryHeader (icon + XP earned)                       │
│  │     ├── TaskCard × N  (checkbox, priority, XP animation)        │
│  │     └── OverdueTasks section                                     │
│  ├── [Tab: Tydzień] → WeeklyView                                   │
│  │     ├── DayColumn × 7  (date, tasks, completion bar)            │
│  │     └── XP BarChart (Recharts)                                  │
│  └── [Tab: Backlog] → BacklogView                                  │
│        └── UnscheduledTaskList                                      │
│                                                                     │
│  Shared: TaskContext → optimistic updates + KRONOS refresh trigger  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP (REST)
┌───────────────────────────▼─────────────────────────────────────────┐
│                      BACKEND (FastAPI)                              │
│                                                                     │
│  /app/routers/tasks.py                                              │
│  ├── GET  /api/tasks/today                                          │
│  ├── GET  /api/tasks/week                                           │
│  ├── GET  /api/tasks/backlog                                        │
│  ├── GET  /api/tasks                    (filtered list)             │
│  ├── POST /api/tasks                    (create)                    │
│  ├── PATCH /api/tasks/{id}              (update)                    │
│  ├── DELETE /api/tasks/{id}             (soft delete)               │
│  ├── POST /api/tasks/{id}/complete  ────────────────┐               │
│  └── POST /api/tasks/{id}/skip      ────────────────┤               │
│                                                     │ BackgroundTask│
│  /app/services/                                     ▼               │
│  ├── task_service.py   (CRUD + daily/weekly logic)                  │
│  ├── xp_engine.py      (XP formula, bonus reasons)  │               │
│  └── ─────────────────────────────────────────────  │               │
│                                                     ▼               │
│  /app/agents/kronos/context_builder.py                              │
│  └── refresh_streaks(user_id, category)   ← fires after complete   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ supabase-py (async)
┌───────────────────────────▼─────────────────────────────────────────┐
│                   DATABASE (Supabase / PostgreSQL)                  │
│                                                                     │
│  tasks              ← ALL task data lives here                      │
│  kronos_streaks     ← updated by BackgroundTask after completion    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### `QuickAdd.tsx`
Stateless input component. Manages local form state only. On submit, calls
`TaskContext.createTask()` which does optimistic update and API call.
Keyboard shortcut via `useKeyboardShortcut('n')` — ignores when other
inputs are focused.

### `TaskCard.tsx`
Purely presentational. Receives task + callbacks as props. Manages only
local animation state (XPPopup visible). On checkbox click: fires
`onComplete(task.id)` → parent handles API call + optimistic update.

### `XPPopup.tsx`
Mounts above TaskCard for 1.5s on completion. Uses CSS `@keyframes` for
float + fade. Unmounts itself after animation via `setTimeout`.

### `TaskContext.tsx`
Single source of truth for task state. Handles:
- Optimistic updates (mark done locally before API confirms)
- Rollback on API error (restore previous state)
- KRONOS refresh trigger (calls `useKronosDashboard().refresh()`)
- Shared state between DailyView, WeeklyView, BacklogView

### `task_service.py`
All business logic. No direct DB queries — uses `supabase-py` query builder.
Separated from router to enable unit testing without HTTP layer.

### `xp_engine.py`
Pure function, no DB access. `compute_xp(task, streak) -> (int, list[str])`.
Easy to tune XP values without touching business logic.

## Key Data Flows

### Create Task (QuickAdd)
```
User types task + presses Enter
  → QuickAdd calls TaskContext.createTask(data)
  → TaskContext: optimistic add to local state
  → TaskContext: POST /api/tasks
  → task_service.create_task() → Supabase insert
  → Response: created Task
  → TaskContext: replace optimistic item with real item
  → DailyView re-renders with new task
```

### Complete Task
```
User clicks checkbox on TaskCard
  → TaskCard fires onComplete(task.id)
  → TaskContext: optimistic mark as done
  → XPPopup renders immediately (optimistic XP estimate)
  → POST /api/tasks/{id}/complete
  → task_service.complete_task():
      sets status=done, completed_at=now()
      calls compute_xp(task, streak)
      returns TaskCompletionResult
  → BackgroundTask: kronos.refresh_streaks(user_id, category)
  → Response: {task, xp_earned, streak_updated, bonus_reasons}
  → XPPopup updates with real XP value
  → TaskContext: trigger KRONOS dashboard refresh
```

### Weekly View Load
```
User clicks "Tydzień" tab
  → WeeklyView mounts
  → GET /api/tasks/week
  → task_service.get_weekly_tasks():
      query tasks for Mon–Sun of current ISO week
      build DailyTaskList for each day
      compute total_xp, best_day, worst_day
  → WeeklyView renders 7 columns
  → Recharts BarChart renders XP per day
```

## Design Decisions

- **Optimistic UI** — tasks marked done immediately in UI, rollback if API fails.
  Critical for perceived performance on mobile with slow connections.
- **Soft delete only** — `DELETE /api/tasks/{id}` sets `status='skipped'`, never
  removes from DB. KRONOS needs full history including skipped tasks.
- **XP engine is isolated** — `xp_engine.py` has zero DB dependencies. Can be
  unit tested with pure Python, easy to adjust formula without risk.
- **BackgroundTask for KRONOS** — streak refresh fires after response is sent.
  User sees XP immediately; KRONOS updates asynchronously.
- **No modal for QuickAdd** — modal adds friction. Input bar always visible,
  `N` shortcut from anywhere. This is the highest-frequency action in the app.
- **TaskContext as shared state** — avoids prop drilling across 4 view components.
  Single `refreshTodayTasks()` call updates all views.
