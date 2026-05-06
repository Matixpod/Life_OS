# 🧠 AI MODEL SELECTOR — Coding Prompt

## [ROLE / CONTEXT]

You are extending an existing Life OS application (FastAPI + React 18 + Supabase).
The system currently uses Claude API (claude-sonnet-4-20250514) hardcoded in all agents.

You are building a **universal AI provider abstraction layer** that allows:
- Selecting AI provider per agent (KRONOS, ARES, ATHENA, etc.)
- Supported providers: Claude API, Gemini API, DeepSeek API, Ollama (local)
- Persisting user's model choices in Supabase
- Frontend settings panel to switch models
- Zero changes required in existing agent code — agents call one unified interface

Ollama runs locally on the same machine as the application (localhost:11434).

---

## [OLLAMA MODEL RECOMMENDATIONS]

Hardware: RTX 3070 Ti (8GB VRAM), R9 9950X3D, 32GB RAM
Ollama runs locally — models load into VRAM.

**Recommended models (in order of preference):**

| Model | VRAM | Use Case | Ollama tag |
|---|---|---|---|
| Qwen2.5 7B Instruct Q4_K_M | ~4.5GB | Best all-round for agents | `qwen2.5:7b-instruct-q4_K_M` |
| Llama 3.1 8B Instruct Q4_K_M | ~5.0GB | Reliable fallback | `llama3.1:8b-instruct-q4_K_M` |
| Gemma 2 9B Instruct Q4_K_M | ~5.5GB | Best reasoning quality | `gemma2:9b-instruct-q4_K_M` |
| Qwen2.5 Coder 7B Q4_K_M | ~4.5GB | Code-heavy tasks | `qwen2.5-coder:7b-q4_K_M` |

**Default recommendation:** `qwen2.5:7b-instruct-q4_K_M`
- Fits comfortably in 8GB VRAM
- Excellent instruction following for agent personas
- Fast inference on RTX 3070 Ti (~30-50 tok/s)

**Note:** 14B+ models require CPU offloading (partial layers to 32GB RAM) —
performance drops significantly. Stick to 7-9B for real-time agent feedback.

---

## [TASK]

Build a complete AI provider abstraction with:
1. Backend provider abstraction layer (`/app/services/ai_provider/`)
2. Supabase table for storing model preferences per agent
3. FastAPI routes for managing model settings
4. Frontend settings panel with model selector per agent
5. Migration of existing KRONOS agent to use the new abstraction

---

## [TECHNICAL CONSTRAINTS]

- Python 3.12, TypeScript strict, FastAPI, Pydantic v2, supabase-py, React 18 + TailwindCSS v3
- Ollama runs at `http://localhost:11434` — use `ollama` Python package
- Gemini via `google-generativeai` Python package
- DeepSeek via HTTP (OpenAI-compatible API at `https://api.deepseek.com/v1`)
- Claude via existing `anthropic` SDK
- All API keys stored in environment variables — never in DB or code
- Provider selection persists in `ai_model_preferences` Supabase table
- Streaming must work for ALL providers (SSE to frontend)

---

## [REQUIREMENTS]

### Database (`migrations/006_ai_model_preferences.sql`)

```sql
CREATE TYPE ai_provider AS ENUM ('claude', 'gemini', 'deepseek', 'ollama');

CREATE TABLE ai_model_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,  -- 'kronos', 'ares', 'athena', 'global'
  provider    ai_provider NOT NULL DEFAULT 'claude',
  model_name  TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

ALTER TABLE ai_model_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON ai_model_preferences FOR ALL USING (user_id = auth.uid());
```

### Backend — Provider Abstraction (`/app/services/ai_provider/`)

