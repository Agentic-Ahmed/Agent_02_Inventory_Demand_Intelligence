"""Real-data loader for the Demand Forecasting Agent (Agent #1) eval.

Source: Kaggle "Store Item Demand Forecasting Challenge"
(competition slug: demand-forecasting-kernels-only). train.csv has one row per
(date, store, item) with a daily `sales` count -- exactly the daily-series shape
Agent #1 forecasts.

This module does two things, both with the STANDARD LIBRARY only (the corporate
TLS proxy blocks pip/PyPI, but urllib + truststore reaches kaggle.com fine):

  1. download_store_item_csv(): pull train.csv via the Kaggle REST API using
     HTTP basic auth (KAGGLE_USERNAME / KAGGLE_KEY). No `kaggle` pip package.
  2. load_store_item_datasets(): reshape the CSV into the SAME dataset dicts the
     synthetic generate_datasets() produces, so run_forecasting_eval.py consumes
     real data unchanged:
        sku, history (90d), future (7d), ground_truth_7d, cv,
        expected_confidence, mock_predicted_units, data_age_hours, signals.

For each (store, item) series we hold out the LAST 7 days as the hidden
ground truth and use the 90 days before that as the history the agent sees --
a real out-of-sample 7-day forecast test scored by MAPE.
"""
import base64
import csv as _csv
import io
import os
import ssl
import statistics
import urllib.request
import zipfile

try:  # trust the OS cert store so the corporate TLS proxy doesn't break HTTPS
    import truststore

    truststore.inject_into_ssl()
except Exception:  # pragma: no cover - best effort
    pass

COMPETITION = "demand-forecasting-kernels-only"
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", ".data")
_CSV_PATH = os.path.join(_DATA_DIR, "store_item_train.csv")

HISTORY_DAYS = 90
HORIZON_DAYS = 7


def _kaggle_auth_header() -> str:
    user = os.environ.get("KAGGLE_USERNAME")
    key = os.environ.get("KAGGLE_KEY")
    if not key:
        raise RuntimeError(
            "Set KAGGLE_USERNAME and KAGGLE_KEY (paste your Kaggle username + API "
            "key). Get the key from kaggle.com -> Settings -> Create New API Token."
        )
    # Newer Kaggle tokens (prefixed "KGAT_") authenticate as a Bearer token; the
    # classic 32-hex keys use HTTP basic auth (username:key).
    if key.startswith("KGAT_"):
        return f"Bearer {key}"
    if not user:
        raise RuntimeError("Classic Kaggle keys need KAGGLE_USERNAME set too.")
    return "Basic " + base64.b64encode(f"{user}:{key}".encode()).decode()


def download_store_item_csv(dest: str = _CSV_PATH, force: bool = False) -> str:
    """Download train.csv from the Kaggle competition API to `dest`.

    Requires having accepted the competition rules at
    kaggle.com/c/demand-forecasting-kernels-only (else the API returns 403).
    Returns the path to the extracted CSV.
    """
    if os.path.exists(dest) and not force:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    url = (
        f"https://www.kaggle.com/api/v1/competitions/data/download/"
        f"{COMPETITION}/train.csv"
    )
    req = urllib.request.Request(url, headers={"Authorization": _kaggle_auth_header()})
    # Kaggle 302-redirects to a signed storage URL; that URL needs no auth, so a
    # default opener (which follows redirects) is fine.
    with urllib.request.urlopen(req, timeout=120) as resp:
        blob = resp.read()
    # The file usually arrives zipped (train.csv.zip). Detect by magic bytes.
    if blob[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            name = next(n for n in zf.namelist() if n.endswith(".csv"))
            blob = zf.read(name)
    with open(dest, "wb") as f:
        f.write(blob)
    return dest


def _read_series(csv_path: str) -> dict[tuple[str, str], list[tuple[str, int]]]:
    """Group rows into {(store, item): [(date, sales), ...]} sorted by date."""
    series: dict[tuple[str, str], list[tuple[str, int]]] = {}
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        for row in _csv.DictReader(f):
            key = (row["store"], row["item"])
            series.setdefault(key, []).append((row["date"], int(float(row["sales"]))))
    for key in series:
        series[key].sort(key=lambda r: r[0])
    return series


def load_store_item_datasets(
    n: int = 50, csv_path: str | None = None, seed: int = 42
) -> list[dict]:
    """Reshape real store-item daily sales into eval dataset dicts.

    Deterministic: series are sorted and a fixed stride is used to spread the
    sample across stores/items, so counts are stable across runs.
    """
    import random

    path = csv_path or _CSV_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} not found. Run download_store_item_csv() first "
            "(needs KAGGLE_USERNAME / KAGGLE_KEY and accepted competition rules)."
        )
    series = _read_series(path)
    keys = sorted(series.keys(), key=lambda k: (int(k[0]), int(k[1])))

    # Spread the sample deterministically across the (store, item) grid.
    rng = random.Random(seed)
    if n < len(keys):
        keys = rng.sample(keys, n)
        keys.sort(key=lambda k: (int(k[0]), int(k[1])))

    datasets: list[dict] = []
    need = HISTORY_DAYS + HORIZON_DAYS
    for store, item in keys:
        sales = [s for _, s in series[(store, item)]]
        if len(sales) < need:
            continue
        window = sales[-need:]
        history = window[:HISTORY_DAYS]
        future = window[HISTORY_DAYS:]
        ground_truth_7d = sum(future)

        mean = statistics.fmean(history) or 1.0
        cv = statistics.pstdev(history) / mean
        confidence = round(max(0.30, min(0.98, 1.0 - cv)), 2)
        recent7 = history[-7:]
        mock_pred = int(round(statistics.fmean(recent7) * 7))

        datasets.append(
            {
                "sku": f"S{store}-I{item}",
                "history": history,
                "future": future,
                "ground_truth_7d": ground_truth_7d,
                "cv": round(cv, 3),
                "expected_confidence": confidence,
                "mock_predicted_units": mock_pred,
                # Real extract is treated as fresh so every SKU is forecast +
                # scored; the freshness guardrail is covered by the synthetic eval.
                "data_age_hours": 0.5,
                # Competition data carries no exogenous signals; neutral stand-ins.
                "signals": {"weather": "n/a", "trend_index": 1.0, "promo": False},
            }
        )
    return datasets


if __name__ == "__main__":  # quick manual check: download + summarize
    p = download_store_item_csv()
    ds = load_store_item_datasets(5, p)
    print(f"CSV: {p}")
    for d in ds:
        print(
            f"  {d['sku']:>10}  hist={len(d['history'])}d "
            f"mean={statistics.fmean(d['history']):.1f} cv={d['cv']:.2f} "
            f"gt7={d['ground_truth_7d']} conf={d['expected_confidence']}"
        )
