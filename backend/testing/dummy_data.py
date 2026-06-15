"""Deterministic dummy data generator for the 50-set forecasting eval.

Each dataset carries:
- a 90-day sales history (base demand + seasonality + noise),
- external signals (weather/trend/promo),
- data_age_hours (some stale to exercise the freshness guardrail),
- a HIDDEN ground-truth next-7-day demand (to score forecast error / MAPE),
- an expected_confidence (low for volatile SKUs -> exercises confidence guardrail),
- a mock_predicted_units baseline (used by the mock FakeModel).

Seeded so counts are stable across runs.
"""
import math
import random


def generate_datasets(n: int = 50, seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    datasets: list[dict] = []
    for i in range(n):
        sku = f"SKU-{1000 + i}"
        base = rng.randint(20, 200)
        cv = rng.uniform(0.05, 0.65)  # coefficient of variation (volatility)

        history = []
        for d in range(90):
            seasonal = 1 + 0.2 * math.sin(2 * math.pi * d / 30)
            noise = max(0.0, rng.gauss(1.0, cv))
            history.append(max(0, int(base * seasonal * noise)))

        # Hidden ground-truth future 7 days (lower noise = the "actuals").
        future = []
        for d in range(90, 97):
            seasonal = 1 + 0.2 * math.sin(2 * math.pi * d / 30)
            noise = max(0.0, rng.gauss(1.0, cv * 0.3))
            future.append(max(0, int(base * seasonal * noise)))
        ground_truth_7d = sum(future)

        # ~1 in 8 datasets is stale -> trips the data-freshness guardrail.
        if i % 8 == 0:
            data_age = round(rng.uniform(3.0, 10.0), 2)
        else:
            data_age = round(rng.uniform(0.1, 1.9), 2)

        # Confidence inversely tracks volatility; some land below 0.70.
        confidence = round(max(0.30, min(0.98, 1.0 - cv)), 2)

        # Mock baseline forecast: recent 7-day average projected over the horizon.
        recent = history[-7:]
        mock_pred = int(round(sum(recent) / len(recent) * 7 / 7 * 7))  # ~7-day total

        signals = {
            "weather": rng.choice(["sunny", "rainy", "cold", "hot"]),
            "trend_index": round(rng.uniform(0.8, 1.2), 2),
            "promo": rng.choice([True, False]),
        }

        datasets.append(
            {
                "sku": sku,
                "history": history,
                "signals": signals,
                "data_age_hours": data_age,
                "future": future,
                "ground_truth_7d": ground_truth_7d,
                "expected_confidence": confidence,
                "mock_predicted_units": mock_pred,
                "cv": round(cv, 3),
            }
        )
    return datasets


def generate_reorder_datasets(n: int = 50, seed: int = 7) -> list[dict]:
    """Deterministic reorder scenarios for the Reorder & Supplier Agent eval.

    Engineered into buckets so each guardrail and outcome is exercised, and at
    most one guardrail trips per scenario (clean test buckets):
      bucket 0          -> no action  (stock sufficient, qty = 0)
      bucket 1, 2       -> diversity  (supplier share > 60%, cost < $10k)
      bucket 3, 4       -> spend      (cost > $10k, share < 60%)
      bucket 5, 6, 7    -> auto-approve (cost < $10k, share < 60%)

    Each carries a `mock_decision` the FakeModel emits in mock mode.
    """
    rng = random.Random(seed)
    datasets: list[dict] = []
    for i in range(n):
        sku = f"SKU-{2000 + i}"
        bucket = i % 8

        if bucket == 0:  # no reorder needed
            on_hand, reorder_point, forecast_7d = 600, 100, 50
            qty = 0
            unit_price = round(rng.uniform(5, 50), 2)
            share = round(rng.uniform(0.10, 0.50), 2)
        elif bucket in (1, 2):  # supplier-diversity trip (share > 60%, cost < 10k)
            on_hand, reorder_point, forecast_7d = 20, 100, 80
            qty = reorder_point + forecast_7d - on_hand  # 160
            unit_price = round(rng.uniform(5, 15), 2)     # cost ~ 800-2400
            share = round(rng.uniform(0.62, 0.85), 2)
        elif bucket in (3, 4):  # spend-approval trip (cost > 10k, share < 60%)
            on_hand, reorder_point, forecast_7d = 10, 200, 300
            qty = reorder_point + forecast_7d - on_hand  # 490
            unit_price = round(rng.uniform(30, 80), 2)    # cost ~ 14.7k-39.2k
            share = round(rng.uniform(0.10, 0.50), 2)
        else:  # auto-approve (cost < 10k, share < 60%)
            on_hand, reorder_point, forecast_7d = 30, 100, 60
            qty = reorder_point + forecast_7d - on_hand  # 130
            unit_price = round(rng.uniform(5, 40), 2)     # cost ~ 650-5200
            share = round(rng.uniform(0.10, 0.50), 2)

        total = round(qty * unit_price, 2)
        quotes = [
            {
                "supplier_id": "SUP-A",
                "unit_price": unit_price,
                "lead_time_days": rng.randint(2, 14),
                "category_share": share,
            }
        ]
        datasets.append(
            {
                "sku": sku,
                "on_hand": on_hand,
                "reorder_point": reorder_point,
                "forecast_demand_7d": forecast_7d,
                "quotes": quotes,
                "mock_decision": {
                    "sku": sku,
                    "reorder_qty": qty,
                    "supplier_id": "SUP-A",
                    "unit_cost": unit_price,
                    "total_cost": total,
                    "supplier_category_share": share,
                    "reasoning": "mock reorder decision",
                },
            }
        )
    return datasets
