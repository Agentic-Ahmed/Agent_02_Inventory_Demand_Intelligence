"""Input guardrails (Layer 1, CLAUDE.md S5): run before the agent does any work.

- data_freshness_guardrail: blocks a forecast run if input data is stale
  (> max_data_age_hours) — blueprint S5 #5.
- scope_guardrail: rejects prompt-injection and off-scope requests.

Both are deterministic (no LLM call) so they're fast, free, and testable.
"""
from agents import (
    Agent,
    GuardrailFunctionOutput,
    RunContextWrapper,
    input_guardrail,
)

from ..core.context import RunContext

_INJECTION_MARKERS = [
    "ignore previous",
    "ignore all previous",
    "ignore the above",
    "disregard your instructions",
    "reveal your system prompt",
    "you are now",
    "jailbreak",
]
_SCOPE_KEYWORDS = [
    "forecast", "demand", "sku", "inventory", "stock", "reorder",
    "sales", "replenish", "markdown", "supplier",
]


def _as_text(input_data) -> str:
    if isinstance(input_data, str):
        return input_data
    parts = []
    for item in input_data or []:
        if isinstance(item, dict):
            content = item.get("content")
            if isinstance(content, str):
                parts.append(content)
            elif isinstance(content, list):
                for c in content:
                    if isinstance(c, dict) and isinstance(c.get("text"), str):
                        parts.append(c["text"])
    return " ".join(parts)


@input_guardrail
async def data_freshness_guardrail(
    ctx: RunContextWrapper[RunContext], agent: Agent, input_data
) -> GuardrailFunctionOutput:
    age = getattr(ctx.context, "data_age_hours", 0.0)
    max_age = ctx.context.tenant.max_data_age_hours
    tripped = age > max_age
    return GuardrailFunctionOutput(
        output_info={
            "type": "data_freshness",
            "data_age_hours": age,
            "max_data_age_hours": max_age,
            "tripped": tripped,
        },
        tripwire_triggered=tripped,
    )


@input_guardrail
async def scope_guardrail(
    ctx: RunContextWrapper[RunContext], agent: Agent, input_data
) -> GuardrailFunctionOutput:
    text = _as_text(input_data).lower()
    injection = any(m in text for m in _INJECTION_MARKERS)
    on_topic = any(k in text for k in _SCOPE_KEYWORDS)
    tripped = injection or not on_topic
    return GuardrailFunctionOutput(
        output_info={
            "type": "scope",
            "injection": injection,
            "on_topic": on_topic,
            "tripped": tripped,
        },
        tripwire_triggered=tripped,
    )
