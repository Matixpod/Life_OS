# Life OS — Autonomous Build Plan

This file drives the entire build. Execute each phase completely and verify it before proceeding.
Update `docs/PROGRESS.md` checkboxes as you complete each step.

---

## PHASE 0 — Environment Verification & Setup

**Goal:** All tools installed, env vars set, project structure created.

### Steps

1. **Verify required tools**
```bash
python3 --version   # must be 3.12+
node --version      # must be 20+
pnpm --version      # any recent version
git --version
```

2. **Create project structure**
```bash
mkdir -p backend/core backend/models backend/routers backend/services
mkdir -p frontend/src/components frontend/src/pages frontend/src/layouts
mkdir -p frontend/src/services frontend/src/types frontend/src/utils
mkdir -p mcp migrations screenshots docs
mkdir -p .claude/commands
```

3. **Check for .env files**
   - `backend/.env` must contain: `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`
   - `frontend/.env` must contain: `VITE_API_URL=http://localhost:8000`
   - If missing: **STOP and ask user to provide values. List exactly what's needed.**

4. **Create backend/.env.example**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
```

5. **Create frontend/.env.example**
```
VITE_API_URL=http://localhost:8000
```

6. **Create start-lifeos.sh**
```bash
#!/bin/bash
SESSION="lifeos"
tmux has-session -t $SESSION 2>/dev/null
if [ $? == 0 ]; then tmux attach -t $SESSION; exit 0; fi
tmux new-session -d -s $SESSION -n "claude"
tmux send-keys -t $SESSION:0 "cd $(pwd) && claude" Enter
tmux new-window -t $SESSION:1 -n "backend"
tmux send-keys -t $SESSION:1 "cd $(pwd)/backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000" Enter
tmux new-window -t $SESSION:2 -n "frontend"
tmux send-keys -t $SESSION:2 "cd $(pwd)/frontend && pnpm dev" Enter
tmux new-window -t $SESSION:3 -n "logs"
tmux select-window -t $SESSION:0
tmux attach -t $SESSION
```
```bash
chmod +x start-lifeos.sh
```

### ✅ Phase 0 verification
```bash
python3 --version && node --version && pnpm --version
cat backend/.env | grep SUPABASE_URL   # must show a value
cat frontend/.env | grep VITE_API_URL  # must show http://localhost:8000
```

---

## PHASE 1 — Database: Supabase Schema

**Goal:** All 16 tables created in Supabase with pgvector extension enabled.

### Steps

1. **Check if migrations/001_initial_schema.sql exists** (it should be in the package)
2. **Instruct user:**
   > "Open your Supabase project → SQL Editor → paste and run migrations/001_initial_schema.sql. Then run migrations/002_seed_data.sql. Reply 'done' when finished."
3. **Wait for user confirmation before proceeding.**
4. **Verify** by checking the schema via Supabase client (or ask user to confirm tables exist):
   - Tables: users, daily_summaries, goals, sleep_entries, supplement_items, supplement_logs, workout_sessions, cognitive_challenges, mental_health_logs, body_metrics, nutrition_logs, deep_work_sessions, learning_logs, daily_intelligence, periodic_reviews, agent_memories, streak_history

### ✅ Phase 1 verification
User confirms tables created. Note: you cannot directly verify Supabase from CLI without the backend — this is verified implicitly in Phase 3 when the backend connects successfully.

---

## PHASE 2 — MCP Server Setup

**Goal:** Life OS MCP server running and registered with Claude Code.

### Steps

1. **Install FastMCP**
```bash
cd backend && source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install fastmcp httpx python-dotenv
```

2. **Create `mcp/lifeos_mcp.py`**

```python
#!/usr/bin/env python3
"""
Life OS MCP Server
Gives Claude Code direct access to Life OS data and actions.
"""
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

# Load .env from backend/
env_path = Path(__file__).parent.parent / "backend" / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

import httpx
from fastmcp import FastMCP

BASE_URL = os.getenv("LIFEOS_API_URL", "http://localhost:8000")
mcp = FastMCP("Life OS")


