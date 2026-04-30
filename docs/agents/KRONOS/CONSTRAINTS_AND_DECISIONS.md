# ⛔ KRONOS — Constraints

## Files / Folders — NEVER Modify
- `/app/main.py` — only add `include_router(kronos_router)`, nothing else
- `/app/core/auth.py` — authentication logic is shared, do not touch
- `/app/core/database.py` — Supabase client setup is shared
- Any existing table schemas not listed in `001_kronos_schema.sql`
- `/src/App.tsx` — only add the KRONOS route entry, nothing else

## Forbidden Actions
- Never call Anthropic API directly from TypeScript/frontend
- Never drop, truncate, or alter existing (non-KRONOS) tables
- Never commit API keys, Supabase URLs, or secrets — use environment variables
- Never store plaintext passwords or PII beyond what Supabase auth already holds
- Never bypass RLS by using the Supabase service role key in user-facing routes
- Never make Claude API calls without the user being authenticated
- Never save `context_snapshot` to DB without stripping user PII (only behavioral metrics)

## Security Constraints
- All `/api/kronos/*` routes must use the `get_current_user` FastAPI dependency
- `user_id` must always come from the JWT token, never from request body
- All DB queries must go through supabase-py with the user's scoped client
- SSE connections must validate auth token before opening stream

## Performance Constraints
- `build_context()` must complete in < 2 seconds (use `asyncio.gather` for parallel queries)
- Dashboard endpoint must return in < 1 second (no Claude calls on dashboard load)
- Pattern analysis limited to last 90 days of data — do not query full history
- Streak calculation limited to last 365 days

---

# 📓 KRONOS — Decisions

## ADR-001: KRONOS as Foundation Agent
- **Date**: 2026-04-28
- **Status**: Accepted
- **Context**: System has 6 planned agents. Each agent needs behavioral consistency data
  to contextualize its domain analysis. Without this, agents give generic advice.
- **Decision**: Build KRONOS first. Expose `GET /api/kronos/context` as a shared
  endpoint all other agents call before generating their own analyses.
- **Consequences**: KRONOS must be stable before other agents can be built.
  Changes to KronosContext schema require coordinated updates across all agents.

## ADR-002: Real-time Computation vs. Cached Patterns
- **Date**: 2026-04-28
- **Status**: Accepted
- **Context**: Pattern analysis (heatmaps) could be precomputed nightly and stored
  in `kronos_patterns` table, or computed on-demand per request.
- **Decision**: Compute on-demand in v1. Table `kronos_patterns` is created but
  not yet written to. Add scheduled precomputation in v2 once query load is known.
- **Consequences**: Higher DB load per request. Acceptable at current user scale.
  Must revisit if dashboard load time exceeds 1 second in production.

## ADR-003: SSE over WebSocket for Analysis Streaming
- **Date**: 2026-04-28
- **Status**: Accepted
- **Context**: Claude analysis needs to stream to frontend. Options: SSE, WebSocket, polling.
- **Decision**: Use Server-Sent Events (SSE). Simpler than WebSocket, stateless,
  works with FastAPI's `StreamingResponse`, sufficient for one-directional text stream.
- **Consequences**: SSE doesn't support bidirectional communication. If future use case
  requires user to interrupt stream mid-analysis, will need to switch to WebSocket.

## ADR-004: BackgroundTask for Saving Analysis to DB
- **Date**: 2026-04-28
- **Status**: Accepted
- **Context**: After streaming completes, analysis must be saved to `kronos_analyses`.
  Writing to DB during the stream would block the final SSE message.
- **Decision**: Use FastAPI `BackgroundTasks` to save after stream closes.
  Send `{"done": true, "analysis_id": "uuid"}` as final SSE event.
- **Consequences**: If server crashes after stream but before background task completes,
  analysis is lost. Acceptable risk at this stage — add transaction safety in v2.

## ADR-005: Deterministic `to_prompt_string()`
- **Date**: 2026-04-28
- **Status**: Accepted
- **Context**: Claude prompts must be comparable across time. If same behavioral data
  produces different prompts, it's impossible to evaluate whether analyses improve.
- **Decision**: `to_prompt_string()` sorts all lists by category name alphabetically
  and uses fixed-format strings. No timestamps beyond the date. No random elements.
- **Consequences**: Slight loss of expressiveness in prompt format. Gain in
  reproducibility and debuggability.
