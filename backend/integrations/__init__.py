"""The integration seam: turn a tenant's CONNECTED system into a real call.

Tools (CLAUDE.md S6) are mocked by default. When a tenant connects one of their own
systems in Settings -> Integrations (a WMS, supplier ERP, commerce platform, data
warehouse, or Slack), the matching tool routes its read/write to that system's real
endpoint via `live_read` / `live_write`. If nothing is connected -- or the live call
fails for any reason -- the tool falls back to its deterministic mock, so the agent
never breaks. This is the single swap-point where a real vendor adapter drops in.
"""
from . import ap2
from .registry import live_read, live_write, resolve_source
from .rest import RestSource

__all__ = ["live_read", "live_write", "resolve_source", "RestSource", "ap2"]
