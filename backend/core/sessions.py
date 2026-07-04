"""Per-tenant chat memory, backed by Postgres (prod) or SQLite (dev).

Sessions are ALWAYS keyed by tenant + user, so conversation memory is never shared
across business clients or users (CLAUDE.md S4 Sessions, S9 multi-tenancy). This
implements the OpenAI Agents SDK Session interface on top of core.db.DB, so the
SAME code persists to Neon Postgres when DATABASE_URL is set and to a local SQLite
file otherwise -- memory survives restarts and scales in prod.

Backend choice mirrors the audit / approval stores:
  - an explicit SESSIONS_DB path forces SQLite (tests pass ':memory:');
  - else DATABASE_URL -> Postgres;
  - else a local sessions.db file.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from .db import DB


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DBSession:
    """OpenAI Agents SDK Session implementation over core.db.DB.

    Each conversation item is stored as a JSON row ordered by an auto-incrementing
    sequence, so get / add / pop preserve turn order identically on SQLite and
    Postgres. The sync DB calls run in a worker thread so they never block the
    event loop while an agent turn is in flight.
    """

    def __init__(self, session_id: str, db: DB) -> None:
        self.session_id = session_id
        self._db = db

    async def get_items(self, limit: Optional[int] = None) -> list[dict[str, Any]]:
        def _read() -> list[dict[str, Any]]:
            if limit is None:
                rows = self._db.execute(
                    "SELECT item FROM agent_sessions WHERE session_id=%s ORDER BY seq ASC",
                    (self.session_id,),
                )
            else:
                # The latest `limit` items, returned oldest-first (matches SQLiteSession).
                rows = self._db.execute(
                    "SELECT item FROM (SELECT seq, item FROM agent_sessions "
                    "WHERE session_id=%s ORDER BY seq DESC LIMIT %s) sub ORDER BY seq ASC",
                    (self.session_id, max(0, limit)),
                )
            return [json.loads(r["item"]) for r in (rows or [])]

        return await asyncio.to_thread(_read)

    async def add_items(self, items: list[dict[str, Any]]) -> None:
        if not items:
            return

        def _write() -> None:
            ts = _now()
            for it in items:
                self._db.execute(
                    "INSERT INTO agent_sessions (session_id, item, ts) VALUES (%s,%s,%s)",
                    (self.session_id, json.dumps(it), ts),
                )

        await asyncio.to_thread(_write)

    async def pop_item(self) -> Optional[dict[str, Any]]:
        def _pop() -> Optional[dict[str, Any]]:
            rows = self._db.execute(
                "SELECT seq, item FROM agent_sessions WHERE session_id=%s "
                "ORDER BY seq DESC LIMIT 1",
                (self.session_id,),
            )
            if not rows:
                return None
            row = rows[0]
            self._db.execute("DELETE FROM agent_sessions WHERE seq=%s", (row["seq"],))
            return json.loads(row["item"])

        return await asyncio.to_thread(_pop)

    async def clear_session(self) -> None:
        def _clear() -> None:
            self._db.execute(
                "DELETE FROM agent_sessions WHERE session_id=%s", (self.session_id,)
            )

        await asyncio.to_thread(_clear)


def _build_db() -> DB:
    override = os.environ.get("SESSIONS_DB")
    db = DB(override or "sessions.db", prefer_sqlite=bool(override))
    # Auto-increment column differs per backend; pick the right one.
    idcol = "BIGSERIAL PRIMARY KEY" if db.postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
    db.init([
        f"CREATE TABLE IF NOT EXISTS agent_sessions ("
        f"seq {idcol}, session_id TEXT NOT NULL, item TEXT NOT NULL, ts TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_agent_sessions_sid ON agent_sessions(session_id, seq)",
        "PRAGMA journal_mode=WAL",
    ])
    return db


# Module-level session DB (see backend choice in the module docstring).
_SESSION_DB = _build_db()


def make_session(tenant_id: str, user_id: str = "user") -> DBSession:
    """Session for a (tenant, user) pair, so memory is isolated per business AND
    per user -- never shared across clients (CLAUDE.md S9)."""
    return DBSession(f"{tenant_id}:{user_id}", _SESSION_DB)
