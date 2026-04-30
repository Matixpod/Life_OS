# 📓 DECISIONS.md — Life OS v2

## ADR-001: Supabase over pure vector DB
- **Status**: Accepted
- **Decision**: Use Supabase (PostgreSQL + pgvector) for all data — structured module tables + vector embeddings in the same DB.
- **Why**: Single infrastructure, great DX, sufficient vector performance for single-user scale. No need to manage Pinecone/Chroma separately.

---

## ADR-002: FastAPI as intermediary (no direct Supabase from frontend)
- **Status**: Accepted
- **Decision**: All data access goes through FastAPI. Frontend talks only to the backend. Supabase client lives only in backend code.
- **Why**: Enables business logic, AI agent orchestration, and external API calls. Prevents service role key exposure to browser.

---

## ADR-003: Single-user architecture (no auth)
- **Status**: Accepted
- **Decision**: One row in `users`, no login screen, no multi-tenancy.
- **Why**: This is a personal tool. Auth complexity is pure overhead with zero benefit.

---

## ADR-004: Samsung Health → Manual morning popup (MVP)
- **Date**: 2026-04-27
- **Status**: Accepted
- **Context**: Samsung Health has no public REST API. Android Health Connect is the cleanest bridge but requires additional Android setup.
- **Decision**: For MVP, use a beautiful morning popup modal where the user manually inputs sleep duration (h+m steppers), sleep quality (stars), energy (slider), and morning mood (emojis). This takes < 60 seconds and has zero external dependencies.
- **Consequences**: No automatic sync initially. Future: can add Health Connect sync as an optional enhancement — data schema already supports `source: 'health_connect'`.

---

## ADR-005: Cognitive Challenge — external link + timer, not integrated solver
- **Date**: 2026-04-27
- **Status**: Accepted
- **Context**: LeetCode has no official API. Building an integrated code editor would be a large scope.
- **Decision**: The challenge module opens the problem on the external site (LeetCode, Project Euler, etc.) in a new tab. Life OS handles only: the countdown timer, the AI explanation chat (after timer expires), and completion logging.
- **Timer durations**: Easy = 15min, Medium = 30min, Hard = 45min.
- **AI unlock**: Timer expiry OR manual "I need help" (after timer starts). This preserves the challenge while ensuring learning happens.
- **Socratic mode**: Claude is instructed to guide, not solve. Teaches understanding over answer-copying.
- **Consequences**: User switches between Life OS tab and LeetCode tab. This is an acceptable UX tradeoff for massive implementation simplicity.

---

## ADR-006: Context Compression for Agent Memory
- **Date**: 2026-04-27
- **Status**: Accepted
- **Context**: As data accumulates (12 modules × 365 days), feeding all raw data to AI agents would exceed context windows and be noisy.
- **Decision**: Implement a two-layer compression system. Weekly reviews generate a <400 token JSON `context_snapshot`. Monthly reviews do the same. Agents receive: last 7 days raw + 12 weekly snapshots + 6 monthly snapshots ≈ ~8000 tokens of rich historical context.
- **Consequences**: Agents have long-term memory without token bloat. Reviews become a critical system function, not just a nice-to-have.

---

## ADR-007: Nutrition — text-first, no barcode scanning (MVP)
- **Date**: 2026-04-27
- **Status**: Accepted
- **Context**: Full nutrition tracking (barcode scanner, macro database, weight logging) would add weeks of development.
- **Decision**: Nutrition log is a simple text description per meal: `"Chicken breast 200g, rice 150g, broccoli"`. Optional estimated protein/calories fields. AI agents can parse the text to estimate macros if needed.
- **Consequences**: Fastest to implement. Nutrition data is captured. Future: can add Cronometer API or barcode scanning as enhancement.

---

## ADR-008: Daily Intelligence — Claude with web search (not curated RSS)
- **Date**: 2026-04-27
- **Status**: Accepted
- **Context**: Options: (a) curated RSS feeds, (b) News API, (c) Claude with web search.
- **Decision**: Use Claude with the web search tool enabled. This produces summaries tailored to the user's profile and interests (health, science, productivity, longevity), not generic tech news.
- **Cached daily**: generated once per day, cached in `daily_intelligence` table. Refreshable once per 6 hours.
- **Consequences**: Costs ~0.01–0.05 USD per generation. Highly personalized. Content quality depends on Claude's web search quality.

---

## ADR-009: LangGraph for future agent orchestration (not CrewAI)
- **Status**: Proposed (Module 6)
- **Decision**: When the AI agent orchestration layer is built, use LangGraph (Python, Anthropic-compatible). Each domain is a specialized node: sleep_agent, workout_agent, cognitive_agent, mental_health_agent, synthesis_agent.
- **Why over CrewAI**: More fine-grained state control, better error handling, native streaming support, more actively maintained.

---

## ADR-010: daily_tasks instead of separate tasks table
- **Date**: 2026-04-28
- **Status**: Accepted
- **Context**: CHECKLIST specified a new `tasks` table. Existing schema already
  had `daily_tasks` table with compatible structure (category + status fields).
- **Decision**: Use `daily_tasks` instead of creating a redundant `tasks` table.
  KRONOS analyzers query `daily_tasks` directly.
- **Consequences**: Naming inconsistency between docs (tasks) and code (daily_tasks).
  All future documentation must use `daily_tasks`.

---

## ADR-011: RLS enabled with auth.uid() policy (Scenario B — multi-user ready)
- **Date**: 2026-04-29
- **Status**: Accepted
- **Context**: Initial migration omitted RLS. Audit identified this as HIGH priority risk.
- **Decision**: Enable RLS on all 5 KRONOS tables via manual SQL migration in
  Supabase Dashboard. Policy: `user_id = auth.uid()` FOR ALL on each table.
- **Consequences**: App is now multi-user ready at DB level. Backend must ensure
  Supabase client is initialized with user's JWT (not service_role key) for
  RLS to work correctly on user-facing routes.
