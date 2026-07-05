"""Observability: route the Agents SDK's traces to Logfire (CLAUDE.md S2/S3).

The SDK's built-in tracing uploads to OpenAI's dashboard and needs an OpenAI key,
so for this Gemini-only deployment we keep it DISABLED by default. When a
LOGFIRE_TOKEN is set, we instead point the SDK's tracing at Pydantic Logfire
(no OpenAI key needed) and instrument FastAPI, giving live traces of every agent
run, tool call, and LLM generation -- per tenant.

Set in backend/.env (gitignored) / the host env to switch it on:
    LOGFIRE_TOKEN=<your Logfire write token>
    LOGFIRE_ENVIRONMENT=production   # optional; labels the environment in Logfire

Observability must never take down the API, so any setup failure falls back to
tracing-disabled.
"""
import os

from agents import set_tracing_disabled


def logfire_enabled() -> bool:
    return bool(os.environ.get("LOGFIRE_TOKEN"))


def init_observability(app=None) -> None:
    """Wire tracing at app startup. With a LOGFIRE_TOKEN, send Agents-SDK + FastAPI
    traces to Logfire; without one, keep tracing off (no OpenAI upload)."""
    if not logfire_enabled():
        set_tracing_disabled(True)
        return
    try:
        import logfire

        logfire.configure(
            token=os.environ["LOGFIRE_TOKEN"],
            service_name="quorum-api",
            environment=os.environ.get("LOGFIRE_ENVIRONMENT", "production"),
            console=False,  # don't spam stdout in prod
            send_to_logfire=True,
        )
        # Route Agents-SDK traces to Logfire instead of OpenAI -> keep tracing ON.
        set_tracing_disabled(False)
        logfire.instrument_openai_agents()
        if app is not None:
            logfire.instrument_fastapi(app)
    except Exception:
        # Never let observability break the API -> fall back to no tracing.
        set_tracing_disabled(True)
