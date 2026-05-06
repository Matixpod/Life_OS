# 🏗️ REDESIGN — Architecture

## Navigation & Routing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     SIDEBAR NAVIGATION                          │
│                                                                 │
│  📊 Dashboard                                                   │
│  📅 Kalendarz        ← unified: tasks + habits + projects       │
│  🔄 Habity           ← manage recurring habits                  │
│  📁 Projekty         ← project → section → task hierarchy       │
│  ─────────────────                                              │
│  ❤️  ARES (Vitality)                                            │
│  🧠 ATHENA (Intellect)                                          │
│  ⚔️  KRONOS (Discipline)                                        │
│  ─────────────────                                              │
│  ⚙️  Ustawienia                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Smart Navigation: Calendar → Agent

```
User clicks item in Calendar
        │
        ▼
CalendarItem.agent_route  (set by backend based on category)
        │
  vitality  → /ares
  intellect → /athena
  discipline→ /kronos
  wealth    → /plutus
  charisma  → /hermes
  willpower → /prometheus
        │
        ▼
navigate(agent_route, { state: { focusItemId: item.id } })
        │
        ▼
Agent tab mounts → checks location.state.focusItemId
        │
        ▼
Scrolls to + highlights relevant task in agent's list
```

## Task Type Architecture

```
TASK (type='task')
├── One-time action
├── Lives in daily_tasks table
├── scheduled_date = specific date
└── Linked to agent via category

HABIT ENTRY (type='habit_entry')
├── Auto-generated daily instance
├── Lives in daily_tasks table (habit_id FK → habits)
├── Parent: habits table (stores recurrence rules + streak)
└── generate_habit_entries() creates these idempotently per day

PROJECT TASK (type='project_task')
├── Lives in project_tasks table
├── Linked to project_sections → projects
├── Can appear in Calendar on due_date
└── Does NOT affect KRONOS streaks (separate domain)
```

## Agent Proposal Flow

```
ARES finishes streaming analysis
        │
        ▼
ares_agent.py calls propose_task(
  agent_id="ares",
  title="Bieg 5km — uzupełnienie tygodnia",
  category=VITALITY,
  date=tomorrow,
  reason="Brakuje 1 treningu do celu tygodniowego"
)
        │
        ▼
agent_task_proposals table:
  status='pending', expires_at=now()+7days
        │
        ▼
Frontend Calendar shows ProposalCard (dashed border)
        │
  User clicks ✓              User clicks ✗
        │                           │
approve_proposal()           reject_proposal()
creates DailyTask            status='rejected'
        │
        ▼
Task appears in Calendar as normal item
ARES proposal disappears (slide-out animation)
```

## Recurrence Logic Decision Tree

```
should_habit_appear(habit, date):
  │
  ├── recurrence_type = 'daily'         → always True
  │
  ├── recurrence_type = 'weekly'        → date.isoweekday() == habit.selected_days[0]
  │
  ├── recurrence_type = 'selected_days' → date.isoweekday() in habit.selected_days
  │
  ├── recurrence_type = 'monthly'       → date.day == habit.monthly_day
  │                                        (False if day doesn't exist in month)
  │
  └── recurrence_type = 'custom'        → parse custom_rule JSON
      ├── {interval: 3, unit: 'days'}   → (date - start_date).days % 3 == 0
      ├── {times: 2, per: 'week'}       → count completions this week < 2
      └── {interval: 2, unit: 'weeks'}  → week_number % 2 == 0
```

## Database Relationships

```
auth.users
    │
    ├── daily_tasks (task_type='task')
    │       └── task_type='habit_entry' ──→ habits
    │
    ├── habits
    │       └── generates → daily_tasks (habit_entry)
    │
    ├── projects
    │       └── project_sections
    │               └── project_tasks
    │
    └── agent_task_proposals
            └── on approve → daily_tasks or habits
```

## Category → Color System (consistent across all views)

```typescript
export const CATEGORY_COLORS = {
  vitality:   { bg: 'bg-red-500',    text: 'text-red-500',    border: 'border-red-500'    },
  intellect:  { bg: 'bg-blue-500',   text: 'text-blue-500',   border: 'border-blue-500'   },
  discipline: { bg: 'bg-amber-500',  text: 'text-amber-500',  border: 'border-amber-500'  },
  wealth:     { bg: 'bg-green-500',  text: 'text-green-500',  border: 'border-green-500'  },
  charisma:   { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
  willpower:  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
}
```

## Key Design Decisions

**daily_tasks as unified base** — habit entries and regular tasks both live in
`daily_tasks`. This means KRONOS streak tracking works for habit entries too
without any changes — it queries `daily_tasks` and now gets both types.

**Project tasks separate** — `project_tasks` is a separate table because projects
have fundamentally different semantics (sections, ordering, no dates usually).
They appear in Calendar on due_date but don't feed KRONOS.

**Proposals expire** — 7 day TTL prevents stale suggestions cluttering calendar.
Expired proposals return 410 on approve attempt.

**agent_route in API response** — routing logic lives in backend, not frontend.
Frontend just calls `navigate(item.agent_route)`. Adding a new agent = add one
line to `CATEGORY_TO_AGENT_ROUTE` dict. Zero frontend changes needed.

**Idempotent habit generation** — calling `generate_habit_entries` multiple times
for the same date is safe. Prevents duplicate entries if calendar is loaded twice.
