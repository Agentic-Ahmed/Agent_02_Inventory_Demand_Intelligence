"""Per-agent provider fallback chains.

When an agent's Gemini free-tier quota exhausts (HTTP 429 / RESOURCE_EXHAUSTED) --
or the provider is briefly unavailable -- the agent keeps working by routing to
other free LLM providers via LiteLLM, in order:

    Gemini (primary)  ->  Groq  ->  Cerebras  ->  OpenCode Zen (DeepSeek)  ->  OpenRouter

Each agent that opts in uses its OWN provider keys, read as `{PROVIDER}_API_KEY_{AGENT}`
(e.g. GROQ_API_KEY_FORECASTING, GROQ_API_KEY_REORDER). Providers with no key for that
agent are skipped, so per-agent isolation (CLAUDE.md S3) holds across the fallbacks too.
Opt in per agent via `agent_fallback_model(agent, ...)`; agents that don't opt in keep
their single Gemini model.

`FallbackModel` implements the Agents SDK `Model` interface and is a drop-in for
`LitellmModel`, so `Agent(model=FallbackModel(...))` just works.
"""
from __future__ import annotations

import os
from collections.abc import AsyncIterator

import litellm
from agents.models.interface import Model
from agents.extensions.models.litellm_model import LitellmModel

def _litellm_errors(*names) -> tuple[type, ...]:
    """Resolve litellm exception classes by name, tolerating version differences."""
    out = []
    for n in names:
        cls = getattr(litellm, n, None)
        if isinstance(cls, type) and issubclass(cls, Exception):
            out.append(cls)
    return tuple(out)


# Errors that mean "this provider can't serve -> advance to the next". Covers
# quota exhaustion (RateLimitError), transient unavailability, AND provider-config
# problems (auth/payment/model-missing) so a mis-set or unfunded provider in the
# chain is skipped instead of breaking forecasting.
_FALLOVER_ERRORS = _litellm_errors(
    "RateLimitError", "ServiceUnavailableError", "InternalServerError",
    "Timeout", "APIConnectionError", "AuthenticationError", "NotFoundError",
    "PermissionDeniedError",
    # Provider-specific request rejections (e.g. Groq's intermittent Llama
    # tool-call validation failures) -> roll to the next provider rather than fail.
    "BadRequestError", "UnprocessableEntityError",
)

# Ordered fallback providers: (label, LiteLLM model string, key-env PREFIX, base_url).
# The actual env var read is f"{prefix}_{AGENT}" (e.g. GROQ_API_KEY_REORDER), so each
# agent supplies its own keys. base_url is set for OpenAI-compatible gateways.
# NOTE: OpenCode Zen's FREE model (deepseek-v4-flash-free) is a reasoning model that
# does NOT support response_format/json_schema -- it serves the Phase-1 analysis, and
# the Phase-2 structured formatter rolls over to the next provider (BadRequestError is
# a fallover trigger). The non-"-free" deepseek-v4-flash requires a payment method.
FALLBACK_PROVIDERS = [
    ("groq", "groq/llama-3.3-70b-versatile", "GROQ_API_KEY", None),
    ("cerebras", "cerebras/gpt-oss-120b", "CEREBRAS_API_KEY", None),
    ("opencode-zen", "openai/deepseek-v4-flash-free", "OPENCODE_ZEN_API_KEY", "https://opencode.ai/zen/v1"),
    ("openrouter", "openrouter/meta-llama/llama-3.1-8b-instruct", "OPENROUTER_API_KEY", None),
]


class FallbackModel(Model):
    """Tries an ordered list of models, advancing past a provider that is rate-
    limited/unavailable. Raises the last error only if every provider fails."""

    def __init__(self, models: list[tuple[str, Model]]):
        if not models:
            raise ValueError("FallbackModel needs at least one (label, model).")
        self._models = models

    @property
    def labels(self) -> list[str]:
        return [label for label, _ in self._models]

    async def get_response(self, *args, **kwargs):
        last_exc: Exception | None = None
        for label, model in self._models:
            try:
                return await model.get_response(*args, **kwargs)
            except _FALLOVER_ERRORS as exc:
                last_exc = exc
                continue
        assert last_exc is not None
        raise last_exc

    async def stream_response(self, *args, **kwargs) -> AsyncIterator:
        last_exc: Exception | None = None
        for label, model in self._models:
            try:
                async for event in model.stream_response(*args, **kwargs):
                    yield event
                return
            except _FALLOVER_ERRORS as exc:
                last_exc = exc
                continue
        if last_exc is not None:
            raise last_exc

    async def close(self) -> None:
        for _, model in self._models:
            try:
                await model.close()
            except Exception:  # noqa: BLE001 - best effort cleanup
                pass


def agent_fallback_model(agent: str, primary_model_name: str, primary_key: str | None) -> Model:
    """Build a model with Gemini primary + provider fallbacks for one agent.

    Fallback keys are read per agent as f"{PROVIDER}_API_KEY_{AGENT}". Providers
    with no key for this agent are skipped. If only the primary is available,
    returns a plain Gemini LitellmModel so behaviour is unchanged.
    """
    chain: list[tuple[str, Model]] = []
    if primary_key:
        chain.append(("gemini", LitellmModel(model=f"gemini/{primary_model_name}", api_key=primary_key)))
    suffix = agent.upper()
    for label, model_str, prefix, base_url in FALLBACK_PROVIDERS:
        key = os.environ.get(f"{prefix}_{suffix}")
        if key:
            chain.append((label, LitellmModel(model=model_str, api_key=key, base_url=base_url)))
    if not chain:
        raise RuntimeError(
            f"No model available for agent '{agent}': set GEMINI_API_KEY_{suffix} or a fallback key."
        )
    if len(chain) == 1:
        return chain[0][1]
    return FallbackModel(chain)


def forecasting_model(primary_model_name: str, primary_key: str | None) -> Model:
    """Backwards-compatible wrapper: the forecasting agent's fallback chain."""
    return agent_fallback_model("forecasting", primary_model_name, primary_key)
