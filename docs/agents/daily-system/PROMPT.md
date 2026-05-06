# ⚡ DAILY SYSTEM — Stamina, Briefing & Quest Cards

## [ROLE / CONTEXT]

You are extending an existing Life OS application (FastAPI + React 18 + Supabase).
The system has tasks, habits, projects, KRONOS and ARES agents.

You are building the Daily System — a gamified energy management layer:
1. Morning Daily Briefing modal (sleep + energy sliders → stamina pool in minutes)
2. Task duration picker (hours/minutes drum-roll selector like iOS alarm)
3. Stamina Pool displayed as minutes — tasks consume it based on duration
4. Quick Stamina Boosts (coffee, nap, power nap, walk, etc.)
5. Quest Card redesign with AP cost, XP reward, Main Quest, Decay
6. Stamina Cutoff Line in calendar columns

NO avatar implementation in this phase.

---

## [STAMINA SYSTEM DESIGN]

### Units: Real Minutes

Stamina Pool is measured in **minutes**, not abstract points.
This makes it intuitive — if you have 480 stamina and a task costs 60 minutes, 
you literally have 8 hours of capacity left.

### Stamina Pool Calculation

```
Base Pool = ((Sleep Score + Energy Score) / 2) * 6
```

Examples:
- Sleep 100 + Energy 100 → Pool = 600 min (10h — peak day)
- Sleep 70 + Energy 70   → Pool = 420 min (7h — average day)
- Sleep 30 + Energy 40   → Pool = 210 min (3.5h — rough day)
- Sleep 0 + Energy 0     → Pool = 0 min (floor — handled gracefully)

Formula rationale: score 0–100 maps to 0–600 minutes (0–10 hours of productive work).

### AP Cost = Task Duration

```
ap_cost = estimated_minutes (directly)
```

No conversion needed. A 45-minute task costs 45 AP.
Regenerative tasks (walks, naps) have NEGATIVE ap_cost → restore stamina.

### Quick Boost Effects (in minutes)

| Boost | AP Restored | Cooldown | Notes |
|---|---|---|---|
| ☕ Kawa | +30 min | 4h | Stimulant — max 2x per day |
| 💤 Power Nap | +60 min | 6h | 20-min rest |
| 😴 Drzemka | +90 min | 8h | 45-min rest |
| 🚶 Spacer | +20 min | 2h | Walk — no limit |
| 💧 Nawodnienie | +10 min | 1h | Water — no limit |
| 🧘 Medytacja | +45 min | 6h | 10-min session |

Boosts are logged in `stamina_boosts` table with timestamp.
Cooldown prevents abuse — if boost used within cooldown period, button is disabled.

---

## [DATABASE CHANGES] (`migrations/009_daily_system.sql`)

```sql
-- Daily morning log
CREATE TABLE daily_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  sleep_score     SMALLINT NOT NULL CHECK (sleep_score BETWEEN 0 AND 100),
  energy_score    SMALLINT NOT NULL CHECK (energy_score BETWEEN 0 AND 100),
  stamina_pool    INTEGER NOT NULL,    -- computed: ((sleep+energy)/2)*6, in minutes
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Stamina boosts throughout the day
CREATE TABLE stamina_boosts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  boost_type      TEXT NOT NULL CHECK (boost_type IN (
                    'coffee','power_nap','nap','walk','water','meditation'
                  )),
  ap_restored     INTEGER NOT NULL,   -- minutes restored
  used_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add duration & quest fields to daily_tasks
ALTER TABLE daily_tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS ap_cost           INTEGER GENERATED ALWAYS AS (estimated_minutes) STORED,
  ADD COLUMN IF NOT EXISTS is_main_quest     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_regenerative   BOOLEAN NOT NULL DEFAULT false;

-- Add duration to project_tasks too
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- Add duration to habits
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- RLS
ALTER TABLE daily_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamina_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON daily_logs     FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner" ON stamina_boosts FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_daily_logs_user_date    ON daily_logs(user_id, date);
CREATE INDEX idx_stamina_boosts_user     ON stamina_boosts(user_id, date);
CREATE UNIQUE INDEX idx_main_quest_once  ON daily_tasks(user_id, scheduled_date)
  WHERE is_main_quest = true;  -- enforces max 1 main quest per day
```

---

## [BACKEND]

### `/app/services/daily_log_service.py`

