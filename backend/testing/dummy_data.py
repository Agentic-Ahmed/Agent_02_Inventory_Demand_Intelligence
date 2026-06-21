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


def generate_warehouse_datasets(n: int = 50, seed: int = 11) -> list[dict]:
    """Deterministic warehouse-allocation scenarios. Buckets (clean, one outcome each):
      bucket 0      -> no action     (network already balanced, no transfers)
      bucket 1      -> safety trip   (planned transfer drops a source below safety)
      bucket 2, 3   -> auto-allocate (surplus -> deficit, respects safety stock)
    Each carries a `mock_decision` (AllocationPlan) the FakeModel emits in mock mode.
    """
    rng = random.Random(seed)
    datasets: list[dict] = []
    for i in range(n):
        sku = f"SKU-{3000 + i}"
        bucket = i % 4

        if bucket == 0:  # balanced -> no action
            warehouses = {
                "WH-A": {"on_hand": 200, "safety_stock": 50, "demand_7d": 120, "capacity": 1000},
                "WH-B": {"on_hand": 180, "safety_stock": 50, "demand_7d": 110, "capacity": 1000},
            }
            transfers, rebalance = [], 0
        elif bucket == 1:  # transfer would drop WH-A below safety -> guardrail trips
            warehouses = {
                "WH-A": {"on_hand": 100, "safety_stock": 80, "demand_7d": 90, "capacity": 1000},
                "WH-B": {"on_hand": 40, "safety_stock": 50, "demand_7d": 120, "capacity": 1000},
            }
            qty = 50  # WH-A: 100 - 50 = 50 < safety 80 -> violation
            transfers = [{"from_warehouse": "WH-A", "to_warehouse": "WH-B", "qty": qty}]
            rebalance = qty
        else:  # surplus -> deficit, safe
            surplus = rng.randint(250, 400)
            qty = rng.randint(80, 150)  # WH-A: surplus - qty >= 100 >= safety 50
            warehouses = {
                "WH-A": {"on_hand": surplus, "safety_stock": 50, "demand_7d": 100, "capacity": 1000},
                "WH-B": {"on_hand": 30, "safety_stock": 50, "demand_7d": 150, "capacity": 1000},
            }
            transfers = [{"from_warehouse": "WH-A", "to_warehouse": "WH-B", "qty": qty}]
            rebalance = qty

        datasets.append(
            {
                "sku": sku,
                "data_age_hours": 0.5,
                "warehouses": warehouses,
                "mock_decision": {
                    "sku": sku,
                    "transfers": transfers,
                    "rebalance_units": rebalance,
                    "reasoning": "mock allocation plan",
                },
            }
        )
    return datasets


def generate_markdown_datasets(n: int = 50, seed: int = 13) -> list[dict]:
    """Deterministic markdown/pricing scenarios for the Markdown Agent eval.
    Buckets (clean, one outcome each):
      bucket 0      -> no action          (healthy sell-through, fresh stock)
      bucket 1      -> depth trip         (markdown > 40% -> markdown_depth guardrail)
      bucket 2, 3   -> auto-markdown      (0 < markdown <= 40%, applied autonomously)
    Each carries a `mock_decision` (MarkdownPlan) the FakeModel emits in mock mode.
    """
    rng = random.Random(seed)
    datasets: list[dict] = []
    for i in range(n):
        sku = f"SKU-{4000 + i}"
        bucket = i % 4
        current_price = round(rng.uniform(10, 200), 2)

        if bucket == 0:  # selling well -> no markdown
            on_hand, days_of_supply = 120, 18
            sell_through, age_days = round(rng.uniform(0.80, 0.95), 2), rng.randint(5, 20)
            markdown_pct = 0.0
        elif bucket == 1:  # badly overstocked + stale -> deep cut trips the 40% guardrail
            on_hand, days_of_supply = 900, rng.randint(120, 200)
            sell_through, age_days = round(rng.uniform(0.05, 0.15), 2), rng.randint(90, 180)
            markdown_pct = round(rng.uniform(0.45, 0.60), 2)
        else:  # moderately slow -> shallow auto-markdown within 40%
            on_hand, days_of_supply = 300, rng.randint(45, 80)
            sell_through, age_days = round(rng.uniform(0.30, 0.50), 2), rng.randint(30, 60)
            markdown_pct = round(rng.uniform(0.10, 0.35), 2)

        new_price = round(current_price * (1 - markdown_pct), 2)
        datasets.append(
            {
                "sku": sku,
                "data_age_hours": 0.5,
                "current_price": current_price,
                "on_hand": on_hand,
                "days_of_supply": days_of_supply,
                "sell_through_rate": sell_through,
                "age_days": age_days,
                "mock_decision": {
                    "sku": sku,
                    "current_price": current_price,
                    "markdown_pct": markdown_pct,
                    "new_price": new_price,
                    "reasoning": "mock markdown plan",
                },
            }
        )
    return datasets


def generate_anomaly_datasets(n: int = 50, seed: int = 17) -> list[dict]:
    """Deterministic anomaly-detection scenarios for the Anomaly Agent eval.
    Buckets (clean, one outcome each):
      bucket 0      -> no anomaly        (recent readings near baseline)
      bucket 1      -> minor anomaly     (moderate spike, severity medium -> logged)
      bucket 2      -> demand spike      (severe spike, severity high -> guardrail trips)
      bucket 3      -> data error        (impossible value, severity high -> guardrail trips)
    Each carries a `mock_decision` (AnomalyReport) the FakeModel emits in mock mode.
    """
    rng = random.Random(seed)
    datasets: list[dict] = []
    for i in range(n):
        sku = f"SKU-{5000 + i}"
        bucket = i % 4
        mean = rng.randint(80, 160)
        std = max(5, int(mean * 0.1))
        expected_range = [int(mean - 4 * std), int(mean + 4 * std)]
        on_hand = rng.randint(300, 800)

        if bucket == 0:  # normal
            recent = [mean + rng.randint(-std, std) for _ in range(5)]
            decision = {"is_anomaly": False, "anomaly_type": "none", "severity": "none",
                        "recommended_action": "monitor", "reasoning": "within normal range"}
        elif bucket == 1:  # moderate spike -> medium
            recent = [mean + rng.randint(2 * std, 3 * std) for _ in range(5)]
            decision = {"is_anomaly": True, "anomaly_type": "demand_spike", "severity": "medium",
                        "recommended_action": "escalate", "reasoning": "moderate spike vs baseline"}
        elif bucket == 2:  # severe spike -> high
            recent = [mean + rng.randint(8 * std, 12 * std) for _ in range(5)]
            decision = {"is_anomaly": True, "anomaly_type": "demand_spike", "severity": "high",
                        "recommended_action": "halt_autonomous", "reasoning": "severe demand spike"}
        else:  # data error -> high (impossible negative stock)
            recent = [mean + rng.randint(-std, std) for _ in range(5)]
            on_hand = -rng.randint(10, 100)
            decision = {"is_anomaly": True, "anomaly_type": "data_error", "severity": "high",
                        "recommended_action": "halt_autonomous", "reasoning": "negative on-hand stock"}

        decision["sku"] = sku
        datasets.append(
            {
                "sku": sku,
                "data_age_hours": 0.5,
                "recent_window": recent,
                "baseline_mean": mean,
                "baseline_std": std,
                "on_hand": on_hand,
                "expected_range": expected_range,
                "mock_decision": decision,
            }
        )
    return datasets
