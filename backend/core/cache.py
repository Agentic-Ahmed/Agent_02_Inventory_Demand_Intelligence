"""Redis cache + rate limiting backed by Upstash (CLAUDE.md S2 cache / queue).

Two jobs today, both per-tenant:
  - A JSON response cache for read-heavy aggregates (e.g. /api/usage, which re-scans
    the audit table on every load) -- short TTL, so a burst of dashboard loads hits
    Redis instead of Postgres.
  - A fixed-window rate limiter that protects the expensive chat endpoints (and thus
    our Gemini quota) from runaway refresh loops.

Gated + resilient (same contract as core.memory / observability.tracing): with no
UPSTASH_REDIS_REST_URL (or the client not installed) this is a no-op, so the app runs
fine without it. Every operation is wrapped so a Redis outage degrades gracefully --
a cache miss for reads, and *fail-open* (allow the request) for the limiter. We never
block a real request because the cache is having a bad day.

Uses Upstash's HTTPS REST API (port 443), so it travels the same TLS path as the rest
of the stack -- no extra Redis port to open, and it works from serverless/Cloud Run.

Env:
    UPSTASH_REDIS_REST_URL=https://<db>.upstash.io
    UPSTASH_REDIS_REST_TOKEN=<token>
    CACHE_PREFIX=quorum                 # optional; namespaces every key
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional

try:  # optional dependency: absent/URL-unset -> caching + limiting are simply disabled
    from upstash_redis.asyncio import Redis

    _HAS_UPSTASH = True
except Exception:  # pragma: no cover - import guard
    _HAS_UPSTASH = False

PREFIX = os.environ.get("CACHE_PREFIX", "quorum")

_redis: Optional[Any] = None
_built = False


def get_redis() -> Optional[Any]:
    """The shared Upstash client, or None when Redis isn't configured/installed."""
    global _redis, _built
    if _built:
        return _redis
    _built = True
    url = os.environ.get("UPSTASH_REDIS_REST_URL")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if not (_HAS_UPSTASH and url and token):
        _redis = None
        return None
    try:
        _redis = Redis(url=url, token=token)
    except Exception:  # pragma: no cover - construction guard
        _redis = None
    return _redis


def cache_enabled() -> bool:
    return get_redis() is not None


def _key(*parts: str) -> str:
    return ":".join((PREFIX, *parts))


async def cache_get_json(key: str) -> Optional[Any]:
    """Read + JSON-decode a cached value, or None on miss / any error."""
    r = get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(_key(key))
    except Exception:
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int = 30) -> None:
    """JSON-encode + store a value with a TTL. Silent no-op if Redis is unavailable."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.set(_key(key), json.dumps(value), ex=max(1, ttl_seconds))
    except Exception:
        pass


async def cache_invalidate(key: str) -> None:
    """Drop a cached key now (e.g. after a write). No-op if Redis is unavailable."""
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(_key(key))
    except Exception:
        pass


async def rate_limit(bucket: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Fixed-window limiter -> (allowed, remaining).

    FAIL-OPEN by design: if Redis is unconfigured or erroring, always allow, so cache
    trouble can never take chat down. Increments a per-window counter and sets its TTL
    on first hit; allowed while count <= limit.
    """
    r = get_redis()
    if r is None:
        return True, limit
    key = _key("rl", bucket)
    try:
        count = await r.incr(key)
        if count == 1:  # first request in this window -> start the expiry clock
            await r.expire(key, max(1, window_seconds))
        return count <= limit, max(0, limit - count)
    except Exception:
        return True, limit
