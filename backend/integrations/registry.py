"""Resolve which source a tool should use for a given tenant + system kind.

If the tenant has connected a real system for that kind (Settings -> Integrations)
AND we have an endpoint for it, return a live RestSource; otherwise return None and
the tool uses its deterministic mock. Fully crash-safe: any lookup error -> None.

Credential handling (CLAUDE.md S11 -- never hardcode secrets): the integrations table
stores only a MASKED hint, never the raw secret. The real credential is read from the
secrets vault via an env var, so nothing sensitive is persisted in the app DB:

    INTEGRATION_SECRET__{TENANT}__{KIND}   (upper-cased; non-alphanumerics -> '_')

e.g. tenant "acme" + kind "wms" -> INTEGRATION_SECRET__ACME__WMS. If it's unset, the
endpoint is called without an Authorization header (fine for open or tenant-internal
endpoints, and for dev). Every tool is tenant-scoped (CLAUDE.md S9): the lookup only
ever sees the caller's own connections.
"""
from __future__ import annotations

import os
import re
from typing import Optional

from .rest import RestSource

# The integration kinds a tool can actually call out to. "events" is a stream, not a
# request/response endpoint, so it's handled by core.events, not this seam.
_CALLABLE = {"wms", "erp", "commerce", "warehouse_data", "slack"}


def _vault_key(tenant_id: str, kind: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "_", f"{tenant_id}_{kind}".upper()).strip("_")
    return f"INTEGRATION_SECRET__{slug}"


def _credential(tenant_id: str, kind: str) -> Optional[str]:
    return os.environ.get(_vault_key(tenant_id, kind)) or None


def resolve_source(tenant_id: str, kind: str) -> Optional[RestSource]:
    """A live RestSource bound to the tenant's connected endpoint for `kind`, or None
    (use the mock) if nothing's connected / no endpoint / on any error."""
    if kind not in _CALLABLE or not tenant_id:
        return None
    try:
        from ..api.integration_store import INTEGRATIONS
        for it in INTEGRATIONS.list(tenant_id):
            if it.get("kind") == kind and it.get("status") == "connected":
                endpoint = (it.get("config") or {}).get("endpoint")
                if endpoint:
                    return RestSource(str(endpoint), token=_credential(tenant_id, kind))
                return None
    except Exception:
        return None
    return None


def live_read(tenant_id: str, kind: str, path: str = "",
              params: Optional[dict] = None) -> Optional[dict]:
    """Read from the tenant's connected system, or None if not connected / on failure."""
    src = resolve_source(tenant_id, kind)
    return src.get(path, params) if src else None


def live_write(tenant_id: str, kind: str, path: str = "",
               payload: Optional[dict] = None) -> Optional[dict]:
    """Write to the tenant's connected system, or None if not connected / on failure."""
    src = resolve_source(tenant_id, kind)
    return src.post(path, payload) if src else None
