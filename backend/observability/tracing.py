"""Observability stub.

The SDK's built-in tracing targets OpenAI's dashboard and needs an OpenAI key,
so for this Gemini-only deployment we disable it (done in core.config). A
Logfire or Langfuse trace processor will be wired here in a later pass
(CLAUDE.md S2/S3).
"""
from agents import set_tracing_disabled


def init_observability() -> None:
    set_tracing_disabled(True)
