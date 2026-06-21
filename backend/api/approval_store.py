"""In-memory approval queue: where guardrail escalations land for human review.

This is the backend of the Approval Inbox screen (CLAUDE.md S8): when a money/price
action or a low-confidence/critical result trips a guardrail, it is parked here for
Approve / Reject rather than auto-executed. In-memory for dev; swap for Postgres
(per-tenant, row-level security) in prod (CLAUDE.md S2/S9).
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ApprovalStore:
    def __init__(self) -> None:
        self._items: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, tenant_id: str, action_type: str, sku: str, summary: str,
               detail: Optional[dict] = None) -> dict[str, Any]:
        item = {
            "id": uuid.uuid4().hex[:12],
            "tenant_id": tenant_id,
            "action_type": action_type,
            "sku": sku,
            "summary": summary,
            "detail": detail or {},
            "status": "pending",
            "created_at": _now(),
            "resolved_at": None,
            "resolved_by": None,
        }
        with self._lock:
            self._items[item["id"]] = item
        return item

    def list(self, tenant_id: str, status: Optional[str] = "pending") -> list[dict[str, Any]]:
        with self._lock:
            items = [i for i in self._items.values() if i["tenant_id"] == tenant_id]
        if status:
            items = [i for i in items if i["status"] == status]
        return sorted(items, key=lambda i: i["created_at"], reverse=True)

    def get(self, item_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            return self._items.get(item_id)

    def resolve(self, item_id: str, status: str, by: str, note: str = "") -> Optional[dict[str, Any]]:
        with self._lock:
            item = self._items.get(item_id)
            if item is None or item["status"] != "pending":
                return None
            item["status"] = status
            item["resolved_at"] = _now()
            item["resolved_by"] = by
            if note:
                item["detail"] = {**item["detail"], "resolution_note": note}
            return item


# Module-level singleton (dev). Prod: per-tenant Postgres-backed store.
STORE = ApprovalStore()
