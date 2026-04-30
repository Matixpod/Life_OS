# 📐 TASK SYSTEM — Coding Standards

## Python (Backend)

### Naming Conventions
- Service functions: `verb_noun` → `create_task`, `complete_task`, `get_daily_tasks`
- Route handlers: `verb_noun` → `post_task`, `get_today`, `patch_task`
- XP engine: pure functions, no side effects, no DB access

### Required Patterns
```python
# ✅ user_id always from JWT — never from body
async def complete_task_route(
    task_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    supabase: AsyncClient = Depends(get_supabase),
):
    result = await task_service.complete_task(current_user.id, task_id, supabase)
    background_tasks.add_task(
        kronos_context_builder.refresh_streaks,
        user_id=current_user.id,
        category=result.task.category,
    )
    return result

# ✅ Soft delete — never hard delete
async def soft_delete_task(user_id: str, task_id: str, supabase: AsyncClient) -> None:
    await supabase.table("tasks") \
        .update({"status": "skipped"}) \
        .eq("id", task_id) \
        .eq("user_id", user_id) \
        .execute()

# ✅ Optimistic XP — compute before confirming with DB
xp, bonuses = compute_xp(task, current_streak)
# Then update DB — XP shown to user immediately

# ✅ Timezone-safe date handling
from dateutil import tz
user_local_now = datetime.now(tz.tzlocal())
```

### Forbidden Patterns
```python
# ❌ Hard delete
await supabase.table("tasks").delete().eq("id", task_id).execute()

# ❌ Redefining enums already in kronos.models
class TaskCategory(str, Enum):  # already exists — import it
    ...

# ❌ XP engine with DB access
async def compute_xp(task_id: str, supabase):  # NO — pure function only
    ...

# ❌ user_id from request body
async def create_task(data: TaskCreate):
    user_id = data.user_id  # NEVER — always from JWT
```

---

## TypeScript (Frontend)

### Optimistic Update Pattern
```typescript
// In TaskContext.tsx
const completeTask = async (taskId: string) => {
  // 1. Optimistic update
  setTasks(prev => prev.map(t =>
    t.id === taskId ? { ...t, status: 'done' } : t
  ))

  try {
    // 2. API call
    const result = await api.completeTask(taskId)
    // 3. Update with real data (XP, streak)
    setLastCompletion(result)
    refreshKronos()  // async, non-blocking
  } catch {
    // 4. Rollback on error
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'todo' } : t
    ))
  }
}
```

### Keyboard Shortcut Hook
```typescript
// useKeyboardShortcut.ts
export function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA'].includes(tag)) return  // ignore when typing
      if (e.key.toLowerCase() === key.toLowerCase()) callback()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback])
}
```

### Priority Colors (consistent across app)
```typescript
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high:   'border-red-500',    // #ef4444
  medium: 'border-amber-500',  // #f59e0b
  low:    'border-slate-400',  // #94a3b8
}
```

### Category Icons (Lucide React)
```typescript
import { Heart, Brain, Shield, DollarSign, MessageCircle, Flame } from 'lucide-react'

export const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  vitality:   Heart,
  intellect:  Brain,
  discipline: Shield,
  wealth:     DollarSign,
  charisma:   MessageCircle,
  willpower:  Flame,
}
```

---

# ⛔ TASK SYSTEM — Constraints

## NEVER
- Hard delete any task — always soft delete (status='skipped')
- Create a new tasks table migration — it already exists
- Redefine `TaskCategory`, `TaskStatus` enums — import from kronos models
- Call XP engine with DB access — it must be a pure function
- Take `user_id` from request body — always from JWT token
- Block the response waiting for KRONOS refresh — always BackgroundTask
- Show `undefined`, `NaN`, or `null` raw in UI — always provide fallback

## Files to NOT Modify
- `001_kronos_schema.sql` — already migrated, do not touch
- `/app/agents/kronos/models.py` — enums are defined here, import don't copy
- `/app/core/auth.py` — auth dependency is shared
- `/app/core/database.py` — Supabase client setup is shared
- `/src/App.tsx` — only add route entries, nothing else

