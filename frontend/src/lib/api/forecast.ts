/**
 * Deterministic per-SKU forecast generator. Until the backend exposes a forecast
 * endpoint, the console derives forecasts from inventory so they stay consistent
 * with what the dashboard shows (a 1-day-cover "critical" SKU forecasts an
 * imminent stockout). Seeded by the SKU id so the same SKU always looks the same.
 */
import type { Horizon, ForecastHorizon, ForecastPoint, SkuForecast } from "./types";

export interface ForecastInput {
  sku: string;
  name: string;
  status: SkuForecast["status"];
  on_hand: number;
  days_cover: number;
}

const HORIZONS: Horizon[] = [7, 30, 90];
const HISTORY_DAYS = 28;
const WEEKLY_AMPLITUDE = 0.18;

const BASE_CONFIDENCE: Record<SkuForecast["status"], number> = {
  healthy: 0.9,
  low: 0.78,
  critical: 0.68,
  overstock: 0.86,
};

const TREND_PER_DAY: Record<SkuForecast["status"], number> = {
  healthy: 0.002,
  low: 0.006,
  critical: 0.01,
  overstock: -0.004,
};

/** Small deterministic RNG (mulberry32 over an FNV-1a hash of the seed). */
function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const weekly = (day: number) => 1 + WEEKLY_AMPLITUDE * Math.sin((day / 7) * 2 * Math.PI);

export function buildForecast(row: ForecastInput): SkuForecast {
  const rnd = seededRandom(row.sku);
  const dailyBase = Math.max(1, row.on_hand / Math.max(1, row.days_cover));
  const trend = TREND_PER_DAY[row.status] ?? 0.002;
  const baseConfidence = BASE_CONFIDENCE[row.status] ?? 0.8;

  // Recent actuals: day -(HISTORY_DAYS-1) .. 0
  const history: number[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const day = -i;
    const noise = 1 + (rnd() - 0.5) * 0.25;
    history.push(Math.max(0, Math.round(dailyBase * weekly(day) * (1 + trend * day) * noise)));
  }

  const buildHorizon = (days: Horizon): ForecastHorizon => {
    const points: ForecastPoint[] = [];
    let cumulative = 0;
    let stockoutDay: number | null = null;
    for (let d = 1; d <= days; d++) {
      const mean = Math.max(0, dailyBase * weekly(d) * (1 + trend * d));
      // Band widens with distance and with lower confidence.
      const spread = mean * (1 - baseConfidence) * (1 + d / days);
      points.push({
        day: d,
        mean: round1(mean),
        lower: round1(Math.max(0, mean - spread)),
        upper: round1(mean + spread),
      });
      cumulative += mean;
      if (stockoutDay === null && cumulative >= row.on_hand) stockoutDay = d;
    }
    const total = points.reduce((s, p) => s + p.mean, 0);
    // Confidence erodes over longer horizons.
    const horizonPenalty = days >= 90 ? 0.08 : days >= 30 ? 0.04 : 0;
    return {
      days,
      points,
      predicted_total: Math.round(total),
      daily_mean: round1(total / days),
      confidence: round2(Math.max(0.5, baseConfidence - horizonPenalty)),
      projected_stockout_day: stockoutDay,
    };
  };

  const horizons = Object.fromEntries(
    HORIZONS.map((h) => [h, buildHorizon(h)]),
  ) as Record<Horizon, ForecastHorizon>;

  return {
    sku: row.sku,
    name: row.name,
    status: row.status,
    on_hand: row.on_hand,
    history,
    horizons,
  };
}
