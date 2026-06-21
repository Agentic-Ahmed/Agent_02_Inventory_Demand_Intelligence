"""Provider fallback chain for Agent 1 (Forecasting) ONLY.

When Gemini's free-tier quota exhausts (HTTP 429 / RESOURCE_EXHAUSTED) -- or the
provider is briefly unavailable -- the Forecasting agent should keep working by
routing to other free LLM providers via LiteLLM, in order:

    Gemini (primary)  ->  Groq  ->  Cerebras  ->  OpenCode Zen (DeepSeek)  ->  OpenRouter

This is deliberately scoped to Agent 1: only the forecasting agent builders use
`forecasting_model()`. The other agents keep their single Gemini model (CLAUDE.md
S3), preserving per-agent isolation.

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

# Ordered fallbacks for forecasting: (label, LiteLLM model string, key env var, base_url).
# base_url is set for OpenAI-compatible gateways (OpenCode Zen). All verified live.
# NOTE: OpenCode Zen's FREE model (deepseek-v4-flash-free) is a reasoning model that
# does NOT support response_format/json_schema -- it serves the Phase-1 analysis, and
# the Phase-2 structured formatter rolls over to the next provider (BadRequestError is
# a fallover trigger). The non-"-free" deepseek-v4-flash requires a payment method.
FORECASTING_FALLBACKS = [
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


def forecasting_model(primary_model_name: str, primary_key: str | None) -> Model:
    """Build the forecasting model with Gemini primary + provider fallbacks.

    If no fallback keys are configured, returns a plain Gemini LitellmModel so
    behaviour is unchanged. Falls back only on quota/availability errors.
    """
    chain: list[tuple[str, Model]] = []
    if primary_key:
        chain.append(("gemini", LitellmModel(model=f"gemini/{primary_model_name}", api_key=primary_key)))
    for label, model_str, env, base_url in FORECASTING_FALLBACKS:
        key = os.environ.get(env)
        if key:
            chain.append((label, LitellmModel(model=model_str, api_key=key, base_url=base_url)))
    if not chain:
        raise RuntimeError("No forecasting model available: set GEMINI_API_KEY_FORECASTING or a fallback key.")
    if len(chain) == 1:
        return chain[0][1]
    return FallbackModel(chain)