**`base.py`** — abstract interface:
```python
class AIMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

class AIProviderConfig(BaseModel):
    provider: AIProvider
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 1000
    system_prompt: str | None = None

class BaseAIProvider(ABC):
    @abstractmethod
    async def complete(self, messages: list[AIMessage], config: AIProviderConfig) -> str:
        """Non-streaming completion."""

    @abstractmethod
    async def stream(self, messages: list[AIMessage], config: AIProviderConfig) -> AsyncIterator[str]:
        """Streaming completion — yields text chunks."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is available."""
```

**`claude_provider.py`** — wraps existing anthropic SDK:
- Migrate current KRONOS claude_agent.py to use this
- Support streaming via `anthropic.AsyncAnthropic`
- Models: `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`, `claude-opus-4-6`
- health_check: verify ANTHROPIC_API_KEY is set and valid

**`gemini_provider.py`** — Google Gemini:
- Use `google-generativeai` package
- Support streaming via `generate_content_async` with `stream=True`
- Models: `gemini-2.0-flash`, `gemini-2.5-pro`
- health_check: verify GEMINI_API_KEY is set

**`deepseek_provider.py`** — DeepSeek (OpenAI-compatible):
- Use `httpx.AsyncClient` — OpenAI-compatible REST API
- Base URL: `https://api.deepseek.com/v1`
- Support streaming via SSE (`stream=True` in request body)
- Models: `deepseek-chat`, `deepseek-reasoner`
- health_check: verify DEEPSEEK_API_KEY is set

**`ollama_provider.py`** — Local Ollama:
- Use `ollama` Python package (`ollama.AsyncClient`)
- Base URL: `http://localhost:11434`
- Support streaming via `ollama.AsyncClient().chat(stream=True)`
- Default model: `qwen2.5:7b-instruct-q4_K_M`
- health_check: GET `http://localhost:11434/api/tags` — check if running + model exists
- On health_check failure: return clear error "Ollama not running or model not pulled"

**`factory.py`** — provider factory:
```python
class AIProviderFactory:
    @staticmethod
    def get_provider(provider: AIProvider) -> BaseAIProvider:
        match provider:
            case AIProvider.CLAUDE:    return ClaudeProvider()
            case AIProvider.GEMINI:    return GeminiProvider()
            case AIProvider.DEEPSEEK:  return DeepSeekProvider()
            case AIProvider.OLLAMA:    return OllamaProvider()

    @staticmethod
    async def get_provider_for_agent(agent_id: str, user_id: str, supabase) -> tuple[BaseAIProvider, AIProviderConfig]:
        """Fetch user's preference for this agent from DB, return configured provider."""
        # Falls back to global preference, then to Claude default
```

**`preferences_service.py`** — DB operations:
- `get_preference(user_id, agent_id) -> AIModelPreference`
- `set_preference(user_id, agent_id, provider, model_name) -> AIModelPreference`
- `get_available_models() -> dict[str, list[ModelInfo]]` — static list of all models per provider
- `check_provider_health(provider) -> ProviderHealthStatus`

### Backend — API Routes (`/app/routers/ai_settings.py`)

```
GET  /api/v1/ai/models              → all available models per provider
GET  /api/v1/ai/preferences         → user's current preferences for all agents
POST /api/v1/ai/preferences/{agent} → set model for specific agent
GET  /api/v1/ai/health              → health check all 4 providers
GET  /api/v1/ai/health/{provider}   → health check single provider
```

### Available Models Response (`GET /api/v1/ai/models`)

```json
{
  "claude": [
    {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4.6", "recommended": true},
    {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "recommended": false},
    {"id": "claude-opus-4-6", "name": "Claude Opus 4.6", "recommended": false}
  ],
  "gemini": [
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "recommended": true},
    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "recommended": false}
  ],
  "deepseek": [
    {"id": "deepseek-chat", "name": "DeepSeek Chat", "recommended": true},
    {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner", "recommended": false}
  ],
  "ollama": [
    {"id": "qwen2.5:7b-instruct-q4_K_M", "name": "Qwen 2.5 7B (Recommended)", "recommended": true, "vram_gb": 4.5},
    {"id": "llama3.1:8b-instruct-q4_K_M", "name": "Llama 3.1 8B", "recommended": false, "vram_gb": 5.0},
    {"id": "gemma2:9b-instruct-q4_K_M", "name": "Gemma 2 9B", "recommended": false, "vram_gb": 5.5},
    {"id": "qwen2.5-coder:7b-q4_K_M", "name": "Qwen 2.5 Coder 7B", "recommended": false, "vram_gb": 4.5}
  ]
}
```

