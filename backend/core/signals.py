"""Real external demand signals (CLAUDE.md S6 get_external_signals -- the one integration
we can make genuinely real for free).

Live weather from Open-Meteo (no API key, HTTPS): temperature, precipitation, wind, and a
plain-language condition, plus a qualitative demand hint the Forecasting agent can reason
over (a cold snap lifts jacket demand; a heatwave lifts cold-brew demand). Crash-safe: any
network/parse failure returns {} so get_external_signals falls back to its mock signals and
the agent never breaks. Runs on the backend (clean network in prod); locally it works if the
process has truststore injected, else it simply degrades to the mock.

Location is env-configurable (SIGNAL_LATITUDE / SIGNAL_LONGITUDE); default is a neutral city.
Per-tenant location is a natural later extension (store it on the tenant's integration config).
"""
from __future__ import annotations

import json
import os
import urllib.request

_OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

# WMO weather codes -> broad, human-readable condition.
_CONDITION = {
    0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "fog", 48: "fog",
    51: "drizzle", 53: "drizzle", 55: "drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
    61: "rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
    71: "snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
    80: "rain showers", 81: "rain showers", 82: "violent rain showers",
    85: "snow showers", 86: "snow showers",
    95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm",
}


def signal_location(tenant_id: str = "") -> tuple[float, float]:
    """(lat, lon) for the weather lookup. Env-configurable; defaults to a neutral city."""
    try:
        lat = float(os.environ.get("SIGNAL_LATITUDE", "40.7128"))
        lon = float(os.environ.get("SIGNAL_LONGITUDE", "-74.0060"))
    except ValueError:
        lat, lon = 40.7128, -74.0060
    return lat, lon


def _demand_hint(temp_c: float | None, precip_mm: float | None, condition: str) -> str:
    """A short, actionable read of the weather for demand forecasting."""
    hints = []
    if temp_c is not None:
        if temp_c <= 5:
            hints.append("cold snap: warm apparel / hot drinks demand likely up")
        elif temp_c >= 28:
            hints.append("hot weather: cooling / cold-drink demand likely up")
    if (precip_mm or 0) >= 1 or "rain" in condition or "snow" in condition:
        hints.append("wet weather: rain gear up, foot traffic possibly down")
    return "; ".join(hints) or "no strong weather effect expected"


def fetch_weather(tenant_id: str = "", timeout: float = 4.0) -> dict:
    """Current weather for the configured location, or {} on any failure (crash-safe)."""
    lat, lon = signal_location(tenant_id)
    url = (f"{_OPEN_METEO}?latitude={lat}&longitude={lon}"
           "&current=temperature_2m,precipitation,weather_code,wind_speed_10m")
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            data = json.loads(r.read().decode())
    except Exception:
        return {}
    cur = data.get("current") or {}
    if not cur:
        return {}
    code = cur.get("weather_code")
    condition = _CONDITION.get(code, "unknown")
    temp = cur.get("temperature_2m")
    precip = cur.get("precipitation")
    return {
        "source": "open-meteo",
        "latitude": lat,
        "longitude": lon,
        "temperature_c": temp,
        "precipitation_mm": precip,
        "wind_kph": cur.get("wind_speed_10m"),
        "condition": condition,
        "observed_at": cur.get("time"),
        "demand_hint": _demand_hint(temp, precip, condition),
    }
