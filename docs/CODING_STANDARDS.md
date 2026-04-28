# 📐 CODING_STANDARDS.md — Life OS

## Python (FastAPI Backend)

### Naming Conventions
- Files: `snake_case.py`
- Functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Pydantic models: `PascalCase` with suffix indicating purpose (`UserProfile`, `DailySummaryResponse`, `GoalCreateRequest`)
- Router prefixes: all lowercase with hyphens in URL paths (`/api/v1/daily-summary`)

### Async Pattern
- All route handlers must be `async def`
- All Supabase calls must be `await`ed
- Never use `asyncio.run()` inside FastAPI handlers

### Pydantic Models
- Always use Pydantic v2 syntax (`model_config`, `model_validator`)
- All response models inherit from a base `BaseResponse` with `success: bool` and optional `error: str`
- Never return raw dicts from route handlers — always return typed Pydantic models

### Error Handling
- Use FastAPI's `HTTPException` for all HTTP errors
- Use `status_code=404` for not found, `422` for validation, `500` for unexpected
- Wrap all Supabase calls in try/except and convert Supabase errors to `HTTPException`
- Never expose raw exception messages to the API response in production

### Imports Order (enforced by Ruff)
1. Standard library
2. Third-party packages
3. Local modules
Separate each group with a blank line.

### Forbidden Patterns
- No `print()` statements — use Python `logging` module
- No raw SQL strings — use Supabase query builder methods
- No hardcoded strings for table names — define as constants in `core/config.py`
- No synchronous blocking calls inside async functions

### Example Route Handler
```python
@router.get("/daily-summary", response_model=DailySummaryResponse)
async def get_daily_summary(
    date: str = Query(default=None),
    supabase: Client = Depends(get_supabase),
) -> DailySummaryResponse:
    target_date = date or datetime.today().strftime("%Y-%m-%d")
    try:
        summary = await dashboard_service.get_summary(supabase, target_date)
        return DailySummaryResponse(success=True, data=summary)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Dashboard summary error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

---

## TypeScript (React Frontend)

### Naming Conventions
- Files: `PascalCase.tsx` for components/pages, `camelCase.ts` for utilities/services
- Components: `PascalCase` function components only — no class components
- Custom hooks: `useXxx` prefix
- Types/Interfaces: `PascalCase`, prefix interfaces with nothing (not `IUser` — just `User`)
- Constants: `UPPER_SNAKE_CASE`
- Event handlers: `handleXxx` (e.g. `handleCardClick`, `handleSubmit`)

### TypeScript Strictness
- `strict: true` in `tsconfig.json` — no exceptions
- **Never use `any`** — use `unknown` and narrow, or define proper types
- All API response types must be defined in `src/types/index.ts`
- Props interfaces must be defined directly above their component:
  ```typescript
  interface ModuleCardProps {
    module: ModuleConfig;
    data: ModuleSummary | null;
    isLoading: boolean;
  }
  ```

### Component Structure
Each component file must follow this order:
1. Imports
2. Types/interfaces for this component only
3. Helper functions (if any, keep minimal)
4. Component function
5. `export default`

### Async/State Pattern
- Use `useEffect` + `useState` for data fetching — no external state library in Module 1
- Always handle three states: loading, error, data
- All API calls go through `src/services/api.ts` — never inline `fetch()` in components

### TailwindCSS Rules
- No inline `style` props unless absolutely necessary (animation values that can't be done in Tailwind)
- Avoid `!important` overrides
- Responsive classes: always mobile-first (`sm:`, `md:`, `lg:`)
- Custom colors must be defined in `tailwind.config.ts`, not hardcoded hex values in class names

### Forbidden Patterns
- No `any` type
- No class-based React components
- No direct DOM manipulation (`document.getElementById`) — use refs
- No API calls outside `services/api.ts`
- No hardcoded API URLs — always use `import.meta.env.VITE_API_URL`

### Example Component Pattern
```typescript
interface PotentialScoreGaugeProps {
  score: number; // 0–100
  isLoading: boolean;
}

export default function PotentialScoreGauge({ score, isLoading }: PotentialScoreGaugeProps) {
  const clampedScore = Math.min(100, Math.max(0, score));

  if (isLoading) return <LoadingSkeleton variant="gauge" />;

  return (
    <div className="flex flex-col items-center">
      {/* SVG gauge */}
    </div>
  );
}
```

---

## Git Commit Convention

Use Conventional Commits:
- `feat: add supplement checklist component`
- `fix: correct date parsing in dashboard service`
- `chore: update dependencies`
- `refactor: extract score calculation to service`
- `docs: update ARCHITECTURE.md with agent flow`

Never commit:
- `.env` files
- `node_modules/`
- `__pycache__/`
- Generated migration files that haven't been reviewed