### Frontend — AI Settings Panel (`/src/components/settings/`)

**`AISettings.tsx`** — main settings page:
- Section per agent (KRONOS, ARES, ATHENA... + Global Default)
- Each agent row: agent icon + name + current model badge + "Change" button
- Provider health status bar at top (4 indicators: Claude/Gemini/DeepSeek/Ollama)
- "Test connection" button per provider
- Ollama section: special note "Wymaga lokalnej instalacji Ollama"

**`ModelSelector.tsx`** — model picker modal/drawer:
- Provider tabs: Claude / Gemini / DeepSeek / Ollama
- Model list per tab with recommended badge
- Ollama tab: shows VRAM requirement per model + install command
  (`ollama pull qwen2.5:7b-instruct-q4_K_M`)
- Confirm button saves to backend
- Disabled tab if provider health = offline

**`ProviderHealthBadge.tsx`** — single provider status:
- Green dot = online, red dot = offline, yellow = checking
- Click to re-run health check
- Tooltip: error message if offline

**`OllamaSetupGuide.tsx`** — shown when Ollama is offline:
- Step 1: Download Ollama (link to ollama.com)
- Step 2: `ollama pull qwen2.5:7b-instruct-q4_K_M`
- Step 3: Verify connection button

---

## [ENVIRONMENT VARIABLES]

Add to `.env` and `.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-...        # existing
GEMINI_API_KEY=AIza...              # new
DEEPSEEK_API_KEY=sk-...             # new
OLLAMA_BASE_URL=http://localhost:11434  # new, configurable
```

---

## [MIGRATION — KRONOS to use abstraction]

After building the abstraction layer, migrate `claude_agent.py`:

**Before:**
```python
async with anthropic_client.messages.stream(...) as stream:
    async for text in stream.text_stream:
        yield text
```

**After:**
```python
provider, config = await AIProviderFactory.get_provider_for_agent(
    agent_id="kronos",
    user_id=user_id,
    supabase=supabase,
)
async for chunk in provider.stream(messages, config):
    yield chunk
```

The system prompt (KRONOS persona) stays in `claude_agent.py` — only the
provider call changes. Agent logic is completely unchanged.

---

## [EDGE CASES]

- Ollama offline → health check returns error, model selector disables Ollama tab,
  shows OllamaSetupGuide
- API key missing → health check returns "API key not configured", not 500
- User selects model mid-stream → takes effect on next analysis, not current
- DeepSeek rate limit (429) → retry once after 2s, then surface error to frontend
- Gemini safety filter blocks response → catch `BlockedPromptException`,
  return user-friendly message "Response blocked by safety filter"
- `get_provider_for_agent` with unknown agent_id → falls back to global preference
- Global preference not set → defaults to Claude claude-sonnet-4-20250514

---

## [ADDITIONAL INSTRUCTIONS]

- Add `ollama`, `google-generativeai`, `httpx` to `backend/requirements.txt`
- All provider classes must be independently testable (no global state)
- Provider health checks run in parallel (`asyncio.gather`) on `/api/v1/ai/health`
- Model names in DB are stored as-is (e.g. `qwen2.5:7b-instruct-q4_K_M`) — not normalized
- Settings route: `/settings/ai` in React Router
- Link to AI Settings from main sidebar (gear icon, bottom of nav)
- Temperature control: slider 0.1–1.0, default 0.7, per agent
- Never log API keys — mask them in any debug output

Think step by step before writing any code.
