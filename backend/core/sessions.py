"""Session memory helper. Sessions are ALWAYS keyed by tenant + user so memory
is never shared across business clients (CLAUDE.md S4/S9).

Dev uses SQLite; production swaps in a Postgres-backed session.
"""
from agents import SQLiteSession


def make_session(tenant_id: str, user_id: str, db_path: str = "conversations.db") -> SQLiteSession:
    return SQLiteSession(f"{tenant_id}:{user_id}", db_path)
