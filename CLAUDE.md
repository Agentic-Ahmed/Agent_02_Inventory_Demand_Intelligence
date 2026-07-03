# CLAUDE.md — Inventory & Demand Intelligence System (Agent 02)

Project instructions for Claude Code. Read this before writing any code.

---

## 1. What we're building

A multi-agent system that autonomously manages the full e-commerce inventory lifecycle:
demand forecasting → reorder/replenishment → warehouse allocation → markdown/pricing →
anomaly detection. It is sold as a **multi-tenant SaaS** to many businesses.

**Core value (lead with outcomes, not "AI"):**
- 20–50% lower forecast error
- Up to 65% fewer stockouts
- 10–15% lower carrying costs
- Reorder cycle: 3–7 days → under 4 hours

---

## 2. Tech stack (non-negotiable choices)

| Layer | Choice | Notes |
|-------|--------|-------|
| Agent framework | **OpenAI Agents SDK (Python)** | Use ALL features (see §4) |
| LLM | **Google Gemini** for EVERY agent | Via LiteLLM (see §3) |
| Vector DB | **Qdrant** (Qdrant Cloud, 1GB free tier) | Semantic memory / RAG |
| Backend | **FastAPI** (Python) | Serves the agents + API |
| Frontend | **Next.js 15 (App Router) + TypeScript** | Responsive PWA: desktop + mobile |
| UI components | **shadcn/ui + Tailwind CSS** | |
| Dashboards/charts | **Tremor** | KPI + analytics views |
| Streaming chat UI | **Vercel AI SDK** | Orchestrator chat panel |
| App DB + sessions (prod) | **Postgres** (Supabase or Neon, free tier) | Session memory backend |
| Cache / queue | **Upstash Redis** (free tier) | |
| Event streaming | **Confluent / Redpanda Cloud** (free tier) | Sales/event triggers |
| Auth | **Clerk** or **Supabase Auth** | |
| Tracing/observability | **Logfire or Langfuse** (free) | NOT OpenAI tracing (see §3) |
| Frontend hosting | **Vercel** (free) | |
| Backend hosting | **Google Cloud Run** (free tier) | |

**Principle: maximize free tiers.** The whole core stack (Gemini + Qdrant + Vercel +
Supabase + Upstash + Logfire) runs at ~$0 for dev and early pilots.

---

## 3. CRITICAL: Running Gemini through the OpenAI Agents SDK

Every agent uses a Gemini model. Use the **LiteLLM extension** (preferred path):

```bash
pip install "openai-agents[litellm]"
```

```python
from agents import Agent
from agents.extensions.models.litellm_model import LitellmModel

def GEMINI(model_name: str) -> LitellmModel:
    return LitellmModel(model=f"gemini/{model_name}", api_key=GEMINI_API_KEY)

agent = Agent(name="...", instructions="...", model=GEMINI("gemini-2.5-pro"))
```

### Model assignment per agent
| Agent | Gemini model | Reason |
|-------|--------------|--------|
| Inventory Orchestrator | `gemini-2.5-pro` | Reasoning / coordination |
| Demand Forecasting | `gemini-2.5-pro` | Complex multi-signal reasoning |
| Reorder / Supplier | `gemini-2.5-flash` | Fast, high-volume |
| Warehouse Allocation | `gemini-2.5-flash` | Frequent optimization |
| Markdown / Pricing | `gemini-2.5-flash` | Frequent, structured |
| Anomaly Detection (guardrail) | `gemini-2.5-flash-lite` | Cheap, runs constantly |

### MUST-FOLLOW gotchas
1. **Do NOT use the Responses API with Gemini** — it isn't supported (causes 404s).
   LiteLLM handles this. If you ever use Gemini's OpenAI-compatible endpoint instead,
   call `set_default_openai_api("chat_completions")`.
2. **Do NOT use the SDK's built-in tracing** (it requires an OpenAI key). Either
   `set_tracing_disabled(True)` or wire a Logfire/Langfuse trace processor.
3. **Set `ModelSettings(include_usage=True)`** on agents — LiteLLM won't report token
   usage otherwise, and we need per-tenant metering/billing.
4. **Validate structured outputs against Gemini** — tool calling + JSON output work on a
   best-effort basis through the adapter. Test every `output_type` schema with Gemini.

---

## 4. Use EVERY OpenAI Agents SDK feature

