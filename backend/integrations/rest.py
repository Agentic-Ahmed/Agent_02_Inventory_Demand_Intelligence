"""Generic REST adapter -- the default live implementation behind the seam.

Turns a tenant's connected endpoint into real HTTP calls. Crash-safe by design: any
network / HTTP / parse error returns None so the calling tool falls back to its mock
and the agent never breaks. A tenant's endpoint is expected to speak a small JSON
contract (the same shape the tool would otherwise mock); a specific vendor (Shopify,
SAP, a particular WMS) gets its own adapter that subclasses this and maps its native
API, dropped in behind resolve_source() without touching the tools.

Uses only urllib (stdlib) so there's no new dependency; on the backend the network is
clean, and locally it works if the process has truststore injected (else it degrades
to the mock like every other live call here).
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any, Optional


class RestSource:
    def __init__(self, base: str, token: Optional[str] = None, timeout: float = 5.0) -> None:
        self.base = (base or "").rstrip("/")
        self.token = token
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        h = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _url(self, path: str = "", params: Optional[dict] = None) -> str:
        url = self.base if not path else f"{self.base}/{path.lstrip('/')}"
        clean = {k: v for k, v in (params or {}).items() if v is not None}
        if clean:
            url += "?" + urllib.parse.urlencode(clean)
        return url

    def _parse(self, body: str) -> dict[str, Any]:
        """A 2xx response with a JSON body -> parsed dict; empty or non-JSON (e.g. a
        Slack webhook's "ok") still counts as success so notify actions register."""
        if not body.strip():
            return {"ok": True}
        try:
            data = json.loads(body)
            return data if isinstance(data, dict) else {"data": data}
        except Exception:
            return {"ok": True, "body": body[:200]}

    def get(self, path: str = "", params: Optional[dict] = None) -> Optional[dict]:
        try:
            req = urllib.request.Request(
                self._url(path, params), headers=self._headers(), method="GET")
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return self._parse(r.read().decode())
        except Exception:
            return None

    def post(self, path: str = "", payload: Optional[dict] = None) -> Optional[dict]:
        try:
            data = json.dumps(payload or {}).encode()
            req = urllib.request.Request(
                self._url(path), data=data, headers=self._headers(), method="POST")
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return self._parse(r.read().decode())
        except Exception:
            return None
