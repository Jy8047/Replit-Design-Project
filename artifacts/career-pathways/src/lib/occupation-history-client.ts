export const BLS_HISTORY_MAX_RETRIES = 3;
export const BLS_HISTORY_RETRY_DELAY_MS = 2_000;

export type EmploymentPoint = { year: number; employment: number };
export type OccupationHistoryView = {
  occupationCode: string;
  socCode: string;
  sourceName: string;
  sourceUrl: string | null;
  refreshedAt: string;
  points: EmploymentPoint[];
  sourceMode: 'live' | 'archive' | 'uploaded-unverified';
  publicationDate?: string | null;
  areaName?: string;
  missingYears?: number[];
};

type RetryOptions = {
  signal: AbortSignal;
  fetcher?: typeof fetch;
  onRetry?: (attempt: number) => void;
  onArchive?: (history: OccupationHistoryView) => void;
  maxRetries?: number;
  delayMs?: number;
};

type ArchiveOptions = Pick<RetryOptions, 'signal' | 'fetcher'>;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isBlsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'bls.gov' || url.hostname.endsWith('.bls.gov'));
  } catch {
    return false;
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
    Number.isFinite(Date.parse(value));
}

function parseEmploymentPoints(value: unknown, minPoints: number): EmploymentPoint[] | null {
  if (!Array.isArray(value) || value.length < minPoints) return null;
  const years = new Set<number>();
  const points: EmploymentPoint[] = [];
  for (const item of value) {
    if (!isObject(item) ||
        !Number.isInteger(item.year) ||
        (item.year as number) < 1900 ||
        (item.year as number) > 2200 ||
        !Number.isInteger(item.employment) ||
        (item.employment as number) < 0 ||
        years.has(item.year as number)) {
      return null;
    }
    years.add(item.year as number);
    points.push({ year: item.year as number, employment: item.employment as number });
  }
  return points.sort((left, right) => left.year - right.year);
}

function parseLiveHistory(value: unknown, expectedOccupationCode: string): OccupationHistoryView | null {
  if (!isObject(value) ||
      value.occupationCode !== expectedOccupationCode ||
      typeof value.socCode !== 'string' ||
      !/^\d{2}-\d{4}$/u.test(value.socCode) ||
      typeof value.sourceName !== 'string' ||
      !value.sourceName.includes('Bureau of Labor Statistics') ||
      !isBlsUrl(value.sourceUrl) ||
      !isIsoDateTime(value.refreshedAt)) {
    return null;
  }
  const points = parseEmploymentPoints(value.points, 0);
  if (!points) return null;
  return {
    occupationCode: expectedOccupationCode,
    socCode: value.socCode,
    sourceName: value.sourceName,
    sourceUrl: value.sourceUrl,
    refreshedAt: value.refreshedAt,
    points,
    sourceMode: 'live',
  };
}

async function loadArchiveRecord(
  url: string,
  occupationCode: string,
  options: ArchiveOptions,
): Promise<OccupationHistoryView | null> {
  const match = occupationCode.match(/^(\d{2}-\d{4})\.\d{2}$/u);
  if (!match) return null;
  const response = await (options.fetcher ?? fetch)(url, {
    signal: options.signal,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const archive: unknown = await response.json();
  if (!isObject(archive) ||
      archive.schemaVersion !== 1 ||
      archive.templateOnly !== false ||
      !Array.isArray(archive.records)) {
    return null;
  }
  const records = archive.records.filter(
    (record): record is Record<string, unknown> =>
      isObject(record) && record.socCode === match[1],
  );
  if (records.length !== 1) return null;

  const record = records[0];
  if (typeof record.occupationTitle !== 'string' ||
      !record.occupationTitle.trim() ||
      typeof record.sourceName !== 'string' ||
      !isIsoDateTime(record.retrievedAt)) {
    return null;
  }
  const points = parseEmploymentPoints(record.points, 2);
  if (!points) return null;

  if (record.recordStatus === 'user-supplied-unverified') {
    const missingYears = record.missingYears;
    if (record.sourceUrl !== null ||
        record.publicationDate !== null ||
        record.areaName !== 'California' ||
        record.areaType !== 'California statewide' ||
        !record.sourceName.toLowerCase().includes('not independently verified') ||
        !Array.isArray(missingYears) ||
        missingYears.some((year) =>
          !Number.isInteger(year) || points.some((point) => point.year === year),
        )) {
      return null;
    }
    return {
      occupationCode,
      socCode: match[1],
      sourceName: record.sourceName,
      sourceUrl: null,
      refreshedAt: record.retrievedAt,
      points,
      sourceMode: 'uploaded-unverified',
      publicationDate: null,
      areaName: record.areaName,
      missingYears: missingYears as number[],
    };
  }

  if (record.recordStatus !== 'verified' ||
      !record.sourceName.includes('Bureau of Labor Statistics') ||
      !isBlsUrl(record.sourceUrl) ||
      !isIsoDate(record.publicationDate)) {
    return null;
  }
  return {
    occupationCode,
    socCode: match[1],
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    refreshedAt: record.retrievedAt,
    points,
    sourceMode: 'archive',
    publicationDate: record.publicationDate,
  };
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

export async function fetchOccupationHistoryWithRetries(
  url: string,
  {
    signal,
    fetcher = fetch,
    onRetry,
    maxRetries = BLS_HISTORY_MAX_RETRIES,
    delayMs = BLS_HISTORY_RETRY_DELAY_MS,
  }: RetryOptions,
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (signal.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    let response: Response;
    try {
      response = await fetcher(url, { signal, cache: 'no-store' });
    } catch (error) {
      if (signal.aborted || attempt === maxRetries) throw error;
      onRetry?.(attempt + 1);
      await waitForRetry(delayMs, signal);
      continue;
    }

    if (response.status >= 500 && response.status < 600) {
      if (attempt === maxRetries) throw new Error('BLS_HISTORY_UNAVAILABLE');
      onRetry?.(attempt + 1);
      await waitForRetry(delayMs, signal);
      continue;
    }
    if (!response.ok) throw new Error(`HISTORY_REQUEST_FAILED_${response.status}`);
    return response.json();
  }

  throw new Error('BLS_HISTORY_UNAVAILABLE');
}

export async function fetchBlsHistoryWithArchiveFallback(
  liveUrl: string,
  archiveUrl: string,
  occupationCode: string,
  options: RetryOptions,
): Promise<OccupationHistoryView> {
  const liveResult = fetchOccupationHistoryWithRetries(liveUrl, options)
    .then((payload) => {
      const history = parseLiveHistory(payload, occupationCode);
      return history
        ? { history, error: null }
        : { history: null, error: new Error('BLS_RESPONSE_INVALID') };
    })
    .catch((error: unknown) => ({ history: null, error }));

  let archiveHistory: OccupationHistoryView | null = null;
  try {
    archiveHistory = await loadArchiveRecord(archiveUrl, occupationCode, options);
  } catch {
    // A missing or invalid archive must not prevent a successful live response.
  }

  if (archiveHistory && !options.signal.aborted) {
    options.onArchive?.(archiveHistory);
  }

  const live = await liveResult;
  if (live.history) return live.history;
  if (options.signal.aborted) {
    throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
  if (archiveHistory) return archiveHistory;
  throw new Error('BLS_HISTORY_UNAVAILABLE');
}
