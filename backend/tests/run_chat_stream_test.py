"""Offline verification of the SSE streaming chat endpoint (/api/chat/stream).

Uses StreamingFakeModel (no API key) so we exercise Runner.run_streamed + the SSE
transport end-to-end: text deltas stream, a final 'done' event carries the answer,
and the error path emits an 'error' event. Tool-call / escalation event mapping
reuses the same helpers as the (already-verified) non-streaming /api/chat path.

Run:  python -m backend.tests.run_chat_stream_test
"""
import json

from fastapi.testclient import TestClient

from ..api import orchestration
from ..api.app import app
from ..agents.orchestrator import build_orchestrator
from ..testing.fake_model import StreamingFakeModel

_ANSWER = "Checked SKU-1000: demand is steady; no reorder needed right now."


def _parse_sse(text: str):
    events = []
    for block in text.strip().split("\n\n"):
        ev = data = None
        for line in block.splitlines():
            if line.startswith("event:"):
                ev = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data = line[len("data:"):].strip()
        if ev:
            events.append((ev, json.loads(data) if data else None))
    return events


def _collect(client: TestClient, message: str) -> list[tuple[str, dict]]:
    with client.stream(
        "POST", "/api/chat/stream", json={"message": message, "sku": "SKU-1000"}
    ) as r:
        assert r.status_code == 200, r.status_code
        ctype = r.headers.get("content-type", "")
        assert "text/event-stream" in ctype, ctype
        body = "".join(r.iter_text())
    return _parse_sse(body)


def main() -> None:
    client = TestClient(app)
    original = orchestration.build_orchestrator
    try:
        # Happy path: stream text + done.
        orchestration.build_orchestrator = lambda: build_orchestrator(
            model=StreamingFakeModel(_ANSWER)
        )
        events = _collect(client, "Forecast demand for SKU-1000")
        types = [e for e, _ in events]
        streamed_text = "".join(p["delta"] for e, p in events if e == "text")
        done = [p for e, p in events if e == "done"]

        # Error path: orchestrator construction blows up -> 'error' event.
        def _boom():
            raise RuntimeError("simulated quota failure")

        orchestration.build_orchestrator = _boom
        err_events = _collect(client, "Forecast demand for SKU-1000")
        err_types = [e for e, _ in err_events]
    finally:
        orchestration.build_orchestrator = original

    ok_text = streamed_text == _ANSWER
    ok_done = bool(done) and done[-1]["answer"] == _ANSWER
    ok_err = bool(err_types) and err_types[-1] == "error"

    print("=" * 64)
    print("  /api/chat/stream  --  SSE STREAMING SMOKE TEST")
    print("=" * 64)
    print(f"  happy event types ... {types}")
    print(f"  streamed text ....... {streamed_text!r}")
    print(f"  text == answer ...... {'OK' if ok_text else 'FAIL'}")
    print(f"  done.answer ......... {'OK' if ok_done else 'FAIL'}")
    print(f"  error path .......... {'OK' if ok_err else 'FAIL'}  ({err_types})")
    print("=" * 64)
    if ok_text and ok_done and ok_err:
        print("  ALL PASS")
    else:
        raise SystemExit("  FAILED")


if __name__ == "__main__":
    main()
