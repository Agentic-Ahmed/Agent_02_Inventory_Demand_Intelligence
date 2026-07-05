"""FastAPI application for the Inventory & Demand Intelligence System (CLAUDE.md S10).

Serves the orchestrator + approval queue + triggers + tenant settings + audit trail
+ usage metering to the Web UI. Run locally:
    uvicorn backend.api.app:app --reload
Deployed to Google Cloud Run in prod (CLAUDE.md S2).
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import chat, approvals, triggers, tenant, audit, usage, team, memory, events
from ..observability.tracing import init_observability

# Allowed browser origins: local dev + the Vercel deployment by default; override with
# CORS_ORIGINS (comma-separated) in prod — no code change needed.
_DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000,https://quorum-nu-sand.vercel.app"
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()]

app = FastAPI(
    title="Inventory & Demand Intelligence API",
    version="0.1.0",
    description="Orchestrator chat, approval queue, triggers, tenant settings, audit trail, usage.",
)

# Allow the Next.js frontend (local dev + the deployed Vercel origin) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route agent + request traces to Logfire when LOGFIRE_TOKEN is set (else no-op).
init_observability(app)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "service": "inventory-orchestrator-api", "version": "0.1.0"}


app.include_router(chat.router)
app.include_router(approvals.router)
app.include_router(triggers.router)
app.include_router(tenant.router)
app.include_router(audit.router)
app.include_router(usage.router)
app.include_router(team.router)
app.include_router(memory.router)
app.include_router(events.router)