| Feature | How we use it |
|---------|---------------|
| **Agents** | All 6 agents |
| **Runner** | `run_streamed` for Web UI chat; `run` for scheduled/event jobs |
| **Sessions** | Per-tenant + per-user memory. Key: `f"{tenant_id}:{user_id}"` |
| **Handoffs** | Orchestrator → specialists; specialist → human-escalation |
| **Agents-as-tools** | Manager pattern: orchestrator calls specialists via `.as_tool(...)` |
| **Function tools** | The 9 tools in §6 |
| **Input guardrails** | Block injection / off-scope input (see §5) |
| **Output guardrails** | Enforce spend/markdown/confidence limits (see §5) |
| **Structured outputs** | Pydantic `output_type` for forecasts, POs, markdown plans |
| **Context (`RunContextWrapper`)** | Inject `tenant_id`, DB handles, user role |
| **Tracing** | Logfire/Langfuse processor |
| **Lifecycle hooks** | Audit log + per-tenant usage metering |
| **Dynamic instructions** | Inject per-tenant guardrail thresholds at runtime |
| **Model settings** | `include_usage=True`, temperature, tool_choice |
| **Streaming events** | Live "thinking / calling tool X" in the UI |

### Sessions
- Dev: `SQLiteSession(f"{tenant_id}:{user_id}", "conversations.db")`
- Prod: Postgres-backed session (Supabase/Neon) so memory survives restarts and scales.
- ALWAYS key sessions by tenant — never share memory across businesses.

---

## 5. Guardrails — 4 layers (strong by design)

The money actions (`create_purchase_order`, `apply_markdown`) MUST pass through both a
guardrail (decides to escalate) AND a hard tool-level check (makes over-execution
physically impossible).

1. **Input guardrails** — prompt-injection/jailbreak detection, scope check, PII screen.
   Use a cheap `gemini-2.5-flash-lite` guardrail agent. Trip → reject.
2. **Output guardrails** (business rules from the blueprint §5):
   - **Spend:** auto-approve PO < $10,000; trip → human approval queue.
   - **Markdown:** cap depth at 40% without VP approval; trip → escalate.
   - **Forecast confidence:** if `confidence < 0.7`, trip → human review.
3. **Tool-level hard limits** — validate inside the tool function itself; refuse and
   escalate beyond hard ceilings even if the model tries.
4. **Config-driven safety pack** (optional) — `openai-guardrails` package for
   moderation/PII/hallucination/jailbreak.

Tripwires raise `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`
and halt the run — catch these and route to the human approval inbox.

### Payment execution — Google AP2 (Agent Payments Protocol)

Any agent action that **spends money** (e.g. `create_purchase_order`, and any future
fund-disbursing tool) MUST execute the authorized payment through **Google AP2 (Agent
Payments Protocol)** using a signed spend mandate. Division of responsibility:

- **Guardrails decide WHETHER to spend** — spend (auto-approve < $10k), supplier
  diversity (< 60% category share), forecast confidence, etc.
- **The tool-level hard ceiling is the physical backstop** — never auto-execute above it.
- **AP2 settles HOW the authorized payment executes** — mandates / verifiable credentials.

Never disburse funds outside AP2. AP2 is mocked in dev (see `enforce_and_submit_po`) and
wired to the real protocol in production.

---

## 6. Tools (function tools)

| Tool | Purpose | Integration |
|------|---------|-------------|
| `get_sales_history` | Historical sales by SKU/category/region/time | Data Warehouse |
| `get_external_signals` | Weather, trends, events | External APIs |
| `get_current_inventory` | Real-time stock per SKU per warehouse | WMS API |
| `create_purchase_order` | Submit PO to supplier ERP | Supplier EDI/API |
| `transfer_stock` | Move inventory between fulfillment centers | WMS API |
| `apply_markdown` | Update product pricing | Commerce Platform API |
| `get_supplier_quotes` | Request reorder pricing | Supplier Portal API |
| `send_buyer_alert` | Notify human buyers for approval | Slack / Email API |
| `log_forecast` | Store forecasts for model evaluation | Data Warehouse |

**Money actions & Google AP2:** `create_purchase_order` (and any future fund-disbursing
tool) executes payment via **Google AP2 (Agent Payments Protocol)** and MUST contain a
hard-limit check (see §5). AP2 is the documented standard for every money-spending agent.

---

## 7. Triggers (how the orchestrator runs)

1. **Scheduled** — hourly (Cloud Scheduler / cron).
2. **Event-driven** — flash sales, supplier delays (Kafka/Redpanda).
3. **Human (interactive)** — user asks a question or approves an action via the Web UI.

Same orchestrator brain; only the input/trigger type differs. Route accordingly.

---

## 8. Frontend (Web UI = the only client interface)