```python
BOOST_CONFIG = {
    "coffee":     {"ap": 30,  "cooldown_hours": 4,  "max_per_day": 2},
    "power_nap":  {"ap": 60,  "cooldown_hours": 6,  "max_per_day": 1},
    "nap":        {"ap": 90,  "cooldown_hours": 8,  "max_per_day": 1},
    "walk":       {"ap": 20,  "cooldown_hours": 2,  "max_per_day": None},
    "water":      {"ap": 10,  "cooldown_hours": 1,  "max_per_day": None},
    "meditation": {"ap": 45,  "cooldown_hours": 6,  "max_per_day": 1},
}

async def create_daily_log(user_id, sleep_score, energy_score, notes=None) -> DailyLog:
    stamina_pool = int(((sleep_score + energy_score) / 2) * 6)
    # upsert — if already exists for today, update it
    ...

async def get_today_log(user_id) -> DailyLog | None

async def get_stamina_status(user_id, date) -> StaminaStatus:
    # Returns:
    # - base_pool (from daily_log)
    # - boosts_total (sum of all boosts today)
    # - ap_used (sum of estimated_minutes of completed tasks today, excluding regenerative)
    # - ap_restored (sum of estimated_minutes of completed regenerative tasks)
    # - ap_available = base_pool + boosts_total - ap_used + ap_restored
    # - tasks_breakdown: list of {task_title, ap_cost, is_completed}

async def use_boost(user_id, boost_type) -> BoostResult:
    # Check cooldown: last use of this boost_type within cooldown_hours? → raise 429
    # Check max_per_day: count today's uses >= max_per_day? → raise 429
    # Insert stamina_boosts record
    # Return BoostResult with new ap_available

async def get_boost_availability(user_id, date) -> list[BoostAvailability]:
    # For each boost type, return:
    # - is_available (bool)
    # - cooldown_remaining_minutes (if not available)
    # - uses_today / max_per_day
```

### `/app/routers/daily_system.py`

```
POST /api/v1/daily/log              → create/update today's daily log
GET  /api/v1/daily/log              → today's log (or null if not initialized)
GET  /api/v1/daily/log/{date}       → log for specific date
GET  /api/v1/daily/stamina          → full StaminaStatus for today
GET  /api/v1/daily/boosts           → availability of all boost types
POST /api/v1/daily/boosts/{type}    → use a boost
GET  /api/v1/daily/history          → last 14 days logs (for trend)
```

### Pydantic Models

```python
class DailyLog(BaseModel):
    id: str
    date: date
    sleep_score: int           # 0-100
    energy_score: int          # 0-100
    stamina_pool: int          # minutes: ((sleep+energy)/2)*6
    notes: str | None

class StaminaStatus(BaseModel):
    date: date
    base_pool: int             # from daily_log
    boosts_total: int          # sum of boost AP today
    ap_used: int               # minutes spent on completed tasks
    ap_restored: int           # minutes from regenerative tasks
    ap_available: int          # base_pool + boosts - used + restored
    percentage: float          # ap_available / base_pool * 100
    tasks_breakdown: list[TaskAPItem]
    is_initialized: bool       # false if no daily_log for today

class TaskAPItem(BaseModel):
    task_id: str
    title: str
    ap_cost: int
    is_completed: bool
    is_regenerative: bool

class BoostAvailability(BaseModel):
    boost_type: str
    label: str                 # "☕ Kawa"
    ap_restored: int
    is_available: bool
    cooldown_remaining_min: int | None
    uses_today: int
    max_per_day: int | None

class BoostResult(BaseModel):
    boost_type: str
    ap_restored: int
    new_ap_available: int
    cooldown_until: datetime
```

---

## [FRONTEND COMPONENTS]

### `DailyBriefingModal.tsx`

Shown on app load if no daily_log exists for today.
Cannot be dismissed without completing — user MUST initialize.

Layout:
```
┌─────────────────────────────────────────┐
│                                         │
│   🌅  Inicjalizacja Dnia               │
│   Środa, 29 Kwietnia 2026              │
│                                         │
│   😴 Jakość Snu                         │
│   [━━━━━━━━━━━━━━○──────────]  72       │
│   Kolor: żółty (score 72)               │
│                                         │
│   ⚡ Poziom Energii                      │
│   [━━━━━━━━━━━━━━━━━━━━━━━○─]  85       │
│   Kolor: zielony (score 85)             │
│                                         │
│   ┌─────────────────────────┐           │
│   │  💪 Stamina na dziś:    │           │
│   │     471 minut           │           │
│   │     (~7h 51min)         │           │
│   └─────────────────────────┘           │
│                                         │
│   [    ⚡ Inicjalizuj Dzień    ]        │
│                                         │
└─────────────────────────────────────────┘
```