## Performance
- `get_daily_tasks` must return in < 500ms
- `get_weekly_tasks` must return in < 1 second
- Never fetch full task history — always date-bounded queries

---

# 📓 TASK SYSTEM — Decisions

## ADR-001: No Modal for QuickAdd
- **Date**: 2026-04-29
- **Status**: Accepted
- **Context**: Task creation is the highest-frequency action. Every extra click
  is friction that compounds over time.
- **Decision**: QuickAdd is always-visible input bar, not a modal. `N` shortcut
  focuses it from anywhere. Defaults minimize required input to just title + category.
- **Consequences**: QuickAdd bar takes permanent space in layout. Worth it.

## ADR-002: Soft Delete Only
- **Date**: 2026-04-29
- **Status**: Accepted
- **Context**: KRONOS analyzes behavioral patterns including skipped/missed tasks.
  Hard-deleting removes data that informs pattern analysis.
- **Decision**: DELETE endpoint sets status='skipped'. No hard deletes ever.
  Skipped tasks appear in KRONOS as 0% execution, not as missing data.
- **Consequences**: DB grows over time. Acceptable — tasks are small records.

## ADR-003: XP Engine as Pure Function
- **Date**: 2026-04-29
- **Status**: Accepted
- **Context**: XP formula will be tuned frequently as gamification is balanced.
  Mixing DB access with XP logic makes testing and iteration slow.
- **Decision**: `xp_engine.py` is a pure Python module. Takes `Task` + `streak int`,
  returns `(xp: int, bonuses: list[str])`. Zero DB access. 100% unit-testable.
- **Consequences**: Caller must fetch streak separately before calling compute_xp.

## ADR-004: Optimistic UI for Task Completion
- **Date**: 2026-04-29
- **Status**: Accepted
- **Context**: Task completion is the most satisfying moment in the app.
  Waiting 200-500ms for API response before showing feedback kills the feeling.
- **Decision**: Mark task as done in local state immediately. Show XP popup
  with estimated XP. Update with real values on API response. Rollback on error.
- **Consequences**: XP shown in popup may differ slightly from final if bonuses
  computed server-side differ from client estimate. Acceptable UX tradeoff.

---

# 📊 TASK SYSTEM — Progress

## ✅ Completed
*(nothing yet)*

## ⬜ Not Started
- Backend models (`task_models.py`)
- Task service (`task_service.py`)
- XP engine (`xp_engine.py`)
- API routes (`routers/tasks.py`)
- KRONOS integration (refresh_streaks)
- Frontend API client (`api/tasks.ts`)
- TaskContext + useTasks hook
- QuickAdd component
- TaskCard component
- XPPopup component
- DailyView component
- WeeklyView component
- BacklogView component
- CategoryFilter component
- TaskDashboard component
- React Router routes
- Tests (pytest + Playwright)

## 🚧 Known Blockers / Open Questions
- [ ] Confirm `TaskPriority` enum exists in `kronos/models.py` (added alongside TaskCategory/TaskStatus?)
- [ ] Confirm existing `get_current_user` dependency signature
- [ ] Confirm Supabase client is passed via `Depends()` or available as singleton
- [ ] Does existing dashboard have a route `/` or `/dashboard`? Tasks at `/tasks`?
- [ ] Is there an existing `UserProfile` or `XP` table, or does XP start fresh here?

## 📅 Suggested Implementation Order
1. task_models.py → verify imports from kronos.models work
2. xp_engine.py → pure functions, test immediately
3. task_service.py → core business logic
4. routers/tasks.py → wire service to HTTP
5. KRONOS integration → add refresh_streaks method
6. api/tasks.ts → TypeScript types + fetch functions
7. TaskContext.tsx + useTasks.ts → shared state
8. QuickAdd.tsx → highest priority component
9. TaskCard.tsx + XPPopup.tsx → atomic components
10. DailyView.tsx → uses TaskCard
11. WeeklyView.tsx → uses DailyView
12. BacklogView.tsx → simplest view
13. TaskDashboard.tsx → assembles everything
14. Tests → pytest then Playwright
