# PROMETHEUS — Architecture & Coding Standards

## System Architecture

```
Browser
  └── /workout  →  PrometheusPage
        ├── Tab: Trening
        │     ├── BodyMap (react-muscle-highlighter)
        │     ├── ExerciseInput (natural language → AI parse)
        │     └── WorkoutLog (today + history)
        ├── Tab: Tygodnik
        │     ├── WeekView (7-day heatmap)
        │     └── MuscleRecoveryBar
        └── Tab: PROMETHEUS
              ├── WeeklyReport (AI report + SSE generate)
              └── PrometheusChat (streaming SSE chat)

Frontend API layer (src/api/prometheus.ts)
  └── HTTP/SSE  →  FastAPI /api/prometheus/*

FastAPI Router (routers/prometheus.py)
  └── prometheus_service.py  →  Supabase (4 new tables)
  └── agents/prometheus/agent.py  →  AIProvider  →  Claude

Supabase Tables:
  prometheus_exercises        (exercise library)
  prometheus_sessions         (training sessions)
  prometheus_session_exercises (exercises in session)
  prometheus_reports          (cached weekly AI reports)
  workout_sessions            (existing — also written for dashboard compat)
```

## Data Flow: Add Exercise

```
User types: "Wyciskanie na klatę 12x80kg 10x85kg"
    │
    ▼
ExerciseInput.tsx
    │  POST /api/prometheus/exercises/parse
    ▼
prometheus.py router
    │
    ▼
prometheus_agent.parse_exercise(text, provider)
    │  AI → JSON {name, sets, muscle_load, comment}
    ▼
ParseExerciseResponse returned to frontend
    │
    ▼  (user confirms)
POST /api/prometheus/sessions
    │
    ├─→ prometheus_service.create_session() → prometheus_sessions + prometheus_session_exercises
    └─→ workout_service.insert_workout()    → workout_sessions (dashboard compat)
    │
    ▼
GET /api/prometheus/recovery  (refresh recovery map)
    │
    ▼
BodyMap re-renders with updated muscle intensities
```

## Recovery Calculation

```python
def get_muscle_recovery_map(supabase) -> dict[str, float]:
    # Fetch all sessions from last 96 hours
    # For each session exercise:
    #   elapsed_hours = (now - session.created_at) / 3600
    #   decay = max(0, 1 - elapsed_hours / 96)
    #   for each muscle: intensity[muscle] = max(current, load * decay)
    # Return intensity map
```

## Coding Standards

### Python
- `from __future__ import annotations` at top of every file
- Pydantic v2: `class Foo(BaseModel):` — no `Config` class, use `model_config`
- All service functions: `(supabase: Client, ...) -> return_type`
- Always call `get_user_id(supabase)` inside service functions
- `TABLE_*` constants from `config.py` — never hardcode table names
- Return `res.data[0] if res.data else {}` pattern for single-row inserts
- Raise `HTTPException(status_code=404, ...)` in router, not in service

### TypeScript / React
- Strict TypeScript: no `any`, no `!` non-null assertions except after explicit guards
- `import type { Foo }` for type-only imports
- `useState<T>` with explicit generics
- API calls in `useEffect` with cleanup `cancelled` flag (see `ares.tsx` pattern)
- Loading state: `const [loading, setLoading] = useState(false)`
- Error state: `const [error, setError] = useState<string | null>(null)`
- Tailwind classes for layout, inline `style={{}}` for theme custom colors only

### SSE Streaming Pattern (frontend)
```typescript
async function* streamSSE(url: string, body: unknown): AsyncIterable<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}
```

### SSE Streaming Pattern (backend, follow ares.py)
```python
async def event_stream() -> AsyncIterator[str]:
    yield _sse({"status": "start"})
    async for chunk in agent.stream_something(...):
        yield _sse({"chunk": chunk})
    yield _sse({"done": True})

return StreamingResponse(event_stream(), media_type="text/event-stream")
```

## What NOT to do
- Never call Anthropic API directly from frontend
- Never hardcode table names outside `config.py`
- Never import from `react-native-body-highlighter` — use `react-muscle-highlighter`
- Never put logic in the router that belongs in the service
- Never use `localStorage` (not available in this environment)
- Never rename existing routes or table names