Implementation details:
- Two range sliders, custom styled (no default browser appearance)
- Slider track color: linear-gradient based on value
  - 0-30: red (#ef4444)
  - 31-70: amber (#f59e0b)
  - 71-100: emerald (#10b981)
- Stamina preview updates in real-time as sliders move
- "Inicjalizuj Dzień" button: disabled until both sliders moved from default
- On submit: POST /api/v1/daily/log → fade-out animation → reveal main view
- Fade-in animation on modal mount (scale from 0.95 + opacity 0)

### `DurationPicker.tsx`

iOS alarm-style drum-roll picker for task duration.
Used in: QuickAdd, task edit form, habit creation.

```
┌─────────────────────────┐
│   Czas trwania zadania  │
│                         │
│   ┌──────┐  ┌──────┐   │
│   │  0   │  │  45  │   │
│   │ [1]  │  │ [50] │   │← selected (large, opaque)
│   │  2   │  │  55  │   │
│   └──────┘  └──────┘   │
│    godz.      min.      │
│                         │
│   Łącznie: 1h 50min     │
│   Koszt: -110 AP        │
└─────────────────────────┘
```

Implementation:
- Two scrollable columns: hours (0-12) and minutes (0, 5, 10, ..., 55)
- CSS scroll-snap for smooth selection
- Center item = selected, items above/below = smaller + transparent
- `onChange(totalMinutes: number)` callback
- Show computed AP cost below: `Koszt: -{minutes} AP`
- For regenerative tasks: `Zwrot: +{minutes} AP` in green

### `StaminaBar.tsx`

Persistent bar in top navigation / hero panel.

```
⚡ Stamina   [████████████████░░░░░░]  340 / 471 min
```

- Colored fill: green > 60%, amber 30-60%, red < 30%
- Animated decrease when task is completed
- Animated increase when boost used or regenerative task completed
- Click → opens StaminaDetailsPanel
- Pulsing animation when stamina < 20%

### `StaminaDetailsPanel.tsx`

Slide-in panel from right when StaminaBar is clicked.

```
┌─────────────────────────────────┐
│  ⚡ Stamina — Środa             │
│                                 │
│  Baza (sen 72 + energia 85)     │
│  471 min                        │
│                                 │
│  Wydane:    -131 min            │
│  Odzyskane: +0 min              │
│  Booosty:   +0 min              │
│  ─────────────────              │
│  Dostępne:  340 min (~5h 40m)   │
│                                 │
│  ═══ SZYBKIE BOOOSTY ═══        │
│  [☕ Kawa +30]  [🚶 Spacer +20] │
│  [💤 Power Nap +60]             │
│  [😴 Drzemka  — cooldown 3h]   │
│  [🧘 Medytacja +45]            │
│  [💧 Woda +10]                  │
│                                 │
│  ═══ ZUŻYCIE DZIŚ ═════         │
│  ✅ Bieg 5km         -60 min    │
│  ⬜ Nauka Python     -90 min    │
│  ⬜ Praca nad proj.  -120 min   │
└─────────────────────────────────┘
```

Boost buttons:
- Available: colored button with AP amount
- On cooldown: grayed out, shows "cooldown Xh Xmin" countdown
- Max uses reached: grayed out, "Limit dzienny"
- On click: POST /api/v1/daily/boosts/{type} → animate stamina bar increase
- Floating text on boost use: "+30 AP ☕" floats up from button

### `QuestCard.tsx` (redesign of TaskCard)

```
┌─ [category color border] ──────────────────┐
│ 👑 [MAIN QUEST badge — gold]               │  ← only if is_main_quest
│                                             │
│  Nauka Python — Rozdział 7                 │
│  🏷️ intellect    ⏱️ 1h 30min               │
│                                             │
│  [-90 AP]              [+75 XP]            │
│  red if over stamina   gold text           │
│                                             │
│  [○ Oznacz jako gotowe]                    │
└─────────────────────────────────────────────┘
```

States:
- **Normal**: white/dark card, colored left border
- **Main Quest**: golden border glow, crown icon, 👑 badge top-right
- **Regenerative**: green AP cost (`+15 AP`), leaf/heart icon
- **Over stamina limit**: red tinted background, AP cost in red
- **Overdue (decay)**: desaturated colors, crack/rust texture overlay (CSS filter + pseudo-element)
- **Completed**: strike-through title, checkmark, muted colors

Decay visual (CSS):
```css
.quest-card--decayed::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 8px,
    rgba(180, 83, 9, 0.15) 8px,
    rgba(180, 83, 9, 0.15) 10px
  );
  border-radius: inherit;
  pointer-events: none;
}
```

### `StaminaCutoffLine.tsx`

Visual red line in day column when tasks exceed stamina pool.

Logic (computed on frontend):
```typescript
const computeCutoff = (tasks: Task[], staminaPool: number) => {
  let cumulative = 0
  let cutoffIndex = -1
  
  for (let i = 0; i < tasks.length; i++) {
    cumulative += tasks[i].estimated_minutes ?? 0
    if (cumulative > staminaPool && cutoffIndex === -1) {
      cutoffIndex = i  // line goes BEFORE this task
    }
  }
  return cutoffIndex
}
```

Renders as:
- Red dashed horizontal line between cards
- Label: "⚠️ Przekroczono Staminę (+{overMinutes} min)"
- Tasks below line: red-tinted background

### `FloatingCombatText.tsx` (extends existing XPPopup)

Multiple simultaneous floating texts:
- `+75 XP` → gold, floats up to top bar
- `+20 Siła` → red, floats toward Vitality stat bar
- `+15 AP ☕` → yellow, floats toward Stamina bar
- `-60 AP` → when task started (optional)

```typescript
interface FloatingText {
  id: string
  text: string
  color: string
  targetRef?: React.RefObject<HTMLElement>  // animate toward this element
  origin: { x: number, y: number }
}
```

### `FogOfWar.tsx`

Wrapper for day columns. Applied to columns where `date > today + 2`.

```typescript
const fogLevel = daysDiff > 2
  ? Math.min((daysDiff - 2) * 15, 60)  // 15% per extra day, max 60%
  : 0

// Applied as:
<div style={{ opacity: 1 - fogLevel/100 }} onMouseEnter={clearFog} onMouseLeave={restoreFog}>
```

---

## [QUICKADD UPDATES]

Add to QuickAdd form:
1. `DurationPicker` component (drum-roll selector)
2. Toggle: "🌿 Zadanie regeneratywne" (restores AP instead of costing it)
3. Toggle: "👑 Main Quest" (only one allowed per day — disable if already set)
4. AP preview: "Koszt: -90 AP" or "Zwrot: +15 AP" shown below picker

---

## [EDGE CASES]

- No daily_log for today → stamina bar shows "Niezainicjalizowany" + button to open briefing
- estimated_minutes = null → ap_cost = null, task shows "– AP" (no contribution to cutoff)
- Stamina goes to 0 → bar shows empty, red, no negative values
- Main Quest already set for today → "👑 Główny Quest" toggle is disabled in QuickAdd
- Boost on cooldown → 429 response with `cooldown_remaining_seconds` in body
- Regenerative task completed → ap_restored increases, stamina bar animates up
- Daily log submitted twice → upsert (update existing record for today)
- Sleep score 0 + Energy score 0 → stamina_pool = 0, show special empty state "Dzień regeneracji"

---

## [ADDITIONAL INSTRUCTIONS]

- DurationPicker minutes column: steps of 5 (0, 5, 10, ..., 55)
- DurationPicker hours column: 0–12
- Stamina bar lives in the top navigation bar — always visible
- StaminaDetailsPanel opens as slide-in from right (not a modal)
- All boost labels in Polish with emoji
- Cooldown countdown updates every minute (use setInterval in component)
- Sound on task complete: short chime using Web Audio API (no file required):
  ```javascript
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  osc.connect(ctx.destination)
  osc.frequency.value = 523.25  // C5
  osc.start(); osc.stop(ctx.currentTime + 0.15)
  ```
- Sound on boost use: slightly different frequency (659.25 Hz = E5)
- All monetary/time values: minutes displayed as "Xh Ym" when >= 60 min

Think step by step. Start with database migration.
