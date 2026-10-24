import { Router } from "express";

const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const BLS_SOURCE_URL = "https://www.bls.gov/oes/tables.htm";
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;
const REQUESTS_PER_MINUTE = 20;

export type EmploymentPoint = { year: number; employment: number };
export type OccupationHistory = {
  occupationCode: string;
  socCode: string;
  sourceName: string;
  sourceUrl: string;
  refreshedAt: string;
  points: EmploymentPoint[];
};

type BLSDataRow = { year?: unknown; period?: unknown; value?: unknown };
type BLSResponse = {
  status?: unknown;
  Results?: { series?: Array<{ seriesID?: unknown; data?: BLSDataRow[] }> };
};
type RouterDependencies = {
  fetcher?: typeof fetch;
  now?: () => number;
};

function makeSeriesId(occupationCode: string): string {
  // OEWS national area + all industries + the base six-digit SOC occupation + employment.
  const socCode = occupationCode.slice(0, 7).replace("-", "");
  return `OEUN0000000000000${socCode}01`;
}

function parsePoints(rows: BLSDataRow[]): EmploymentPoint[] {
  const byYear = new Map<number, EmploymentPoint>();
  for (const row of rows) {
    if (row.period !== "A01") continue;
    const year = Number(row.year);
    const employment = Number(String(row.value ?? "").replaceAll(",", ""));
    if (!Number.isInteger(year) || year < 1900 || year > 2200 ||
        !Number.isFinite(employment) || employment < 0) continue;
    byYear.set(year, { year, employment });
  }
  return [...byYear.values()].sort((left, right) => left.year - right.year);
}

export function createOccupationHistoryRouter(deps: RouterDependencies = {}) {
  const router = Router();
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? Date.now;
  const cache = new Map<string, { expiresAt: number; value: OccupationHistory }>();
  const inFlight = new Map<string, Promise<OccupationHistory>>();
  const requestWindows = new Map<string, { startedAt: number; count: number }>();

  router.get("/occupations/history", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const occupationCode = typeof req.query.occupationCode === "string"
      ? req.query.occupationCode.trim()
      : "";
    if (!/^\d{2}-\d{4}\.\d{2}$/.test(occupationCode)) {
      res.status(400).json({ code: "INVALID_OCCUPATION_CODE" });
      return;
    }

    const timestamp = now();
    const clientKey = req.ip || "unknown";
    if (requestWindows.size > 512) {
      for (const [key, value] of requestWindows) {
        if (timestamp - value.startedAt >= 60_000) requestWindows.delete(key);
      }
      while (requestWindows.size > 512) {
        const oldestKey = requestWindows.keys().next().value;
        if (!oldestKey) break;
        requestWindows.delete(oldestKey);
      }
    }
    const window = requestWindows.get(clientKey);
    if (!window || timestamp - window.startedAt >= 60_000) {
      requestWindows.set(clientKey, { startedAt: timestamp, count: 1 });
    } else if (window.count >= REQUESTS_PER_MINUTE) {
      res.status(429).json({ code: "HISTORY_RATE_LIMITED" });
      return;
    } else {
      window.count += 1;
    }

    const cached = cache.get(occupationCode);
    const forceRefresh = req.query.refresh !== undefined && req.query.refresh !== "0";
    if (!forceRefresh && cached && cached.expiresAt > timestamp) {
      res.json(cached.value);
      return;
    }

    let request = inFlight.get(occupationCode);
    if (!request) {
      request = (async () => {
        const endYear = new Date(timestamp).getUTCFullYear();
        const startYear = endYear - 9;
        const seriesId = makeSeriesId(occupationCode);
        const response = await fetcher(BLS_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesid: [seriesId], startyear: String(startYear), endyear: String(endYear) }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error("BLS_HTTP_ERROR");
        const payload = await response.json() as BLSResponse;
        const series = payload.Results?.series?.[0];
        if (payload.status !== "REQUEST_SUCCEEDED" ||
            series?.seriesID !== seriesId ||
            !Array.isArray(series.data)) {
          throw new Error("BLS_RESPONSE_INVALID");
        }
        const value: OccupationHistory = {
          occupationCode,
          socCode: occupationCode.slice(0, 7),
          sourceName: "U.S. Bureau of Labor Statistics — OEWS",
          sourceUrl: BLS_SOURCE_URL,
          refreshedAt: new Date(timestamp).toISOString(),
          points: parsePoints(series.data),
        };
        cache.set(occupationCode, { expiresAt: timestamp + CACHE_TTL_MS, value });
        if (cache.size > 128) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }
        return value;
      })();
      inFlight.set(occupationCode, request);
    }

    try {
      res.json(await request);
    } catch {
      res.status(502).json({ code: "BLS_HISTORY_UNAVAILABLE" });
    } finally {
      if (inFlight.get(occupationCode) === request) inFlight.delete(occupationCode);
    }
  });

  return router;
}
