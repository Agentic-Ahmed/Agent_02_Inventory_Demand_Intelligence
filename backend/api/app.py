"""FastAPI application for the Inventory & Demand Intelligence System (CLAUDE.md S10).

Serves the orchestrator + approval queue + triggers + tenant settings to the Web UI.
Run locally:
    uvicorn backend.api.app:app --reload
Deployed to Google Cloud Run in prod (CLAUDE.md S2).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import chat, approvals, triggers, tenant

app = FastAPI(
    title="Inventory & Demand Intelligence API",
    version="0.1.0",
    description="Orchestrator chat, guardrail approval queue, scheduled/event triggers, tenant settings.",
)

# Dev CORS: allow the Next.js frontend (localhost) to call the API. Lock down in prod.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "service": "inventory-orchestrator-api", "version": "0.1.0"}


app.include_router(chat.router)
app.include_router(approvals.router)
app.include_router(triggers.router)
app.include_router(tenant.router)
