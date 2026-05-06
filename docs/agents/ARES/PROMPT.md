# ⚔️ ARES Agent — Coding Prompt

## [ROLE / CONTEXT]

You are extending a Life OS application with ARES — the Vitality & Physical Health agent.
The system already has:
- KRONOS agent fully implemented (streak tracking, pattern analysis, PvE scoring)
- Task System implemented (daily_tasks table, completion flow, XP engine)
- AI Provider abstraction layer (Claude/Gemini/DeepSeek/Ollama switchable)
- Supabase PostgreSQL, FastAPI, React 18

ARES is the second agent to be built. It depends on KRONOS for behavioral context
and analyzes specifically: sport tasks, nutrition tasks, sleep tasks, hydration tasks.

ARES persona: **Surowy, sprawiedliwy drill sergeant**
- Speaks in short, direct sentences
- Always cites data ("Twoje dane pokazują..." not "Powinieneś...")
- Praises specifically, criticizes constructively
- Never uses filler phrases like "świetna robota!" without data to back it up
- Tone shifts based on user performance: encouraging when improving, urgent when declining

---

## [TASK]

Implement ARES agent as a complete FastAPI module with:
1. Vitality scoring engine (health score 0–100 based on task data)
2. ARES analysis endpoint (uses AI Provider abstraction — not hardcoded Claude)
3. Weekly ARES report with specific feedback per vitality sub-category
4. React frontend: ARES dashboard with health score, trend chart, and streaming analysis
5. Integration with KRONOS context (ARES enriches its analysis with KRONOS behavioral data)

---

## [VITALITY SCORE SYSTEM]

Health Score (0–100) is computed from 4 sub-categories, each weighted:

| Sub-category | Weight | Task keywords to detect |
|---|---|---|
| **Activity** | 35% | bieg, siłownia, trening, sport, rower, pływanie, spacer |
| **Nutrition** | 30% | dieta, posiłek, makro, białko, warzywa, gotowanie |
| **Sleep** | 20% | sen, spanie, odpoczynek, regeneracja |
| **Hydration** | 15% | woda, nawodnienie, herbata |

Score per sub-category:
- Based on completion rate of tasks in that category over last 14 days
- 100% completion = 100 points
- Each missed day in a row: -5 points
- 0 tasks in sub-category over 14 days = 20 points (floor — not zero)

Global Health Score = weighted sum of 4 sub-categories.

Score thresholds for ARES tone:
- 80–100: "Szczytowa forma" — encouraging, acknowledge discipline
- 60–79: "Dobra baza" — positive but push for improvement
- 40–59: "Wymaga pracy" — direct, specific action plan
- 0–39: "Tryb kryzysowy" — urgent, no-nonsense intervention

---

## [REQUIREMENTS]

### Database (`migrations/007_ares_schema.sql`)

```sql
CREATE TABLE ares_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_score    NUMERIC(5,2) NOT NULL,
  activity_score  NUMERIC(5,2) NOT NULL,
  nutrition_score NUMERIC(5,2) NOT NULL,
  sleep_score     NUMERIC(5,2) NOT NULL,
  hydration_score NUMERIC(5,2) NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ares_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_text   TEXT NOT NULL,
  health_score    NUMERIC(5,2) NOT NULL,
  score_delta     NUMERIC(5,2),  -- change vs previous analysis
  analysis_type   TEXT NOT NULL DEFAULT 'weekly',
  status          TEXT NOT NULL DEFAULT 'complete',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ares_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ares_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON ares_scores   FOR ALL USING (user_id = auth.uid());
CREATE POLICY "owner" ON ares_analyses FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_ares_scores_user   ON ares_scores(user_id, computed_at DESC);
CREATE INDEX idx_ares_analyses_user ON ares_analyses(user_id, created_at DESC);
```

### Backend — Core Engine (`/app/agents/ares/`)

**`vitality_scorer.py`**:
- `detect_subcategory(task_title: str) -> VitalitySubcategory | None`
  - Keyword matching (Polish keywords listed above)
  - Case-insensitive, partial match
