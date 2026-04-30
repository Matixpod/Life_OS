# 🏗️ KRONOS — Architecture

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                      │
│  KronosDashboard → StreakCard / PatternHeatmap / PvEChart       │
│  KronosAnalysis (SSE stream) → react-markdown renderer          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / SSE
┌──────────────────────────▼──────────────────────────────────────┐
│                    BACKEND (FastAPI)                             │
│                                                                 │
│  /app/routers/kronos.py                                         │
│  ├── GET  /api/v1/kronos/dashboard                              │
│  ├── GET  /api/v1/kronos/streaks                                │
│  ├── GET  /api/v1/kronos/patterns                               │
│  ├── GET  /api/v1/kronos/pve                                    │
│  ├── GET  /api/v1/kronos/context   ◄── used by other agents     │
│  ├── GET  /api/v1/kronos/analysis/history                       │
│  └── POST /api/v1/kronos/analysis  (SSE)                       │
│                                                                 │
│  /app/agents/kronos/                                            │
│  ├── streak_tracker.py    → StreakData per category             │
│  ├── pattern_analyzer.py  → PatternData (day/hour heatmaps)    │
│  ├── pve_scorer.py        → PvEScore (plan vs. execution)      │
│  ├── context_builder.py   → KronosContext (aggregator)         │
│  └── claude_agent.py      → streams analysis via Anthropic SDK │
└──────────────────────────┬──────────────────────────────────────┘
                           │ supabase-py (async)
┌──────────────────────────▼──────────────────────────────────────┐
│                    DATABASE (Supabase / PostgreSQL)              │
│                                                                 │
│  tasks                  ← source of truth for all behavior     │
│  kronos_streaks         ← cached streak state                  │
│  kronos_patterns        ← precomputed completion heatmaps      │
│  kronos_snapshots       ← weekly PvE snapshots                 │
│  kronos_analyses        ← saved Claude reports (markdown)      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│               Claude API (claude-sonnet-4-20250514)             │
│               Called only by claude_agent.py                    │
│               Streaming via anthropic.AsyncAnthropic            │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### `streak_tracker.py`
Reads raw `tasks` table. Computes per-category streaks by walking backwards
from today through completed task dates. Detects trend by comparing current
streak to the same category's streak 7 days ago.

### `pattern_analyzer.py`
Aggregates `tasks` (last 90 days) grouped by `(category, day_of_week)` and
`(category, hour_of_day)`. Computes `completed / total` ratio per bucket.
Classifies peak/dead zones by threshold (>70% / <30%). Skips categories
with fewer than 7 data points.

### `pve_scorer.py`
Reads `tasks` grouped by `(category, scheduled_date)`. Computes daily ratio
of `done` tasks to all non-skipped tasks. Builds 30-day timeline. Identifies
statistical outliers (best/worst days). Caps ratio at 1.0 by definition.

### `context_builder.py`
Calls the three analyzers in parallel (`asyncio.gather`). Assembles
`KronosContext`. Computes `global_consistency_score` as weighted average
of per-category PvE ratios (equal weights). Generates `alerts` by scanning
for dead zones and streak-at-risk conditions (current_streak > 0 and no
task today in that category). Exposes `to_prompt_string()` for Claude.

### `claude_agent.py`
Stateless. Accepts a `KronosContext` and `analysis_type`. Constructs the
Claude messages array. Streams response via `anthropic.messages.stream()`.
Yields raw text chunks to the router. Does not write to DB (router handles
this via `BackgroundTasks`).

## Key Data Flows

### Dashboard Load
```
Frontend GET /api/v1/kronos/dashboard
  → router calls context_builder.build_context(user_id)
  → context_builder calls streak_tracker, pattern_analyzer, pve_scorer in parallel
  → all three query tasks table
  → context_builder assembles KronosDashboard + alerts
  → router returns JSON
  → Frontend renders StreakCards, Heatmap, PvEChart
```

### Analysis Stream
```
Frontend POST /api/v1/kronos/analysis
  → router builds KronosContext
  → router calls claude_agent.stream_analysis(context, type)
  → claude_agent streams from Anthropic API
  → router yields SSE chunks: data: {"chunk": "..."}
  → Frontend useKronosStream hook appends chunks to state
  → react-markdown re-renders incrementally
  → on stream end: router BackgroundTask saves to kronos_analyses
  → SSE sends: data: {"done": true, "analysis_id": "uuid"}
```

### Cross-Agent Context
```
Other agent (e.g. ARES) calls GET /api/v1/kronos/context
  → returns KronosContext JSON
  → ARES uses kronos data to enrich its own analysis
  → e.g. "Vitality streak: 3 days" informs ARES's tone (encouragement vs. urgency)
```

## Design Decisions

- **No caching layer yet** — all queries are real-time from Supabase. Add Redis caching
  in v2 once query patterns stabilize.
- **Pattern data not stored in kronos_patterns table yet** — computed on-demand.
  Table is reserved for future scheduled precomputation jobs.
- **SSE over WebSocket** — simpler, stateless, sufficient for one-directional streaming.
- **BackgroundTasks for DB write** — decouples streaming latency from DB write latency.
- **`to_prompt_string()` is deterministic** — ensures identical Claude prompts for
  identical data, enabling meaningful comparison between analyses.
