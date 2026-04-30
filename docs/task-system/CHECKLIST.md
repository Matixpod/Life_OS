# ✅ TASK SYSTEM — Implementation Checklist

## 🏗️ Phase 1: Backend Models
- [ ] Create `/app/models/task_models.py`
  - [ ] `TaskCreate` — validation: title min 1 char, estimated_minutes 5–480
  - [ ] `TaskUpdate` — all fields optional
  - [ ] `Task` — full DB record model
  - [ ] `CategoryDaySummary`
  - [ ] `DailyTaskList` — with by_category dict
  - [ ] `WeeklyTaskList` — 7 DailyTaskLists + stats
  - [ ] `TaskCompletionResult` — xp_earned, streak, bonus_reasons
- [ ] Verify TaskCategory and TaskStatus enums imported from kronos models (do NOT redefine)

## 🧱 Phase 2: Task Service
- [ ] Create `/app/services/task_service.py`
- [ ] `create_task(user_id, data: TaskCreate) -> Task`
  - [ ] Trim whitespace from title
  - [ ] Validate category is valid enum value
  - [ ] Insert to Supabase tasks table
- [ ] `complete_task(user_id, task_id) -> TaskCompletionResult`
  - [ ] Fetch task, verify ownership
  - [ ] Return 409 if already done
  - [ ] Return 422 if skipped
  - [ ] Set status=done, completed_at=now()
  - [ ] Call `compute_xp(task)` for XP calculation
  - [ ] Return TaskCompletionResult
- [ ] `skip_task(user_id, task_id) -> Task`
- [ ] `update_task(user_id, task_id, data: TaskUpdate) -> Task`
- [ ] `soft_delete_task(user_id, task_id) -> None` — sets status=skipped, never hard delete
- [ ] `get_daily_tasks(user_id, date) -> DailyTaskList`
  - [ ] Group tasks by category
  - [ ] Compute completion_rate
  - [ ] Build by_category summary with xp_earned
- [ ] `get_weekly_tasks(user_id, week_start) -> WeeklyTaskList`
  - [ ] Build 7 DailyTaskLists (Mon–Sun)
  - [ ] Compute total_xp, best_day, worst_day
- [ ] `get_backlog_tasks(user_id) -> list[Task]`
  - [ ] Tasks where scheduled_date IS NULL
  - [ ] Sorted by priority desc, created_at desc

## ⚡ Phase 3: XP Engine
- [ ] Create `/app/services/xp_engine.py`
- [ ] `compute_xp(task: Task, streak: int) -> tuple[int, list[str]]`
  - [ ] Base XP: low=10, medium=25, high=50
  - [ ] Early bird bonus: completed before 12:00 local time = +20%
  - [ ] On-schedule bonus: completed on scheduled_date = +30%
  - [ ] Streak bonus: streak >= 3 = +15%
  - [ ] Return (final_xp, bonus_reasons)
- [ ] All bonuses are additive percentages on base
- [ ] XP is always integer (round up)
- [ ] Write unit tests for each bonus scenario

## 🔗 Phase 4: API Routes
- [ ] Create `/app/routers/tasks.py`
- [ ] `GET /api/tasks` — with query params: date, category, status, limit, offset
- [ ] `POST /api/tasks` → calls `create_task`
- [ ] `PATCH /api/tasks/{id}` → calls `update_task`
- [ ] `DELETE /api/tasks/{id}` → calls `soft_delete_task`
- [ ] `POST /api/tasks/{id}/complete` → calls `complete_task` + BackgroundTask for KRONOS
- [ ] `POST /api/tasks/{id}/skip` → calls `skip_task`
- [ ] `GET /api/tasks/today` → calls `get_daily_tasks` with today's date
- [ ] `GET /api/tasks/week` → calls `get_weekly_tasks` with current ISO week start
- [ ] `GET /api/tasks/backlog` → calls `get_backlog_tasks`
- [ ] All routes use `get_current_user` dependency
- [ ] `user_id` always from JWT, never from request body
- [ ] Register router in `main.py`

## 🔄 Phase 5: KRONOS Integration
- [ ] Add `refresh_streaks(user_id, category)` method to KRONOS context_builder
- [ ] In `complete_task` route: add `BackgroundTasks.add_task(refresh_streaks, ...)`
- [ ] In `skip_task` route: same BackgroundTask
- [ ] Verify KRONOS `kronos_streaks` table updates after task completion
- [ ] Test: complete vitality task → GET /api/kronos/streaks → streak incremented

## 🎨 Phase 6: Frontend — Foundation
- [ ] Create `/src/api/tasks.ts` — typed API client
  - [ ] `fetchTodayTasks(): Promise<DailyTaskList>`
  - [ ] `fetchWeekTasks(): Promise<WeeklyTaskList>`
  - [ ] `fetchBacklog(): Promise<Task[]>`
  - [ ] `createTask(data: TaskCreate): Promise<Task>`
  - [ ] `completeTask(id: string): Promise<TaskCompletionResult>`
  - [ ] `skipTask(id: string): Promise<Task>`
  - [ ] `updateTask(id: string, data: Partial<TaskUpdate>): Promise<Task>`
  - [ ] `deleteTask(id: string): Promise<void>`
