"""Event streaming backed by Redpanda / Kafka (CLAUDE.md S2 event streaming, S7 triggers).

The event-driven trigger path: external systems (POS, supplier feeds) publish inventory
events -- a flash-sale spike, a supplier delay -- onto a topic; our system consumes them
and wakes the orchestrator to react (same brain as the scheduled + chat triggers).

Every message is self-describing: it carries its own `tenant_id`, so multi-tenancy
survives the stream (CLAUDE.md S9) -- a drain processes each event for the tenant that
emitted it, never crossing businesses.

Gated + resilient (same contract as core.cache / core.memory): with no REDPANDA_BROKERS
(or confluent-kafka not installed) this is a no-op, so the app runs fine without it, and
any broker error degrades gracefully rather than breaking a request.

Free-tier shape: Render's free service sleeps, so instead of a persistent consumer we
expose a short-lived batch `drain()` meant to be poked by cron / the uptime pinger. Flip
to a background consumer once there's an always-on worker.

Env:
    REDPANDA_BROKERS=<host>:9092            # bootstrap servers (SASL_SSL)
    REDPANDA_USERNAME=<user>
    REDPANDA_PASSWORD=<pass>
    REDPANDA_TOPIC=inventory-events         # optional
    REDPANDA_GROUP=quorum-orchestrator      # optional (consumer group)
    REDPANDA_SASL_MECHANISM=SCRAM-SHA-256   # optional
    REDPANDA_SECURITY_PROTOCOL=SASL_SSL     # optional
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Callable, Optional

try:  # optional dependency: absent/unset -> event streaming is simply disabled
    import confluent_kafka  # noqa: F401

    _HAS_KAFKA = True
except Exception:  # pragma: no cover - import guard
    _HAS_KAFKA = False

TOPIC = os.environ.get("REDPANDA_TOPIC", "inventory-events")
GROUP = os.environ.get("REDPANDA_GROUP", "quorum-orchestrator")


def _base_conf() -> dict[str, Any]:
    conf: dict[str, Any] = {
        "bootstrap.servers": os.environ.get("REDPANDA_BROKERS", ""),
        "security.protocol": os.environ.get("REDPANDA_SECURITY_PROTOCOL", "SASL_SSL"),
        "sasl.mechanisms": os.environ.get("REDPANDA_SASL_MECHANISM", "SCRAM-SHA-256"),
        "sasl.username": os.environ.get("REDPANDA_USERNAME", ""),
        "sasl.password": os.environ.get("REDPANDA_PASSWORD", ""),
    }
    # Pin the CA bundle explicitly so the TLS handshake succeeds regardless of where the
    # host keeps its system certs (belt-and-suspenders for slim container images). An
    # explicit override wins; else certifi if present; else librdkafka's system default.
    ca = os.environ.get("REDPANDA_SSL_CA_LOCATION")
    if not ca:
        try:
            import certifi

            ca = certifi.where()
        except Exception:
            ca = None
    if ca:
        conf["ssl.ca.location"] = ca
    return conf


def _default_producer():  # pragma: no cover - needs a real broker
    from confluent_kafka import Producer

    return Producer(_base_conf())


def _default_consumer():  # pragma: no cover - needs a real broker
    from confluent_kafka import Consumer

    conf = _base_conf()
    conf.update({
        "group.id": GROUP,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,  # commit only after we've processed the batch
    })
    c = Consumer(conf)
    c.subscribe([TOPIC])
    return c


class EventStream:
    """Publish/consume inventory events over a Redpanda topic.

    The producer is created once and reused; a consumer is created per drain (subscribe,
    poll a bounded batch, commit, close) so nothing holds a connection while the free-tier
    service sleeps. Producer/consumer factories are injectable for offline testing.
    """

    def __init__(self, topic: str = TOPIC,
                 producer_factory: Callable[[], Any] = _default_producer,
                 consumer_factory: Callable[[], Any] = _default_consumer) -> None:
        self._topic = topic
        self._make_producer = producer_factory
        self._make_consumer = consumer_factory
        self._producer: Optional[Any] = None

    def _producer_or_create(self):
        if self._producer is None:
            self._producer = self._make_producer()
        return self._producer

    async def publish(self, event: dict, key: Optional[str] = None) -> None:
        """Serialize + produce one event to the topic (blocking client run off-thread)."""
        def _do() -> None:
            p = self._producer_or_create()
            p.produce(
                self._topic,
                key=(key or "").encode() if key else None,
                value=json.dumps(event).encode(),
            )
            p.flush(10)

        await asyncio.to_thread(_do)

    async def drain(self, max_messages: int = 5, poll_timeout: float = 1.0,
                    overall_timeout: float = 8.0) -> list[dict]:
        """Consume up to `max_messages`, returning their decoded payloads.

        Deadline-based, because each drain creates a fresh consumer that must first join
        the group and get a partition assignment -- during which poll() returns None. So
        we keep polling until the overall deadline for the FIRST message; once we've read
        some, an empty poll means the batch is drained and we stop. Offsets commit only
        after the batch is read (a crash re-delivers rather than drops); bad messages are
        skipped, not fatal.
        """
        import time

        def _do() -> list[dict]:
            c = self._make_consumer()
            out: list[dict] = []
            deadline = time.monotonic() + overall_timeout
            try:
                while len(out) < max(1, max_messages) and time.monotonic() < deadline:
                    msg = c.poll(poll_timeout)
                    if msg is None:
                        if out:
                            break  # got the batch, then a gap -> done
                        continue   # still joining / nothing yet -> keep trying until deadline
                    if msg.error():
                        continue
                    try:
                        out.append(json.loads(msg.value()))
                    except (TypeError, ValueError):
                        continue
                if out:
                    c.commit(asynchronous=False)
            finally:
                try:
                    c.close()
                except Exception:
                    pass
            return out

        return await asyncio.to_thread(_do)


_stream: Optional[EventStream] = None
_built = False


def get_stream() -> Optional[EventStream]:
    """The shared EventStream, or None when Redpanda isn't configured/installed."""
    global _stream, _built
    if _built:
        return _stream
    _built = True
    if not (_HAS_KAFKA and os.environ.get("REDPANDA_BROKERS")):
        _stream = None
        return None
    _stream = EventStream()
    return _stream


def stream_enabled() -> bool:
    return get_stream() is not None
