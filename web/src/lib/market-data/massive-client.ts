// Thin HTTP client for the Massive REST API (api.massive.com — a
// Polygon.io-shaped API: identical endpoint paths, field names, and
// response envelopes). Only this file and massive-provider.ts know the
// concrete request/response shapes; everything else in the app talks to
// the MarketDataProvider interface.
//
// Auth: Massive's own docs (https://massive.com/docs/llms.txt and every
// endpoint page fetched from it) never state the auth header/param
// explicitly. Given the API is otherwise a byte-for-byte match of
// Polygon.io's public API (same paths, same field names, same plan-tier
// names, same `next_url` cursor convention), this uses Polygon's
// `Authorization: Bearer <key>` convention. This has NOT been verified
// against a live key — there is no MASSIVE_API_KEY in this environment.
// Verify the first real call and swap to `?apiKey=` as a query param
// instead if Bearer auth 401s.

const MASSIVE_API_BASE_URL = "https://api.massive.com";

function getApiKey(): string {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    throw new Error("MASSIVE_API_KEY is not configured.");
  }
  return key;
}

async function massiveFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(path, MASSIVE_API_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });

  if (!response.ok) {
    throw new Error(`Massive API request failed: ${response.status} ${response.statusText} (${path})`);
  }

  return (await response.json()) as T;
}

export type MassiveAggBar = {
  t: number; // unix ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  n?: number;
};

type MassiveAggsResponse = {
  status: string;
  results?: MassiveAggBar[];
  resultsCount?: number;
};

export async function getAggregateBars(params: {
  ticker: string;
  multiplier: number;
  timespan: "minute" | "hour" | "day";
  from: string;
  to: string;
  adjusted?: boolean;
  sort?: "asc" | "desc";
  limit?: number;
}): Promise<MassiveAggBar[]> {
  const { ticker, multiplier, timespan, from, to, ...rest } = params;
  const data = await massiveFetch<MassiveAggsResponse>(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${multiplier}/${timespan}/${from}/${to}`,
    { ...rest }
  );
  return data.results ?? [];
}

type MassiveIndicatorValue = { timestamp: number; value: number };
type MassiveIndicatorResponse = {
  status: string;
  results?: { values?: MassiveIndicatorValue[] };
};

async function getMovingAverage(
  kind: "ema" | "sma",
  params: { ticker: string; window: number; timespan: "day" | "minute"; timestamp?: string; limit?: number }
): Promise<MassiveIndicatorValue[]> {
  const { ticker, ...rest } = params;
  const data = await massiveFetch<MassiveIndicatorResponse>(`/v1/indicators/${kind}/${encodeURIComponent(ticker)}`, {
    ...rest,
    series_type: "close",
    order: "desc",
  });
  return data.results?.values ?? [];
}

export const getEma = (params: {
  ticker: string;
  window: number;
  timespan: "day" | "minute";
  timestamp?: string;
  limit?: number;
}) => getMovingAverage("ema", params);

export const getSma = (params: {
  ticker: string;
  window: number;
  timespan: "day" | "minute";
  timestamp?: string;
  limit?: number;
}) => getMovingAverage("sma", params);

type MassiveSnapshotTicker = {
  lastTrade?: { p: number };
  day?: { o: number; h: number; l: number; c: number };
  prevDay?: { c: number };
};

type MassiveSnapshotResponse = {
  status: string;
  ticker?: MassiveSnapshotTicker;
};

export async function getSnapshot(ticker: string): Promise<MassiveSnapshotTicker | null> {
  const data = await massiveFetch<MassiveSnapshotResponse>(
    `/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}`
  );
  return data.ticker ?? null;
}