def api_get(path: str) -> dict:
    try:
        r = httpx.get(f"{BASE_URL}{path}", timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def api_post(path: str, data: dict) -> dict:
    try:
        r = httpx.post(f"{BASE_URL}{path}", json=data, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}


# ─── TOOLS ────────────────────────────────────────────────────────────────────

@mcp.tool()
def get_health() -> dict:
    """Check if the Life OS backend is running."""
    return api_get("/health")


@mcp.tool()
def get_user_profile() -> dict:
    """Get the user's profile: name, streak, system start date."""
    return api_get("/api/v1/user/profile")


@mcp.tool()
def get_today_summary() -> dict:
    """
    Get today's full dashboard summary across all 12 modules.
    Returns potential_score and status of each module.
    """
    today = str(date.today())
    return api_get(f"/api/v1/dashboard/daily-summary?date={today}")


@mcp.tool()
def get_summary_for_date(target_date: str) -> dict:
    """
    Get dashboard summary for a specific date (YYYY-MM-DD).
    Use this to retrieve historical data.
    """
    return api_get(f"/api/v1/dashboard/daily-summary?date={target_date}")


@mcp.tool()
def get_last_n_days(n: int = 7) -> list:
    """
    Get daily summaries for the last N days. Default 7 days.
    Use for trend analysis and review generation.
    """
    results = []
    for i in range(n):
        d = str(date.today() - timedelta(days=i))
        results.append({"date": d, "data": api_get(f"/api/v1/dashboard/daily-summary?date={d}")})
    return results


@mcp.tool()
def log_sleep(
    duration_minutes: int,
    quality_score: int,
    energy_score: int,
    morning_mood: int
) -> dict:
    """
    Log sleep data for today.
    - duration_minutes: total sleep (e.g. 450 = 7h30m)
    - quality_score: 1-5 stars
    - energy_score: 0-100 slider
    - morning_mood: 2=😴 4=😕 5=😐 7=🙂 10=⚡
    """
    return api_post("/api/v1/sleep/log", {
        "date": str(date.today()),
        "duration_minutes": duration_minutes,
        "quality_score": quality_score,
        "energy_score": energy_score,
        "morning_mood": morning_mood
    })


@mcp.tool()
def log_workout(
    workout_type: str,
    label: str,
    muscle_groups: list,
    duration_minutes: int
) -> dict:
    """
    Log a workout session for today.
    - workout_type: 'strength' | 'cardio' | 'flexibility' | 'sport'
    - label: e.g. 'Push Day', '5km Run'
    - muscle_groups: ['chest', 'triceps', 'shoulders'] etc.
    - duration_minutes: session length
    """
    return api_post("/api/v1/workout/log", {
        "date": str(date.today()),
        "type": workout_type,
        "label": label,
        "muscle_groups": muscle_groups,
        "duration_minutes": duration_minutes
    })


@mcp.tool()
def log_mood(mood_score: int, energy_score: int, stress_score: int, journal_text: str = "") -> dict:
    """
    Log mental health check-in for today.
    All scores 1-10. stress_score: 10 = maximum stress.
    journal_text is optional free-form entry.
    """
    return api_post("/api/v1/mental-health/log", {
        "date": str(date.today()),
        "mood_score": mood_score,
        "energy_score": energy_score,
        "stress_score": stress_score,
        "journal_text": journal_text
    })


@mcp.tool()
def get_cognitive_challenge() -> dict:
    """Get today's cognitive challenge: title, difficulty, URL, timer duration, status."""
    return api_get("/api/v1/cognitive/today")


@mcp.tool()
def complete_cognitive_challenge(time_spent_seconds: int, ai_help_used: bool = False) -> dict:
    """Mark today's cognitive challenge as completed."""
    return api_post("/api/v1/cognitive/complete", {
        "date": str(date.today()),
        "time_spent_seconds": time_spent_seconds,
        "ai_help_used": ai_help_used
    })


@mcp.tool()
def get_daily_intelligence() -> dict:
    """Get today's curated news items (3) and quote of the day. Generates fresh if not yet done."""
    return api_get("/api/v1/intelligence/today")


@mcp.tool()
def generate_weekly_review() -> dict:
    """
    Trigger AI generation of a weekly review.
    Compresses the week's data into a context snapshot for agent memory.
    This may take 15-30 seconds.
    """
    return api_post("/api/v1/review/generate", {"type": "weekly"})


@mcp.tool()
def get_streak_info() -> dict:
    """Get current streak count, longest streak, and recent streak history."""
    return api_get("/api/v1/user/streak")


# ─── RESOURCES ────────────────────────────────────────────────────────────────

@mcp.resource("lifeos://today")
def today_resource() -> str:
    """Full today's dashboard — use as context when analyzing the user's day."""
    data = api_get(f"/api/v1/dashboard/daily-summary?date={date.today()}")
    return json.dumps(data, indent=2)


@mcp.resource("lifeos://user")
def user_resource() -> str:
    """User profile — use as context for personalized responses."""
    data = api_get("/api/v1/user/profile")
    return json.dumps(data, indent=2)


if __name__ == "__main__":
    mcp.run()
```

3. **Update `.claude/settings.json`** — ensure the lifeos MCP path uses absolute path:
```bash
# Get absolute path
ABSPATH=$(pwd)/mcp/lifeos_mcp.py
echo "Absolute path: $ABSPATH"
```
Update `.claude/settings.json`:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    },
    "lifeos": {
      "command": "python",
      "args": ["REPLACE_WITH_ABSOLUTE_PATH/mcp/lifeos_mcp.py"]
    }
  }
}
```

4. **Install python-dotenv in backend venv**
```bash
cd backend && source .venv/bin/activate && pip install python-dotenv
```

### ✅ Phase 2 verification
```bash
# Test MCP server starts without errors
cd backend && source .venv/bin/activate && python ../mcp/lifeos_mcp.py &
sleep 2
# It should start silently (waiting for MCP client). Kill it:
kill %1
echo "MCP server OK"
```
Note: Full MCP verification (tools showing in `/mcp`) requires restarting Claude Code after settings.json update.

---

## PHASE 3 — FastAPI Backend

**Goal:** Backend running on :8000 with all endpoints returning valid responses.

### Steps

1. **Install Python dependencies**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic python-dotenv supabase anthropic httpx ruff
pip freeze > requirements.txt
```

2. **Create `backend/core/config.py`**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    anthropic_api_key: str
    
    class Config:
        env_file = ".env"

settings = Settings()
```
```bash
pip install pydantic-settings
```

3. **Create `backend/core/supabase_client.py`**
```python
from supabase import create_client, Client
from .config import settings

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client
```

4. **Create all Pydantic models** in `backend/models/` — one file per domain:
   - `user.py` — UserProfile
   - `dashboard.py` — DailySummary, all 12 ModuleSummary types
   - `sleep.py` — SleepLogRequest, SleepEntry
   - `cognitive.py` — CognitiveChallenge, CompleteRequest, ExplainRequest
   - `intelligence.py` — NewsItem, DailyIntelligence
   - `review.py` — PeriodicReview
   
   All types must match exactly the TypeScript interfaces in `@docs/DATA_MODELS.md`.

5. **Create all routers** in `backend/routers/`:
   - `health.py` → `GET /health`
   - `user.py` → `GET /api/v1/user/profile`, `GET /api/v1/user/streak`
   - `dashboard.py` → `GET /api/v1/dashboard/daily-summary`
   - `sleep.py` → `POST /api/v1/sleep/log`
   - `cognitive.py` → `GET /api/v1/cognitive/today`, `POST /api/v1/cognitive/complete`, `POST /api/v1/cognitive/explain` (streaming)
   - `intelligence.py` → `GET /api/v1/intelligence/today`
   - `review.py` → `POST /api/v1/review/generate`, `GET /api/v1/review/list`
   - `workout.py` → `POST /api/v1/workout/log`
   - `mental_health.py` → `POST /api/v1/mental-health/log`

6. **Create all services** in `backend/services/`:
   - `dashboard_service.py` — aggregate all 12 module tables
   - `sleep_service.py`
   - `cognitive_service.py` — Socratic Claude streaming
   - `intelligence_service.py` — Claude + web search, cache logic
   - `review_service.py` — full review + compression

7. **Create `backend/main.py`**
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import health, user, dashboard, sleep, cognitive, intelligence, review, workout, mental_health

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Life OS API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(user.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(sleep.router, prefix="/api/v1")
app.include_router(cognitive.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(review.router, prefix="/api/v1")
app.include_router(workout.router, prefix="/api/v1")
app.include_router(mental_health.router, prefix="/api/v1")
```

8. **Start backend**
```bash
cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000
```

### ✅ Phase 3 verification
```bash
curl -s http://localhost:8000/health | python3 -m json.tool
# Expected: {"status": "ok", "version": "1.0.0", "timestamp": "..."}

curl -s http://localhost:8000/api/v1/user/profile | python3 -m json.tool
# Expected: user profile JSON (from seed data)

curl -s "http://localhost:8000/api/v1/dashboard/daily-summary" | python3 -m json.tool
# Expected: DailySummary JSON with potential_score and all 12 module summaries

# Lint check
cd backend && ruff check .
# Expected: no errors
```

**If any curl returns an error or non-200:** Fix before continuing.

---

## PHASE 4 — React Frontend Scaffold

**Goal:** Vite dev server running on :5173 with routing and layout working.

### Steps

1. **Initialize Vite + React + TypeScript**
```bash
pnpm create vite frontend --template react-ts
cd frontend
pnpm install
```

2. **Install dependencies**
```bash
pnpm add react-router-dom recharts lucide-react react-markdown
pnpm add -D tailwindcss @tailwindcss/typography autoprefixer postcss
npx tailwindcss init -p
```

3. **Configure TailwindCSS** — `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#12121A',
        accent: { blue: '#3B82F6', amber: '#F59E0B', emerald: '#10B981' }
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
} satisfies Config
```

4. **Add Google Fonts** to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

5. **Add Tailwind directives** to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { background-color: #0A0A0F; color: white; font-family: 'Sora', sans-serif; }
```

6. **Create `src/types/index.ts`** — copy all interfaces from `@docs/DATA_MODELS.md` TypeScript section exactly.

7. **Create `src/services/api.ts`** — typed fetch wrapper with all API call functions. Base URL from `import.meta.env.VITE_API_URL`.

8. **Create `src/utils/date.ts`** — date formatting helpers.

9. **Create `src/layouts/DashboardLayout.tsx`** — Sidebar + TopBar + `<Outlet />`

10. **Create `src/components/Sidebar.tsx`** — grouped nav (DAILY / TRACKING / INSIGHTS / YOU), collapse button, streak counter at bottom.

11. **Create `src/components/TopBar.tsx`** — date + day (left), notification bell + avatar (right).

12. **Create `App.tsx`** with all routes:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
// All page imports...

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/supplements" element={<Supplements />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/cognitive" element={<Cognitive />} />
          <Route path="/mental-health" element={<MentalHealth />} />
          <Route path="/body" element={<Body />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/deep-work" element={<DeepWork />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/review" element={<Review />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

13. **Create placeholder pages** for all 12 modules + Profile — each shows module icon, name, "Coming soon" text, and the sidebar stays active.

14. **Start frontend**
```bash
cd frontend && pnpm dev
```

### ✅ Phase 4 verification
```bash
# TypeScript check
cd frontend && pnpm tsc --noEmit
# Expected: 0 errors

# ESLint
cd frontend && pnpm lint
# Expected: 0 errors
```

**Playwright visual check:**
1. Open `localhost:5173` via Playwright
2. Take screenshot — verify: dark background, sidebar visible with all nav items, topbar visible
3. Click each sidebar nav item — verify routing works (URL changes, active state updates)
4. Resize to 375px — verify sidebar collapses or becomes a bottom tab bar
5. Fix any visual or routing issues before proceeding

---

## PHASE 5 — Dashboard Page

**Goal:** Main dashboard with score gauge, 12 module cards, streak banner, all fetching real data.

### Components to build (in order):

1. **`src/components/PotentialScoreGauge.tsx`**
   - SVG circular gauge, animated stroke-dashoffset on mount
   - Score number in JetBrains Mono (large, centered)
   - "Daily Potential" label below
   - Props: `score: number, isLoading: boolean`

2. **`src/components/StreakBanner.tsx`**
   - Full-width bar below gauge
   - Streak chip: blue (1–7 days), amber (8–21), emerald with glow (22+)
   - Text: "🔥 {n}-day streak — {motivational phrase}"
   - Props: `streakDays: number`

3. **`src/components/LoadingSkeleton.tsx`**
   - Pulsing grey skeleton variant sized like a ModuleCard
   - Used for 1.5s on initial load

4. **`src/components/ModuleCard.tsx`**
   - Icon (Lucide), module name, primary metric in JetBrains Mono
   - Status badge: Completed (emerald) / In Progress (blue) / Pending (amber) / Locked (grey)
   - Hover: scale(1.02) + border color change
   - onClick: navigate to module route
   - Props: `module: ModuleConfig, data: ModuleSummary | null, isLoading: boolean`

5. **`src/components/ActivityTimeline.tsx`**
   - Vertical timeline of today's logged events
   - 4 items max, shows time + action + module icon
   - Mocked initially with realistic placeholder data

6. **`src/components/QuickAddFAB.tsx`**
   - Floating button bottom-right (+ icon)
   - Opens modal with 12 module shortcuts

7. **`src/pages/Dashboard.tsx`**
   - Fetch `GET /api/v1/dashboard/daily-summary` on mount
   - Show skeletons for 1.5s then real cards
   - Show `ErrorBanner` if API unreachable
   - Check `localStorage` key `lifeos_morning_{date}` → if missing, show `MorningPopup`
   - Layout: hero (gauge + streak) → 3-col card grid → activity timeline

### ✅ Phase 5 verification

**Backend:**
```bash
curl -s "http://localhost:8000/api/v1/dashboard/daily-summary" | python3 -m json.tool
# Expected: all 12 module summaries present
```

**Playwright visual check:**
1. Open `localhost:5173`
2. Take screenshot — verify: gauge visible with score, 12 cards in grid, streak banner
3. Verify loading skeletons appear for ~1.5s on hard refresh
4. Verify all 12 cards have: icon, name, metric, status badge
5. Hover over cards — verify scale animation
6. Verify JetBrains Mono font is used for numbers (visually distinct)
7. Mobile (375px): verify single-column layout

---

## PHASE 6 — Morning Popup (Sleep & Energy)

**Goal:** Beautiful modal appears on first daily visit, collects sleep/energy data, saves to DB.

### Components to build:

1. **`src/components/MorningPopup.tsx`**

   **Fields:**
   - Sleep duration: two number inputs (hours 0–12, minutes 0–59) with +/− stepper buttons
   - Sleep quality: 5 star icons, clickable, filled state
   - Energy score: `<input type="range" min="0" max="100">` with gradient track (red→amber→green) and live number display in JetBrains Mono
   - Morning mood: 5 large emoji buttons `😴 😕 😐 🙂 ⚡`, one selectable at a time

   **Behavior:**
   - Modal covers screen with blur backdrop (`backdrop-blur-sm bg-black/70`)
   - Entrance: slide-up animation (`translate-y` + `opacity` transition)
   - "Start my day →" button: disabled until mood is selected
   - On submit: `POST /api/v1/sleep/log` → set `localStorage` `lifeos_morning_{date}` → close
   - "Skip today": set localStorage with null values → close (no API call)

2. **Add to `Dashboard.tsx`**: check localStorage on mount, render `<MorningPopup />` if key not set.

### ✅ Phase 6 verification

**Backend:**
```bash
curl -s -X POST http://localhost:8000/api/v1/sleep/log \
  -H "Content-Type: application/json" \
  -d '{"date":"'$(date +%Y-%m-%d)'","duration_minutes":450,"quality_score":4,"energy_score":78,"morning_mood":7}' \
  | python3 -m json.tool
# Expected: success response with saved data
```

**Playwright visual check:**
1. Clear localStorage (open devtools → Application → Clear) then reload
2. Verify morning popup appears automatically
3. Screenshot the popup — verify all 4 input areas visible
4. Fill: set hours to 7, minutes to 30, click 4 stars, drag energy to 75, click 🙂
5. Verify "Start my day →" button becomes active
6. Click submit — verify popup closes, dashboard shows
7. Reload — verify popup does NOT appear again (localStorage key set)
8. Click "Skip today" path: clear localStorage, reload, click skip → verify closes without saving

---

## PHASE 7 — Cognitive Challenge Page

**Goal:** Challenge page with countdown timer (persisted across browser restarts) and Socratic AI chat.

### Components to build:

1. **`src/components/ChallengeTimer.tsx`**

   **Timer logic:**
   ```
   On mount:
     1. Read localStorage key: lifeos_timer_{date} = { startedAt, duration, paused, elapsed }
     2. If exists and startedAt: calculate remaining = duration - (now - startedAt + elapsed)
     3. If remaining <= 0: set state to 'expired'
     4. Else: set remaining, resume from where it left off
   
   On start: save { startedAt: Date.now(), duration, elapsed: 0 } to localStorage
   On pause: save { paused: true, elapsed: elapsed + (now - startedAt) }
   On reset: remove localStorage key, reset all state
   ```

   **Visual:**
   - SVG circle ring: `stroke-dashoffset` animated via `requestAnimationFrame` or `useEffect` + interval
   - Large `MM:SS` display in JetBrains Mono (size: 4rem)
   - Ring color: green (>50%), amber (20–50%), red (<20%)
   - Below ring: `[Start] [Pause] [Reset]` buttons

2. **`src/components/SocraticChat.tsx`**
   - Chat panel that slides in (translate-x transition) when `isUnlocked = true`
   - Input at bottom, messages list above
   - Calls `POST /api/v1/cognitive/explain` with streaming
   - Renders streamed text progressively
   - Shows "🔒 Timer must expire or click 'I need help' to unlock" when locked

3. **`src/pages/Cognitive.tsx`**
   - Fetch `GET /api/v1/cognitive/today` on mount
   - Show: challenge title, difficulty badge, "Open Challenge →" button (external link, new tab)
   - Difficulty → timer duration: easy=900s, medium=1800s, hard=2700s
   - AI unlocks when: timer expires OR user clicks "I need help" (after timer started)
   - "Mark as Completed ✓" → `POST /api/v1/cognitive/complete`

**Backend — `cognitive_service.py`** (streaming):
```python
async def explain_challenge(challenge_title: str, user_question: str):
    client = anthropic.Anthropic()
    system_prompt = """You are a patient CS and math tutor. The user attempted a challenge 
    and their timer expired. Guide them toward understanding using the Socratic method.
    Ask questions that lead to insights. Reveal one concept at a time.
    Never provide the complete solution directly. Foster genuine understanding."""
    
    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": f"Challenge: {challenge_title}\n\nQuestion: {user_question}"}]
    ) as stream:
        for text in stream.text_stream:
            yield text
```

### ✅ Phase 7 verification

**Backend:**
```bash
curl -s http://localhost:8000/api/v1/cognitive/today | python3 -m json.tool
# Expected: today's challenge with title, difficulty, timer_seconds
```

**Playwright visual check:**
1. Navigate to `/cognitive`
2. Screenshot — verify challenge displayed, timer at 00:00 idle state
3. Click "Start Timer" — screenshot — verify timer counting down, ring animating
4. Click "Pause" — screenshot — verify timer stops
5. Simulate expiry: manually set timer to 5s (or test via state)
6. When expired: verify AI chat panel slides in
7. Type a question in chat — verify it calls backend and streams response
8. Test timer persistence: start timer, navigate away to `/`, navigate back to `/cognitive` — verify timer resumed from correct position

---

## PHASE 8 — Daily Intelligence Page

**Goal:** 3 AI-curated news cards + quote, generated fresh daily via Claude with web search.

### Backend — `intelligence_service.py`:
```python
async def get_or_generate_intelligence(supabase, user_id: str, target_date: str) -> dict:
    # Check if today's intelligence already exists in DB
    result = supabase.table("daily_intelligence")\
        .select("*")\
        .eq("date", target_date)\
        .execute()
    
    if result.data:
        return result.data[0]
    
    # Generate fresh via Claude API with web search
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        system="""You are an intelligence curator for a high-performance individual focused on 
        health optimization, longevity, cognitive performance, and self-improvement.
        Find 3 recent, research-backed insights on these topics.
        Also select 1 powerful quote from a great thinker, philosopher, or scientist.
        Return ONLY valid JSON, no markdown, no preamble:
        {
          "news_items": [
            {"title": "...", "summary": "2 sentence summary", "source_url": "...", "category": "health|science|psychology|tech|productivity"}
          ],
          "quote": "...",
          "quote_author": "..."
        }""",
        messages=[{"role": "user", "content": f"Generate today's ({target_date}) intelligence digest."}]
    )
    
    # Parse JSON from response
    import json
    text = next(b.text for b in response.content if b.type == "text")
    data = json.loads(text)
    
    # Save to DB
    record = {"user_id": user_id, "date": target_date, **data}
    supabase.table("daily_intelligence").insert(record).execute()
    return record
```

### Frontend — `src/pages/Intelligence.tsx`:
- Fetch `GET /api/v1/intelligence/today` on mount
- Loading: skeleton cards (3 news + 1 quote)
- News cards: left border colored by category, title + summary + source link
- Category colors: health=emerald, science=blue, psychology=purple, tech=amber, productivity=orange
- Quote card: full-width, large italic text, author attribution, subtle bg
- "Refresh" button: shows if content is >6h old

### ✅ Phase 8 verification

**Backend:**
```bash
curl -s http://localhost:8000/api/v1/intelligence/today | python3 -m json.tool
# Expected: news_items array with 3 items, quote, quote_author
# Note: first call generates content (10-30s), subsequent calls return cached
```

**Playwright visual check:**
1. Navigate to `/intelligence`
2. Verify loading skeletons appear first
3. Screenshot after content loads — verify: 3 news cards with colored borders, 1 quote card
4. Verify category color coding on news cards
5. Reload page — verify content loads instantly from cache (no new API call)

---

## PHASE 9 — Weekly/Monthly Review Page

**Goal:** AI generates rich weekly reviews with context compression for agent memory.

### Backend — `review_service.py` (two-call pattern):
```python
async def generate_review(supabase, user_id: str, review_type: str) -> dict:
    from datetime import date, timedelta
    
    # Determine date range
    today = date.today()
    if review_type == "weekly":
        period_start = today - timedelta(days=7)
        period_end = today
    else:  # monthly
        period_start = today.replace(day=1)
        period_end = today
    
    # Fetch all data for the period
    # (query all 12 module tables filtered by date range)
    all_data = await fetch_period_data(supabase, user_id, period_start, period_end)
    
    client = anthropic.Anthropic()
    
    # CALL 1: Generate full review markdown
    review_response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": f"""Generate a {review_type} life review for the period {period_start} to {period_end}.
            
Data: {json.dumps(all_data, default=str)}

Format as markdown with these sections:
## Overview
## Achievements
## Patterns Identified
## Areas of Concern
## Goals for Next Period

Be specific, data-driven, and actionable."""
        }]
    )
    review_markdown = review_response.content[0].text
    
    # CALL 2: Compress to context snapshot
    compress_response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"""Compress this {review_type} review into a compact agent memory.
Output ONLY valid JSON, no markdown:
{{
  "key_facts": ["5-8 concrete facts about this person this period"],
  "patterns": ["3-5 behavioral/health patterns"],
  "concerns": ["1-3 issues to monitor"],
  "achievements": ["1-5 notable wins"],
  "avg_metrics": {{"sleep_hrs": 0, "energy": 0, "mood": 0, "score": 0, "workout_days": 0}}
}}

Review to compress:
{review_markdown}"""
        }]
    )
    context_snapshot = compress_response.content[0].text
    
    # Calculate avg score
    avg_score = sum(d.get("potential_score", 0) for d in all_data.get("daily_summaries", [])) / max(len(all_data.get("daily_summaries", [])), 1)
    
    # Save to DB
    record = {
        "user_id": user_id,
        "type": review_type,
        "period_start": str(period_start),
        "period_end": str(period_end),
        "avg_potential_score": avg_score,
        "review_markdown": review_markdown,
        "context_snapshot": context_snapshot
    }
    supabase.table("periodic_reviews").insert(record).execute()
    return record
```

### Frontend — `src/pages/Review.tsx`:
- Tab switcher: Weekly | Monthly
- List of past reviews (date, avg score, compressed badge)
- "Generate Review" button → POST with loading state (show "Generating... this may take 30s")
- Review rendered via `react-markdown` with prose styling
- Collapsible "Agent Memory Snapshot" section showing compressed JSON

### ✅ Phase 9 verification

**Backend:**
```bash
curl -s -X POST "http://localhost:8000/api/v1/review/generate?type=weekly" \
  -H "Content-Type: application/json" \
  | python3 -m json.tool
# Expected: review_markdown (long text), context_snapshot (JSON string), avg_potential_score
```

**Playwright visual check:**
1. Navigate to `/review`
2. Screenshot — verify tab switcher, empty state or past reviews list
3. Click "Generate Review" — verify loading state appears
4. After generation: screenshot — verify markdown rendered correctly with sections
5. Expand "Agent Memory Snapshot" — verify compressed JSON visible

---

## PHASE 10 — Remaining Module Placeholder Pages

**Goal:** All 12 modules have functional placeholder pages (not "coming soon" — styled, intentional empty states).

For each remaining module (Goals, Sleep view, Supplements, Workout, Mental Health, Body, Nutrition, Deep Work, Learning):

Each page should have:
- Module icon (large, 64px)
- Module title (heading)
- Brief description of what this module tracks
- "Coming in next update" styled badge (not a sad "coming soon")
- Quick-add button that opens the same QuickAddFAB modal
- Link back to dashboard

### ✅ Phase 10 verification

**Playwright visual check:**
1. Navigate to each module route
2. Screenshot each — verify: dark styled, not broken, not blank
3. Verify sidebar active state updates correctly on each route
4. Mobile (375px): verify all placeholder pages look intentional, not broken

---

## PHASE 11 — Full System Integration & QA

**Goal:** Complete system works end-to-end. All flows tested. MCP tools verified.

### End-to-end flows to test:

**Flow 1: New day startup**
1. Clear localStorage
2. Load localhost:5173
3. Verify morning popup appears
4. Fill and submit sleep data
5. Verify dashboard updates with sleep data in Sleep & Energy card

**Flow 2: Cognitive challenge**
1. Navigate to /cognitive
2. Verify today's challenge loaded
3. Click "Open Challenge →" — verify opens new tab
4. Start timer — verify countdown
5. Click "I need help" — verify AI chat appears
6. Ask a question — verify streaming response from Claude

**Flow 3: Daily intelligence**
1. Navigate to /intelligence
2. Verify content loads (or generates)
3. Reload — verify instant load (cached)

**Flow 4: Weekly review**
1. Navigate to /review
2. Generate weekly review
3. Verify markdown rendered
4. Verify context_snapshot shows in DB (via Supabase dashboard or API)

**MCP tools verification:**
Once backend is running, test each MCP tool in Claude Code session:
```
Use the lifeos MCP tool get_health to verify the backend is running
Use get_today_summary to fetch today's data
Use get_last_n_days(7) to get the past week
```

### ✅ Phase 11 verification — Final Playwright audit

Run `/visual-test` slash command.

Expected results:
- ✅ Dashboard: score gauge, 12 cards, streak banner, all visible
- ✅ Morning popup: appears on first load, all 4 inputs functional
- ✅ Cognitive page: challenge displayed, timer functional, AI chat unlocks
- ✅ Intelligence page: 3 news cards + quote rendered with category colors
- ✅ Review page: generation works, markdown rendered
- ✅ All 12 module routes: load without errors
- ✅ Mobile 375px: single column, sidebar collapsed
- ✅ Browser console: 0 JavaScript errors across all pages

**TypeScript & lint final check:**
```bash
cd frontend && pnpm tsc --noEmit && pnpm lint
cd backend && ruff check .
# Both must return 0 errors
```

---

## PHASE 12 — Final Cleanup & Documentation

1. Update `docs/PROGRESS.md` — mark all phases complete
2. Verify `.env.example` files are accurate and complete
3. Ensure no `.env` files are committed (`git status` — only `.env.example` visible)
4. Run `git add -A && git commit -m "feat: Module 1 — Life OS Dashboard Foundation complete"`
5. Write session summary in `docs/PROGRESS.md` under Session Notes

---

## Build completion definition

The build is **complete** when:
- [ ] `/visual-test` returns all green checkmarks
- [ ] `pnpm tsc --noEmit` returns 0 errors
- [ ] `ruff check .` returns 0 errors
- [ ] All 4 end-to-end flows in Phase 11 pass
- [ ] MCP tools return real data from the running backend
- [ ] `docs/PROGRESS.md` is fully updated