Decision: **web-first responsive PWA** (no native apps to start). Works on desktop + mobile.

Key screens:
1. **Dashboard** — KPIs (forecast accuracy, stockout rate, capital freed), inventory health.
2. **Approval inbox** — the guardrail queue: Approve / Reject / Modify (buttons, auditable).
3. **Chat / ask panel** — natural-language Q&A to the orchestrator (streaming).
4. **Forecast & SKU explorer** — per-SKU 7/30/90-day forecasts.
5. **Action log / audit trail** — every autonomous decision, timestamped + reasoned.
6. **Settings** — per-tenant guardrail thresholds (spend, markdown depth, confidence).

Rule: money decisions use **buttons** (auditable), with chat as the explanation layer.

---

## 9. Multi-tenancy (non-negotiable)

- Every session keyed by `tenant_id`.
- Every Qdrant query filtered by `tenant_id` payload (or per-client collection for
  enterprise isolation).
- Postgres row-level security per tenant.
- Per-tenant guardrail thresholds injected via dynamic instructions / context.
- One data leak between business clients is fatal — isolate everything.

---

## 10. Repo layout (target)

```
/backend
  /agents          # orchestrator + 5 specialists, one file each
  /guardrails      # input + output guardrails
  /tools           # the 9 function tools
  /sessions        # session backend (sqlite dev / postgres prod)
  /core            # gemini/litellm config, context, tenant models
  /api             # FastAPI routes (chat, approvals, triggers, webhooks)
  /observability   # logfire/langfuse setup
/frontend          # Next.js + shadcn/ui + Tremor + Vercel AI SDK
/infra             # deployment config (Cloud Run, Vercel)
```

---

## 11. Conventions

- Python: type hints everywhere; Pydantic models for all structured agent outputs.
- Never hardcode secrets — use env vars. `GEMINI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`,
  `DATABASE_URL`, etc.
- `.mcp.json` is gitignored (holds the Context7 API key) — do not commit secrets.
- Every agent: Gemini model + `ModelSettings(include_usage=True)` + relevant guardrails.
- Tool functions that spend money or change prices MUST contain hard-limit checks.
- Always filter by `tenant_id` on any data access.
- Money-spending tools (`create_purchase_order`, etc.) execute payment via **Google AP2
  (Agent Payments Protocol)** with a signed mandate, and MUST contain a hard-limit check (§5).

---

## 12. Build order (suggested)

1. Core: Gemini/LiteLLM config, tenant context, env setup.
2. One agent end-to-end (Forecasting) with structured output + a guardrail + a session.
3. The remaining specialists.
4. Orchestrator with agents-as-tools + input guardrails.
5. The 9 tools (mock integrations first, real APIs later).
6. FastAPI layer (chat streaming, approvals, triggers).
7. Qdrant integration (RAG/memory).
8. Observability (Logfire/Langfuse).
9. Next.js frontend (dashboard → approval inbox → chat).
10. Multi-tenancy hardening + deployment.

---

## 13. On hold / interim rules (READ THIS — remind the user)

**ON HOLD (paused by the user 2026-07-03): free-provider / quota hardening.**
The free Gemini keys hit small daily quotas (esp. `gemini-2.5-pro` ≈ no free quota;
`flash-lite` on the Anomaly agent is flaky). A plan exists to fix this but is deliberately
**not** being worked on yet. When the user reopens this project, **remind them this is on
hold** and offer to resume it. The resume plan:
  - Finish the `FallbackModel` chains for the 4 agents that lack them — **Orchestrator,
    Warehouse, Markdown, Anomaly** (Warehouse/Markdown/Anomaly currently call `GEMINI()`
    directly, so a 429 is a dead end; wrap them in `agent_fallback_model` like Reorder).
  - Free quota is per *account*, not per *key* → give agents **different providers**
    (Groq / Cerebras / Gemini-flash / Mistral / GitHub Models), not more keys on one account.
  - Consider **Ollama (local)** for the always-on Anomaly guardrail = zero quota.
  - Phase-2 Pydantic formatters need a *capable* model (weak free models break strict JSON).
  - Current dev workaround: orchestrator runs on `flash` via `GEMINI_MODEL_ORCHESTRATOR`
    in the gitignored `backend/.env` (see `agent_model()` in `core/config.py`).

**INTERIM RULE — quota reporting:** while the above is on hold, on **every** rate-limit /
quota-exhaustion error (HTTP 429 / `RESOURCE_EXHAUSTED` from any provider), tell the user
plainly: **"Your daily usage limit has been reached."** Do NOT re-diagnose it or build
workarounds each time — just surface that message and move on.
