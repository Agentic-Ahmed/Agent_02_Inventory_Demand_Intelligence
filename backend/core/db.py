"""Tiny DB wrapper: SQLite (dev) or Postgres (prod) behind one interface.

Lets the approval queue + audit log share a single code path across both backends
(CLAUDE.md S2: Postgres in prod, SQLite for dev/tests). SQL is written with %s
placeholders (Postgres style) and translated to ? for SQLite.

Backend choice:
  - an explicit sqlite path (e.g. tests passing ':memory:') forces SQLite;
  - else DATABASE_URL set -> Postgres;
  - else a local SQLite file.
A single connection is guarded by a lock (fine for dev / a single worker); Postgres
connections are reopened automatically if the pooled connection drops.
"""
from __future__ import annotations

import os
import threading
from typing import Optional


def database_url() -> str:
    return os.environ.get("DATABASE_URL", "")


class DB:
    def __init__(self, sqlite_path: str, prefer_sqlite: bool = False):
        self._lock = threading.Lock()
        self.postgres = bool(database_url()) and not prefer_sqlite
        if self.postgres:
            import psycopg
            self._psycopg = psycopg
            self._url = database_url()
            self._conn = psycopg.connect(self._url, autocommit=True)
        else:
            import sqlite3
            self._conn = sqlite3.connect(sqlite_path, check_same_thread=False)

    # -- internals -----------------------------------------------------------
    def _conn_broken(self, exc: Exception) -> bool:
        return self.postgres and isinstance(
            exc, (self._psycopg.OperationalError, self._psycopg.InterfaceError)
        )

    def _once(self, q: str, params: tuple, count: bool):
        cur = self._conn.cursor()
        try:
            cur.execute(q, params)
            if count:
                n = cur.rowcount
                if not self.postgres:
                    self._conn.commit()
                return n
            rows = None
            if cur.description:
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            if not self.postgres:
                self._conn.commit()
            return rows
        finally:
            cur.close()

    def _run(self, sql: str, params: tuple, count: bool):
        q = sql if self.postgres else sql.replace("%s", "?")
        with self._lock:
            try:
                return self._once(q, params, count)
            except Exception as exc:  # noqa: BLE001
                if self._conn_broken(exc):  # pooled connection dropped — reopen once
                    self._conn = self._psycopg.connect(self._url, autocommit=True)
                    return self._once(q, params, count)
                raise

    # -- public --------------------------------------------------------------
    def execute(self, sql: str, params: tuple = ()) -> Optional[list[dict]]:
        """Run a statement; returns a list of dict rows for SELECTs, else None."""
        return self._run(sql, params, count=False)

    def execute_count(self, sql: str, params: tuple = ()) -> int:
        """Run a write; returns the number of affected rows (for atomic updates)."""
        return self._run(sql, params, count=True)

    def init(self, statements: list[str]) -> None:
        """Run idempotent DDL. SQLite-only PRAGMAs are skipped on Postgres; errors
        from already-applied DDL (duplicate column/index) are ignored."""
        for s in statements:
            if self.postgres and s.strip().upper().startswith("PRAGMA"):
                continue
            try:
                self.execute(s)
            except Exception:
                pass
