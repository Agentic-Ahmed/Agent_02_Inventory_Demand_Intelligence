"""Core configuration: per-agent Gemini model factory + env loading.

Every agent runs on a Gemini model via the LiteLLM extension (CLAUDE.md S3).
Each agent uses its OWN Gemini API key so each gets an independent free-tier
rate limit and clean per-agent metering.
"""
import os

# Use the OS certificate store (e.g. the Windows trust store) so corporate
# TLS-proxy root CAs are trusted WITHOUT disabling verification. Must run before
# any HTTPS client builds its SSL context.
try:
    import truststore

    truststore.inject_into_ssl()
except Exception:
    pass

from dotenv import load_dotenv
from agents import set_tracing_disabled
from agents.extensions.models.litellm_model import LitellmModel

# Auto-retry transient errors (e.g. 429 rate limits on the free tier) with
# exponential backoff so bulk eval runs ride out the per-minute quota.
import litellm as _litellm

_litellm.num_retries = 5

# Load backend/.env if present (never commit it; holds the per-agent keys).
_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ENV_PATH)

# Gemini-only deployment: the SDK's built-in tracing uploads to OpenAI and needs
# an OpenAI key, so disable it (CLAUDE.md S3 gotcha #2). Use Logfire/Langfuse later.
set_tracing_disabled(True)

# Corporate TLS-intercepting proxies present a certificate that public CA bundles
# don't trust, which breaks HTTPS to Gemini. For LOCAL TESTING ONLY, set
# INSECURE_SSL=1 to disable LiteLLM's TLS verification. NEVER use in production —
# fix it properly by adding the corporate root CA to the trust store instead.
if os.environ.get("INSECURE_SSL") == "1":
    import litellm

    litellm.ssl_verify = False
    try:
        litellm.disable_aiohttp_transport = True
    except Exception:
        pass

# One env var per agent -> independent rate limits + isolation.
AGENT_KEY_ENV = {
    "orchestrator": "GEMINI_API_KEY_ORCHESTRATOR",
    "forecasting": "GEMINI_API_KEY_FORECASTING",
    "reorder": "GEMINI_API_KEY_REORDER",
    "warehouse": "GEMINI_API_KEY_WAREHOUSE",
    "markdown": "GEMINI_API_KEY_MARKDOWN",
    "anomaly": "GEMINI_API_KEY_ANOMALY",
}

# Default production model per agent (CLAUDE.md S3).
AGENT_MODEL = {
    "orchestrator": "gemini-2.5-pro",
    "forecasting": "gemini-2.5-pro",
    "reorder": "gemini-2.5-flash",
    "warehouse": "gemini-2.5-flash",
    "markdown": "gemini-2.5-flash",
    "anomaly": "gemini-2.5-flash-lite",
}


def agent_key(agent: str) -> str | None:
    """Resolve the Gemini API key for a given agent from its own env var."""
    return os.environ.get(AGENT_KEY_ENV[agent])


def GEMINI(model_name: str, api_key: str | None) -> LitellmModel:
    """Build a Gemini model (via LiteLLM) for an agent.

    LiteLLM handles Gemini's lack of Responses-API support automatically
    (CLAUDE.md S3 gotcha #1).
    """
    if not api_key:
        raise RuntimeError(
            "Missing Gemini API key for this agent. Set the per-agent env var "
            "(see backend/.env.example)."
        )
    return LitellmModel(model=f"gemini/{model_name}", api_key=api_key)