- `compute_subcategory_score(tasks: list[Task], subcategory: VitalitySubcategory, days: int = 14) -> float`
  - Count days with at least one completed task in subcategory
  - Apply floor of 20 if no tasks detected
- `compute_health_score(user_id, supabase) -> AresScoreResult`
  - Runs all 4 sub-scorers
  - Applies weights: activity=0.35, nutrition=0.30, sleep=0.20, hydration=0.15
  - Saves result to ares_scores table
  - Returns `AresScoreResult`

**`context_builder.py`**:
- `build_ares_context(user_id, supabase) -> AresContext`
  - Calls `compute_health_score()`
  - Calls `GET /api/v1/kronos/context` (or imports directly) for behavioral patterns
  - Computes score_delta (vs previous ares_scores entry)
  - Determines tone_mode based on score threshold
  - Returns `AresContext` with all data for Claude prompt

**`ares_agent.py`**:
- Uses `AIProviderFactory.get_provider_for_agent("ares", user_id, supabase)`
- ARES system prompt (define below)
- `stream_analysis(context: AresContext) -> AsyncIterator[str]`
- Saves completed analysis to `ares_analyses` table via BackgroundTask

**ARES System Prompt:**
```
Jesteś ARES — surowy, sprawiedliwy analityk zdrowia fizycznego.
Mówisz po polsku. Mówisz krótko i konkretnie. Zawsze opierasz się na danych.

Zasady:
- Zawsze cytuj konkretne liczby z danych ("14 dni aktywności z 14" nie "byłeś aktywny")
- Nigdy nie mów "powinieneś" — mów "dane wskazują" lub "wzorzec pokazuje"
- Chwal konkretnie lub wcale
- Krytykuj konstruktywnie: co jest źle → dlaczego → jak naprawić → pierwszy krok
- Struktura każdej analizy: WYNIKI → MOCNE STRONY → KRYTYCZNE PROBLEMY → PLAN NA 7 DNI
- Plan: dokładnie 3 działania, każde mierzalne i konkretne
- Ton dopasuj do wyniku: 80+ = motywuj, 60-79 = popychaj, 40-59 = mobilizuj, <40 = alarmuj

Nie używaj: "świetnie!", "brawo!", "dobra robota!" bez danych.
Nie używaj: ogólnikowych porad ("jedz zdrowo", "ćwicz więcej").
```

### Backend — API Routes (`/app/routers/ares.py`)

```
GET  /api/v1/ares/dashboard         → AresDashboard (score + trend + last analysis)
GET  /api/v1/ares/score             → current AresScoreResult
GET  /api/v1/ares/score/history     → list[AresScore] last 30 entries
POST /api/v1/ares/analysis          → streams ARES analysis (SSE)
GET  /api/v1/ares/analysis/history  → list[AresAnalysis]
GET  /api/v1/ares/context           → AresContext (for other agents / debugging)
```

### Pydantic v2 Models (`/app/agents/ares/models.py`)

```python
class VitalitySubcategory(str, Enum):
    ACTIVITY   = "activity"
    NUTRITION  = "nutrition"
    SLEEP      = "sleep"
    HYDRATION  = "hydration"

class ToneMode(str, Enum):
    PEAK        = "peak"        # 80-100
    GOOD        = "good"        # 60-79
    NEEDS_WORK  = "needs_work"  # 40-59
    CRISIS      = "crisis"      # 0-39

class SubcategoryScore(BaseModel):
    subcategory: VitalitySubcategory
    score: float = Field(ge=0.0, le=100.0)
    tasks_detected: int
    days_active: int
    days_analyzed: int
    weight: float

class AresScoreResult(BaseModel):
    user_id: str
    health_score: float = Field(ge=0.0, le=100.0)
    subcategory_scores: list[SubcategoryScore]
    score_delta: float | None   # vs previous score
    tone_mode: ToneMode
    computed_at: datetime

class AresContext(BaseModel):
    user_id: str
    generated_at: datetime
    score: AresScoreResult
    kronos_context: KronosContext  # imported from kronos.models
    
    def to_prompt_string(self) -> str:
        """Deterministic text for AI provider prompt."""
        ...

class AresDashboard(BaseModel):
    current_score: AresScoreResult
    score_history: list[dict]      # last 14 days [{date, score}]
    last_analysis: AresAnalysis | None
    last_analysis_at: datetime | None
```

