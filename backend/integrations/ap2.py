"""Google AP2 (Agent Payments Protocol) -- the money-settlement seam.

Every fund-disbursing tool (CLAUDE.md S5/S6: create_purchase_order, and any future one)
settles its authorized payment through AP2 using a SIGNED SPEND MANDATE. Division of
responsibility (CLAUDE.md S5):
  * guardrails decide WHETHER to spend (spend / supplier-diversity / confidence),
  * the tool-level HARD CEILING is the physical backstop (checked BEFORE we get here),
  * AP2 settles HOW the authorized payment executes -- this module.

This is a faithful, swap-ready model of the protocol shape:
  - an INTENT mandate: what the tenant authorized an agent to spend + the constraints it
    was checked against (currency, settlement ceiling, auto-approve threshold, ...);
  - a CART mandate: the specific line items the agent wants to pay for;
  - a real cryptographic SIGNATURE over the canonical mandate. Dev signs with HMAC-SHA256
    and AP2_SIGNING_KEY; production swaps _sign/_verify for the real AP2 verifiable-
    credential signer (the agent's DID key) with no change to callers.

settle() is the ONLY place funds move (CLAUDE.md S5: "Never disburse funds outside AP2").
It independently refuses to disburse a cart that exceeds its own signed authorization or a
tampered/expired mandate -- a protocol-level backstop separate from the tool's hard ceiling.
When AP2_ENDPOINT is set it POSTs the signed mandate to the real AP2 gateway; otherwise it
mock-settles locally (dev). Point AP2_ENDPOINT at a live gateway and it goes real.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..core.context import TenantContext
from .rest import RestSource

_PROTOCOL = "AP2"
_VERSION = "0.1"
_DEV_KEY = "dev-ap2-signing-key-not-for-production"  # overridden by AP2_SIGNING_KEY
_MANDATE_TTL_SECONDS = 15 * 60


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _signing_key() -> bytes:
    return os.environ.get("AP2_SIGNING_KEY", _DEV_KEY).encode()


def _canonical(payload: dict) -> bytes:
    """Deterministic bytes for signing/verifying (order-independent)."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def _sign_value(mandate_without_sig: dict) -> str:
    return hmac.new(_signing_key(), _canonical(mandate_without_sig), hashlib.sha256).hexdigest()


def build_spend_mandate(tenant: TenantContext, cart: dict, scope: str = "purchase_order",
                        currency: str = "USD") -> dict:
    """Assemble an UNSIGNED spend mandate: the tenant's authorization scope (intent) plus
    the concrete cart. The settlement ceiling is the tenant's HARD PO ceiling (the tool's
    authority boundary); the auto-approve threshold is recorded so the mandate shows whether
    the spend needed human approval (decided upstream by the guardrail layer)."""
    total = round(float(cart.get("total", 0.0)), 2)
    created = _now()
    return {
        "protocol": _PROTOCOL,
        "version": _VERSION,
        "mandate_id": f"apm_{uuid.uuid4().hex[:16]}",
        "type": "spend",
        "intent": {
            "authorized_by": tenant.tenant_id,
            "scope": scope,
            "currency": currency,
            "max_amount": round(float(tenant.hard_po_ceiling), 2),
            "auto_approve_limit": round(float(tenant.po_auto_approve_limit), 2),
            "requires_human_approval": total > float(tenant.po_auto_approve_limit),
            "constraints": {"max_supplier_share": round(float(tenant.max_supplier_share), 4)},
        },
        "cart": {
            "payee": cart.get("payee", ""),
            "currency": currency,
            "total": total,
            "lines": list(cart.get("lines", [])),
        },
        "created_at": _iso(created),
        "expires_at": _iso(created + timedelta(seconds=_MANDATE_TTL_SECONDS)),
    }


def sign_mandate(mandate: dict) -> dict:
    """Return a copy of the mandate with a signature block over its canonical form."""
    signed = {k: v for k, v in mandate.items() if k != "signature"}
    signed["signature"] = {
        "alg": "HMAC-SHA256",
        "key_id": os.environ.get("AP2_KEY_ID", "dev"),
        "value": _sign_value(signed),
        "signed_at": _iso(_now()),
    }
    return signed


def verify_mandate(mandate: dict) -> bool:
    """True iff the mandate carries a valid signature over its (unsigned) canonical form."""
    sig = (mandate.get("signature") or {}).get("value")
    if not sig:
        return False
    unsigned = {k: v for k, v in mandate.items() if k != "signature"}
    return hmac.compare_digest(sig, _sign_value(unsigned))


def _expired(mandate: dict) -> bool:
    try:
        return _now() > datetime.fromisoformat(mandate["expires_at"])
    except Exception:
        return True  # unparseable expiry -> treat as expired (fail closed)


def _reject(mandate: dict, reason: str) -> dict:
    return {
        "status": "rejected",
        "protocol": _PROTOCOL,
        "mandate_id": mandate.get("mandate_id"),
        "reason": reason,
    }


def _ap2_endpoint() -> Optional[str]:
    return os.environ.get("AP2_ENDPOINT") or None


def settle(mandate: dict) -> dict:
    """Settle a SIGNED spend mandate -> a receipt. The only place funds move.

    Protocol-level backstops (independent of the tool's hard ceiling): a valid signature,
    a positive amount within the mandate's authorized ceiling, and a non-expired mandate.
    With AP2_ENDPOINT set, POSTs to the real gateway (unreachable -> reject, never a silent
    mock of a real payment); otherwise mock-settles locally (dev)."""
    if not verify_mandate(mandate):
        return _reject(mandate, "invalid or missing signature")
    cart = mandate.get("cart", {})
    intent = mandate.get("intent", {})
    total = float(cart.get("total", 0.0))
    if total <= 0:
        return _reject(mandate, "non-positive amount")
    if total > float(intent.get("max_amount", 0.0)):
        return _reject(mandate, f"amount {total} exceeds authorized ceiling {intent.get('max_amount')}")
    if _expired(mandate):
        return _reject(mandate, "mandate expired")

    receipt: dict[str, Any] = {
        "status": "settled",
        "protocol": _PROTOCOL,
        "mandate_id": mandate.get("mandate_id"),
        "amount": round(total, 2),
        "currency": cart.get("currency", "USD"),
        "payee": cart.get("payee", ""),
        "settled_at": _iso(_now()),
    }

    endpoint = _ap2_endpoint()
    if endpoint:
        resp = RestSource(endpoint, token=os.environ.get("AP2_CREDENTIAL")).post(
            "settle", {"mandate": mandate})
        if resp is None:
            return _reject(mandate, "AP2 gateway unreachable")
        receipt["mode"] = "live"
        receipt["transaction_id"] = resp.get("transaction_id", f"aptx_{uuid.uuid4().hex[:16]}")
        receipt["gateway"] = resp
        return receipt

    receipt["mode"] = "mock"
    receipt["transaction_id"] = f"aptx_{uuid.uuid4().hex[:16]}"
    return receipt


def authorize_and_settle(tenant: TenantContext, cart: dict, scope: str = "purchase_order",
                         currency: str = "USD") -> dict:
    """Build -> sign -> settle in one step. Returns {"mandate": <signed>, "receipt": <receipt>}."""
    mandate = sign_mandate(build_spend_mandate(tenant, cart, scope=scope, currency=currency))
    return {"mandate": mandate, "receipt": settle(mandate)}
