# ✅ AI MODEL SELECTOR — Implementation Checklist

## 🏗️ Phase 1: Database
- [ ] Create `migrations/006_ai_model_preferences.sql`
  - [ ] `ai_provider` enum: claude, gemini, deepseek, ollama
  - [ ] `ai_model_preferences` table with UNIQUE(user_id, agent_id)
  - [ ] RLS enabled + owner policy
- [ ] Run migration on Supabase — verify table exists

## 🧱 Phase 2: Dependencies
- [ ] Add to `backend/requirements.txt`: `ollama`, `google-generativeai`, `httpx`
- [ ] Add to `.env.example`: GEMINI_API_KEY, DEEPSEEK_API_KEY, OLLAMA_BASE_URL
- [ ] Add to `.env`: GEMINI_API_KEY, DEEPSEEK_API_KEY, OLLAMA_BASE_URL=http://localhost:11434
- [ ] Install: `pip install ollama google-generativeai httpx --break-system-packages`

## 🔌 Phase 3: Provider Abstraction
- [ ] Create `/app/services/ai_provider/__init__.py`
- [ ] Create `/app/services/ai_provider/base.py`
  - [ ] `AIMessage` Pydantic model
  - [ ] `AIProviderConfig` Pydantic model
  - [ ] `ModelInfo` Pydantic model (id, name, recommended, vram_gb optional)
  - [ ] `ProviderHealthStatus` Pydantic model (provider, online, error_message)
  - [ ] `BaseAIProvider` abstract class with `complete()`, `stream()`, `health_check()`
- [ ] Create `/app/services/ai_provider/claude_provider.py`
  - [ ] Wraps existing anthropic SDK
  - [ ] `complete()` → non-streaming
  - [ ] `stream()` → AsyncIterator via `messages.stream()`
  - [ ] `health_check()` → checks ANTHROPIC_API_KEY exists + makes minimal API call
- [ ] Create `/app/services/ai_provider/gemini_provider.py`
  - [ ] Uses `google-generativeai`
  - [ ] `complete()` → `generate_content_async`
  - [ ] `stream()` → `generate_content_async(stream=True)`
  - [ ] `health_check()` → checks GEMINI_API_KEY
  - [ ] Catches `BlockedPromptException` → user-friendly message
- [ ] Create `/app/services/ai_provider/deepseek_provider.py`
  - [ ] Uses `httpx.AsyncClient` (OpenAI-compatible)
  - [ ] Base URL: `https://api.deepseek.com/v1`
  - [ ] `complete()` → POST /chat/completions
  - [ ] `stream()` → POST /chat/completions with stream=True, parse SSE
  - [ ] `health_check()` → checks DEEPSEEK_API_KEY
  - [ ] Retry once on 429 after 2 seconds
- [ ] Create `/app/services/ai_provider/ollama_provider.py`
  - [ ] Uses `ollama.AsyncClient(host=OLLAMA_BASE_URL)`
  - [ ] `complete()` → `client.chat()`
  - [ ] `stream()` → `client.chat(stream=True)`
  - [ ] `health_check()` → GET /api/tags, check if default model is pulled
  - [ ] Clear error if Ollama not running: "Ollama not running at localhost:11434"
  - [ ] Clear error if model not pulled: "Model not pulled. Run: ollama pull {model}"
- [ ] Create `/app/services/ai_provider/factory.py`
  - [ ] `AIProviderFactory.get_provider(provider)` → returns correct provider instance
  - [ ] `AIProviderFactory.get_provider_for_agent(agent_id, user_id, supabase)` → fetches pref from DB, falls back to global, then to Claude default
- [ ] Create `/app/services/ai_provider/preferences_service.py`
  - [ ] `get_preference(user_id, agent_id) -> AIModelPreference`
  - [ ] `set_preference(user_id, agent_id, provider, model_name, temperature) -> AIModelPreference`
  - [ ] `get_available_models() -> dict[str, list[ModelInfo]]` — static hardcoded list
  - [ ] `check_all_health() -> list[ProviderHealthStatus]` — parallel asyncio.gather

## 🔗 Phase 4: API Routes
- [ ] Create `/app/routers/ai_settings.py`
- [ ] `GET /api/v1/ai/models` → returns all available models per provider
- [ ] `GET /api/v1/ai/preferences` → user's preferences for all agents
- [ ] `POST /api/v1/ai/preferences/{agent_id}` → set model for agent
- [ ] `GET /api/v1/ai/health` → parallel health check all 4 providers
- [ ] `GET /api/v1/ai/health/{provider}` → single provider health check
- [ ] Register router in `main.py`
- [ ] All routes use `get_current_user` dependency

## 🔄 Phase 5: Migrate KRONOS
- [ ] Update `/app/agents/kronos/claude_agent.py`:
  - [ ] Replace direct `anthropic_client` call with `AIProviderFactory.get_provider_for_agent()`
  - [ ] Pass `user_id` to factory
  - [ ] KRONOS system prompt stays unchanged
  - [ ] Streaming interface unchanged (still yields text chunks)
- [ ] Test: KRONOS analysis still works after migration
- [ ] Test: Changing KRONOS preference to Ollama → analysis uses Ollama

## 🎨 Phase 6: Frontend Components
- [ ] Create `/src/components/settings/` directory
- [ ] `ProviderHealthBadge.tsx`
  - [ ] Green/yellow/red dot status
  - [ ] Tooltip with error message
  - [ ] Click to re-run health check
- [ ] `OllamaSetupGuide.tsx`
  - [ ] Step-by-step installation guide
  - [ ] Copy-to-clipboard for pull commands
  - [ ] "Test connection" button
- [ ] `ModelSelector.tsx`
  - [ ] 4 provider tabs
  - [ ] Model list with recommended badge
  - [ ] Ollama tab: VRAM info + pull command per model
  - [ ] Disabled tab if provider offline
  - [ ] Temperature slider (0.1–1.0)
  - [ ] Save button → POST /api/v1/ai/preferences/{agent}
- [ ] `AISettings.tsx`
  - [ ] Provider health bar (4 badges)
  - [ ] Agent list with current model badge
  - [ ] "Change" button opens ModelSelector
  - [ ] "Global Default" row at top
  - [ ] Refresh health button
- [ ] Add `/settings/ai` route to React Router
- [ ] Add Settings link in Sidebar (gear icon, bottom)
- [ ] Create `/src/api/aiSettings.ts` — typed API client

## 🧪 Phase 7: Tests
- [ ] `test_claude_provider.py` — mock anthropic SDK, test complete + stream
- [ ] `test_ollama_provider.py` — mock ollama client, test health_check offline/online
- [ ] `test_deepseek_provider.py` — mock httpx, test 429 retry
- [ ] `test_factory.py` — test fallback chain (agent → global → Claude default)
- [ ] `test_preferences_service.py` — test get/set with mock Supabase

## 🚀 Phase 8: Finalization
- [ ] `ruff check app/services/ai_provider/ app/routers/ai_settings.py`
- [ ] `pnpm tsc --noEmit`
- [ ] `pnpm eslint src/components/settings/`
- [ ] Verify no API keys in logs
- [ ] Test all 4 providers manually (if keys available)
- [ ] Test Ollama with qwen2.5:7b-instruct-q4_K_M locally