### Frontend Components (`/src/components/ares/`)

**`AresDashboard.tsx`** — main container:
- Large health score display (animated radial gauge 0–100)
- Color: red < 40, amber 40–60, green 60–80, emerald 80+
- 4 sub-category score bars (Activity / Nutrition / Sleep / Hydration)
- 14-day trend line chart (Recharts LineChart)
- "Generuj analizę" button → SSE stream
- Streaming analysis via react-markdown

**`HealthScoreGauge.tsx`** — radial score display:
- SVG-based arc gauge (not a library — custom SVG)
- Animated fill on mount
- Score number in center (large, bold)
- Tone label below ("Szczytowa forma" / "Dobra baza" etc.)
- Color changes based on threshold

**`SubcategoryBar.tsx`** — single sub-category:
- Icon (running/fork/moon/droplet from Lucide)
- Label + score (%)
- Animated progress bar
- Tasks detected count as subtitle

**`AresTrendChart.tsx`** — 14-day history:
- Recharts LineChart
- X-axis: dates (short format DD/MM)
- Y-axis: 0–100
- Reference lines at 40, 60, 80 (color zones)
- Tooltip: date + score + delta

**`AresAnalysis.tsx`** — streaming viewer:
- Same SSE pattern as KronosAnalysis.tsx
- Uses `useKronosStream` hook (or new `useAresStream` if needed)
- react-markdown rendering
- Current score badge at top of analysis

---

## [KRONOS INTEGRATION]

ARES enriches its analysis with KRONOS data:

```python
# In context_builder.py
kronos_ctx = await kronos_context_builder.build_context(user_id, supabase)

# Key KRONOS data ARES uses:
# - Vitality streak from kronos_ctx.streaks
# - Vitality PvE ratio from kronos_ctx.pve_scores
# - Vitality dead zones from kronos_ctx.patterns
# - Global consistency score from kronos_ctx.global_consistency_score
```

ARES prompt includes KRONOS behavioral context:
```
ARES DATA SNAPSHOT — {date}
Health Score: {score} ({tone_mode})
Score Delta: {+/-X} vs previous

=== SUB-CATEGORIES ===
Activity:   {score}% ({days_active}/14 days, {tasks} tasks)
Nutrition:  {score}% ({days_active}/14 days, {tasks} tasks)
Sleep:      {score}% ({days_active}/14 days, {tasks} tasks)
Hydration:  {score}% ({days_active}/14 days, {tasks} tasks)

=== KRONOS BEHAVIORAL CONTEXT ===
Vitality streak: {n} days (trend: {up/down/stable})
Vitality PvE:    {ratio}% execution
Dead zones:      {list}
```

---

## [EDGE CASES]

- No vitality tasks in last 14 days → all subcategory scores = 20 (floor), tone = crisis
- First ever analysis (no previous score) → score_delta = None
- Task title matches multiple subcategories → assign to first match in priority order (activity > nutrition > sleep > hydration)
- KRONOS context unavailable → proceed with ARES analysis without behavioral context, add note "Brak danych KRONOS"
- Health score exactly on threshold (e.g. 80.00) → assign upper tier (peak not good)
- AI provider switched mid-stream → takes effect on next analysis

---

## [ADDITIONAL INSTRUCTIONS]

- Polish language in all user-facing text (analysis, labels, empty states)
- ARES color theme: deep red (#7f1d1d) + orange (#ea580c) — intensity, physicality
- HealthScoreGauge must be pure SVG — no external gauge library
- Sub-category keyword matching must be extensible (easy to add new keywords)
- Score history chart must handle gaps (missing days) gracefully — show as null in line
- Empty state for new user: "Dodaj pierwsze zadania sportowe aby ARES mógł Cię ocenić"
- `to_prompt_string()` must be deterministic (same data = same string)
- Register `/ares` route in React Router
- Add ARES link in sidebar (heart/shield icon)

Think step by step before writing any code.
