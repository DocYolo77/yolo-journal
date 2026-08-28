// Thin HTTP client for the Massive REST API (api.massive.com — a
// Polygon.io-shaped API: identical endpoint paths, field names, and
// response envelopes — confirmed again against the live
// /docs/rest/stocks/aggregates/custom-bars.md reference page, which
// matches this file's getAggregateBars exactly). Only this file and
// massive-provider.ts know the concrete request/response shapes;
// everything else in the app talks to the MarketDataProvider interface.
//
// Auth: Massive's docs never state the auth header/param explicitly
// anywhere (checked /docs/llms.txt and the endpoint reference pages).
// Since there's no way to test against a live key from this sandbox
// (MASSIVE_API_KEY only exists in the deployed environment), this client
// resolves it empirically on first real use instead of shipping a single
// guess: try Polygon's documented `Authorization: Bearer <key>` header
// first; if that specific request 401s (and only on 401 — other errors
// are real failures, not an auth-mechanism problem), retry the exact
// same request once with `?apiKey=<key>` as a query param instead. The
// resolved mechanism is cached for the process lifetime so only the
// very first call pays the retry cost. Whichever one succeeds is logged
// server-side so this can be simplified to a single hardcoded mechanism
// once confirmed.

const MASSIVE_API_BASE_URL = "https://api.massive.com";

function getApiKey(): string {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) {
    throw new Error("MASSIVE_API_KEY is not configured.");
  }
  return key;
}

type AuthMode = "bearer" | "query";
// Cached for the lifetime of this server process once a request
// actually succeeds — avoids re-probing on every call.
let resolvedAuthMode: AuthMode | null = null;

async function requestWithAuthMode(url: URL, apiKey: string, mode: AuthMode): Promise<Response> {
  if (mode === "bearer") {
    return fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } });
  }
  const queryUrl = new URL(url.toString());
  queryUrl.searchParams.set("apiKey", apiKey);
  return fetch(queryUrl.toString());
}

async function massiveFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(path, MASSIVE_API_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const apiKey = getApiKey();
  const firstMode: AuthMode = resolvedAuthMode ?? "bearer";

  let response = await requestWithAuthMode(url, apiKey, firstMode);

  if (response.status === 401 && resolvedAuthMode === null) {
    const fallbackMode: AuthMode = firstMode === "bearer" ? "query" : "bearer";
    console.warn(
      `Massive API: ${firstMode} auth returned 401 for ${path}, retrying once with ${fallbackMode} auth.`
    );
    const fallbackResponse = await requestWithAuthMode(url, apiKey, fallbackMode);
    if (fallbackResponse.ok) {
      resolvedAuthMode = fallbackMode;
      console.warn(`Massive API: ${fallbackMode} auth confirmed working — update the client to use it directly.`);
      response = fallbackResponse;
    } else {
      throw new Error(
        `Massive API request failed with both auth mechanisms (${path}): ` +
          `bearer=${firstMode === "bearer" ? response.status : fallbackResponse.status}, ` +
          `query=${firstMode === "query" ? response.status : fallbackResponse.status}. ` +
          `Check that MASSIVE_API_KEY is correct and active.`
      );
    }
  } else if (response.ok) {
    resolvedAuthMode = firstMode;
  }

  if (!response.ok) {
    throw new Error(`Massive API request failed: ${response.status} ${response.statusText} (${path})`);
  }

  const body = (await response.json()) as T & { status?: string; error?: string; message?: string };

  // Polygon-shaped APIs can return HTTP 200 with a body that still signals
  // failure (e.g. plan/permission restrictions, an invalid ticker or date
  // range) — "OK"/"DELAYED" are the documented success statuses; anything
  // else previously fell through silently as an empty `results` array,
  // which is indistinguishable from "genuinely no data for this range"
  // and made a real problem (auth/plan/param issue) invisible in the UI.
  if (body.status && body.status !== "OK" && body.status !== "DELAYED") {
    throw new Error(
      `Massive API meldete Status "${body.status}" für ${path}${
        body.error || body.message ? `: ${body.error ?? body.message}` : ""
      }`
    );
  }

  return body;
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
