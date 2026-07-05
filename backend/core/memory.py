"""Semantic memory / RAG backed by Qdrant (CLAUDE.md S2 Vector DB, S9 multi-tenancy).

Long-term, meaning-searchable memory for the agents: past decisions, chat outcomes,
and tenant knowledge are embedded and stored as vectors; a query retrieves the most
relevant items BY MEANING. This complements the short-term Postgres chat sessions
(core.sessions) -- that's the current conversation; this is durable knowledge across
all of them.

Multi-tenancy is non-negotiable: every point carries a `tenant_id` payload and EVERY
search is filtered by it, so one business never retrieves another's memory (CLAUDE.md S9).

Gated + resilient: with no QDRANT_URL (or qdrant-client not installed) this is a no-op,
so the app runs fine without it; any Qdrant/embedding failure degrades to "no memory"
rather than breaking chat. Embeddings use Gemini via LiteLLM (stack-consistent).

Env:
    QDRANT_URL=https://<cluster>.qdrant.io:6333
    QDRANT_API_KEY=<key>
    QDRANT_COLLECTION=quorum_memory        # optional
    GEMINI_API_KEY_EMBEDDING=<key>         # optional; falls back to the orchestrator key
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

try:  # optional dependency: absent/URL-unset -> memory is simply disabled
    from qdrant_client import AsyncQdrantClient, models

    _HAS_QDRANT = True
except Exception:  # pragma: no cover - import guard
    _HAS_QDRANT = False

EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
VECTOR_SIZE = int(os.environ.get("QDRANT_VECTOR_SIZE", "768"))  # gemini-embedding-001, reduced to 768
COLLECTION = os.environ.get("QDRANT_COLLECTION", "quorum_memory")

Embedder = Callable[[list[str]], Awaitable[list[list[float]]]]


def _embed_key() -> Optional[str]:
    from .config import agent_key  # lazy: avoids import cycle

    return os.environ.get("GEMINI_API_KEY_EMBEDDING") or agent_key("orchestrator")


async def _gemini_embed(texts: list[str]) -> list[list[float]]:
    """Embed text with Gemini via LiteLLM (same stack as the agents)."""
    import litellm

    # Reduce gemini-embedding-001 from its native 3072 dims to VECTOR_SIZE so the
    # vectors match the collection; cosine is scale-invariant so no normalization needed.
    resp = await litellm.aembedding(
        model=f"gemini/{EMBED_MODEL}", input=list(texts), api_key=_embed_key(),
        dimensions=VECTOR_SIZE,
    )
    data = resp["data"] if isinstance(resp, dict) else resp.data
    return [d["embedding"] if isinstance(d, dict) else d.embedding for d in data]


class QdrantMemory:
    """Tenant-isolated vector memory over a Qdrant collection."""

    def __init__(self, client, collection: str, vector_size: int, embed_fn: Embedder) -> None:
        self._client = client
        self._collection = collection
        self._size = vector_size
        self._embed = embed_fn
        self._ready = False

    async def _ensure(self) -> None:
        if self._ready:
            return
        if not await self._client.collection_exists(self._collection):
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=models.VectorParams(size=self._size, distance=models.Distance.COSINE),
            )
            # Keyword index on tenant_id so the per-tenant filter stays fast.
            await self._client.create_payload_index(
                collection_name=self._collection,
                field_name="tenant_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
        self._ready = True

    async def add(self, tenant_id: str, text: str, kind: str = "note",
                  metadata: Optional[dict] = None) -> str:
        """Embed + store one memory for a tenant. Returns the point id."""
        await self._ensure()
        vector = (await self._embed([text]))[0]
        pid = str(uuid.uuid4())
        payload = {
            "tenant_id": tenant_id,
            "text": text,
            "kind": kind,
            "ts": datetime.now(timezone.utc).isoformat(),
            **(metadata or {}),
        }
        await self._client.upsert(
            collection_name=self._collection,
            points=[models.PointStruct(id=pid, vector=vector, payload=payload)],
        )
        return pid

    async def search(self, tenant_id: str, query: str, limit: int = 4,
                     min_score: float = 0.0) -> list[dict[str, Any]]:
        """Semantic search, ALWAYS filtered to this tenant (CLAUDE.md S9)."""
        await self._ensure()
        vector = (await self._embed([query]))[0]
        res = await self._client.query_points(
            collection_name=self._collection,
            query=vector,
            limit=limit,
            query_filter=models.Filter(
                must=[models.FieldCondition(key="tenant_id", match=models.MatchValue(value=tenant_id))]
            ),
        )
        out: list[dict[str, Any]] = []
        for p in res.points:
            if p.score is None or p.score < min_score:
                continue
            payload = p.payload or {}
            out.append({"text": payload.get("text", ""), "kind": payload.get("kind"), "score": p.score})
        return out


_memory: Optional[QdrantMemory] = None
_built = False


def get_memory() -> Optional[QdrantMemory]:
    """The shared memory instance, or None when Qdrant isn't configured/installed."""
    global _memory, _built
    if _built:
        return _memory
    _built = True
    url = os.environ.get("QDRANT_URL")
    if not (_HAS_QDRANT and url):
        _memory = None
        return None
    client = AsyncQdrantClient(url=url, api_key=os.environ.get("QDRANT_API_KEY"))
    _memory = QdrantMemory(client, COLLECTION, VECTOR_SIZE, _gemini_embed)
    return _memory
