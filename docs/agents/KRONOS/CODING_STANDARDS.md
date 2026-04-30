# 📐 KRONOS — Coding Standards

## Python (Backend)

### Naming Conventions
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions / methods: `async def snake_case()`
- Constants: `UPPER_SNAKE_CASE`
- Pydantic models: noun phrases → `StreakData`, `KronosContext`
- Route handlers: verb + noun → `get_dashboard`, `post_analysis`

### Required Patterns
```python
# ✅ Always async
async def get_streaks(user_id: str, supabase: AsyncClient) -> list[StreakData]:
    ...

# ✅ Full type hints on all public functions
async def build_context(user_id: str, supabase: AsyncClient) -> KronosContext:
    ...

# ✅ Pydantic v2 — use model_validator for cross-field logic
class PvEScore(BaseModel):
    @model_validator(mode='after')
    def cap_ratio(self) -> 'PvEScore':
        self.overall_ratio = min(self.overall_ratio, 1.0)
        return self

# ✅ Parallel async calls — never sequential when independent
streaks, patterns, pve = await asyncio.gather(
    streak_tracker.get_streaks(user_id, supabase),
    pattern_analyzer.get_patterns(user_id, supabase),
    pve_scorer.get_pve_scores(user_id, supabase),
)

# ✅ supabase-py query builder — no raw SQL in Python
result = await supabase.table("tasks") \
    .select("*") \
    .eq("user_id", user_id) \
    .eq("category", category.value) \
    .gte("scheduled_date", thirty_days_ago) \
    .execute()

# ✅ SSE streaming pattern for Claude
async def stream_analysis(...):
    async with anthropic_client.messages.stream(...) as stream:
        async for text in stream.text_stream:
            yield text
```

### Forbidden Patterns
```python
# ❌ Never raw SQL in Python code
cursor.execute("SELECT * FROM tasks WHERE user_id = %s", (user_id,))

# ❌ Never synchronous DB calls in async context
result = supabase.table("tasks").select("*").execute()  # missing await

# ❌ Never ignore Pydantic validation
data = {"category": "invalid_value"}
task = Task(**data)  # will raise — never catch ValidationError silently

# ❌ Never call Claude from frontend directly
fetch("https://api.anthropic.com/v1/messages", ...)  # only from backend
```

### Error Handling
```python
# Use custom exceptions in /app/agents/kronos/exceptions.py
class KronosError(Exception): ...
class KronosInsufficientDataError(KronosError): ...
class KronosAnalysisError(KronosError): ...

# FastAPI error handlers — return structured JSON
@app.exception_handler(KronosInsufficientDataError)
async def insufficient_data_handler(request, exc):
    return JSONResponse(status_code=422, content={"error": str(exc), "code": "INSUFFICIENT_DATA"})
```

### File Length & Structure
- Max 200 lines per file — split if longer
- One responsibility per file
- Imports order: stdlib → third-party → local (enforced by ruff)
- All modules must have a module-level docstring

---

## TypeScript (Frontend)

### Naming Conventions
- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities/hooks/api
- Components: `PascalCase`
- Hooks: `useKronosStream`, `useKronosDashboard`
- API functions: `fetchKronosDashboard`, `streamKronosAnalysis`
- CSS: Tailwind utility classes only — no custom CSS files

### Required Patterns
```typescript
// ✅ Strict null checks — always handle null
const score = dashboard?.global_consistency_score ?? null

// ✅ Interfaces for all objects
interface KronosDashboardProps {
  userId: string
  onAnalysisComplete: (id: string) => void
}

// ✅ Typed API responses — never infer as unknown
const dashboard: KronosDashboard = await fetchKronosDashboard(userId)

// ✅ SSE via EventSource — always clean up in useEffect
useEffect(() => {
  const source = new EventSource('/api/kronos/analysis')
  source.onmessage = (e) => { ... }
  return () => source.close()  // cleanup
}, [])

// ✅ Early returns for loading/error states
if (isLoading) return <KronosSkeleton />
if (error) return <KronosError message={error} />
```

### Forbidden Patterns
```typescript
// ❌ Never use `any`
const data: any = response.json()

// ❌ Never inline API calls in components — use /src/api/kronos.ts
const res = await fetch('/api/kronos/dashboard')  // inside component

// ❌ Never hardcode category strings — use the TaskCategory type
if (category === "vitality") ...  // use TaskCategory enum values

// ❌ Never suppress TypeScript errors
// @ts-ignore
```

### Component Structure
```
src/components/kronos/
├── KronosDashboard.tsx     ← smart component (fetches data)
├── StreakCard.tsx          ← dumb component (props only)
├── PatternHeatmap.tsx      ← dumb component
├── PvEChart.tsx            ← dumb component
├── KronosAnalysis.tsx      ← smart component (SSE)
└── KronosAlerts.tsx        ← dumb component

src/hooks/
└── useKronosStream.ts      ← SSE hook, handles retry

src/api/
└── kronos.ts               ← all fetch calls, typed
```

---

## KRONOS Visual Theme
```
Background:  #1e293b  (slate-800)  — precision, control
Accent:      #f59e0b  (amber-500)  — urgency, discipline  
Success:     #22c55e  (green-500)  — streaks, completions
Danger:      #ef4444  (red-500)    — dead zones, broken streaks
Neutral:     #94a3b8  (slate-400)  — secondary text
```