- [ ] Create `/src/context/TaskContext.tsx`
  - [ ] Shared state: today's tasks, weekly tasks, backlog
  - [ ] `refreshTodayTasks()` — called after any mutation
  - [ ] `refreshKronos()` — triggers KRONOS dashboard refetch
- [ ] Create `/src/hooks/useTasks.ts`
  - [ ] Wraps TaskContext, exposes actions
  - [ ] Optimistic updates: mark done locally, rollback on error
- [ ] Create `/src/hooks/useKeyboardShortcut.ts`
  - [ ] Generic hook: `useKeyboardShortcut('n', callback)`
  - [ ] Ignores shortcut when focus is in input/textarea

## 🎨 Phase 7: Frontend — Components
- [ ] `QuickAdd.tsx`
  - [ ] Always-visible input bar (not in modal)
  - [ ] `N` keyboard shortcut focuses input
  - [ ] Category pills: icon buttons for each TaskCategory
  - [ ] Priority toggle: L / M / H buttons
  - [ ] Enter to submit, Escape to clear
  - [ ] Shake animation on empty submit attempt
  - [ ] Defaults: today, medium priority
- [ ] `TaskCard.tsx`
  - [ ] Animated checkbox (CSS transition on complete)
  - [ ] Priority left border: red/amber/slate
  - [ ] Category icon (Lucide)
  - [ ] Strikethrough title when done
  - [ ] Estimated time badge
  - [ ] Hover state: Edit / Skip / Delete actions
  - [ ] Min height 44px (mobile tap target)
- [ ] `XPPopup.tsx`
  - [ ] Float-up + fade-out animation (1.5s)
  - [ ] Shows: `+{xp} XP ⚡`
  - [ ] Shows bonus tags if any (early_bird, streak_bonus)
  - [ ] Position: above the completed TaskCard
- [ ] `DailyView.tsx`
  - [ ] Tasks grouped by category
  - [ ] Category header: icon + name + XP earned today
  - [ ] Overdue tasks section at top (red border)
  - [ ] "Przenieś na dziś" button for overdue tasks
  - [ ] Empty state per category
  - [ ] Loading skeleton (3 placeholder cards)
- [ ] `WeeklyView.tsx`
  - [ ] 7 columns Mon–Sun
  - [ ] Current day highlighted (amber border)
  - [ ] Per-day: date + task count + completion bar
  - [ ] Click day → inline expand to DailyView
  - [ ] XP per day as mini Recharts BarChart at bottom
- [ ] `BacklogView.tsx`
  - [ ] List sorted by priority desc
  - [ ] "Zaplanuj na dziś" button per task
  - [ ] Empty state: "Backlog pusty — brawo!"
- [ ] `CategoryFilter.tsx`
  - [ ] Icon pills for all 6 categories
  - [ ] "Wszystkie" default
  - [ ] Selection persists in localStorage
- [ ] `TaskDashboard.tsx`
  - [ ] Tab switcher: Dziś / Tydzień / Backlog
  - [ ] QuickAdd always visible at top
  - [ ] KRONOS alert banner (if alerts exist)
  - [ ] Routes: `/tasks`, `/tasks/week`, `/tasks/backlog`
- [ ] Add `/tasks/*` routes to React Router v6 config

## 🧪 Phase 8: Testing
- [ ] `test_create_task` — happy path
- [ ] `test_complete_task` — XP computed correctly
- [ ] `test_complete_already_done` — returns 409
- [ ] `test_complete_skipped` — returns 422
- [ ] `test_xp_early_bird_bonus` — before 12:00 = +20%
- [ ] `test_xp_streak_bonus` — streak >= 3 = +15%
- [ ] `test_xp_on_schedule_bonus` — completed on scheduled date = +30%
- [ ] `test_soft_delete` — status=skipped, record still in DB
- [ ] `test_daily_tasks_grouping` — tasks grouped by category correctly
- [ ] `test_kronos_streak_updates_after_completion` — integration test
- [ ] Playwright: QuickAdd — type task, press Enter, appears in DailyView
- [ ] Playwright: Complete task — XPPopup appears and disappears
- [ ] Playwright: N shortcut focuses QuickAdd input

## 🚀 Phase 9: Finalization
- [ ] `ruff check app/routers/tasks.py app/services/`
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm eslint src/components/tasks/ src/api/tasks.ts`
- [ ] Verify all routes require auth
- [ ] Verify soft delete never hard-deletes
- [ ] Test overdue task display (schedule task for yesterday)
- [ ] Test mobile: all tap targets >= 44px
- [ ] Verify KRONOS dashboard refreshes after task completion
- [ ] Final review against PROMPT.md
