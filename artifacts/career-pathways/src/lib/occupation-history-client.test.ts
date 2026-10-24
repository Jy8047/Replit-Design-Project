import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLS_HISTORY_RETRY_DELAY_MS,
  fetchBlsHistoryWithArchiveFallback,
  fetchOccupationHistoryWithRetries,
} from './occupation-history-client.ts';

const archiveRecord = {
  socCode: '15-1252',
  occupationTitle: 'Software Developers',
  sourceName: 'U.S. Bureau of Labor Statistics — OEWS',
  sourceUrl: 'https://www.bls.gov/oes/tables.htm',
  publicationDate: '2025-05-01',
  retrievedAt: '2025-05-20T12:00:00.000Z',
  recordStatus: 'verified',
  points: [
    { year: 2023, employment: 1_000_000 },
    { year: 2024, employment: 1_050_000 },
  ],
};

function archiveResponse(templateOnly: boolean, records: unknown[]) {
  return new Response(JSON.stringify({ schemaVersion: 1, templateOnly, records }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('retries BLS server errors three times, then returns the successful response', async () => {
  assert.equal(BLS_HISTORY_RETRY_DELAY_MS, 2_000);
  let calls = 0;
  const retryAttempts: number[] = [];
  const result = await fetchOccupationHistoryWithRetries('/api/occupations/history', {
    signal: new AbortController().signal,
    delayMs: 0,
    onRetry: (attempt) => retryAttempts.push(attempt),
    fetcher: async () => {
      calls += 1;
      return calls < 4
        ? new Response('busy', { status: 503 })
        : new Response(JSON.stringify({ points: [{ year: 2024, employment: 123 }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
    },
  });

  assert.deepEqual(result, { points: [{ year: 2024, employment: 123 }] });
  assert.equal(calls, 4);
  assert.deepEqual(retryAttempts, [1, 2, 3]);
});

test('stops after the initial request plus three retries', async () => {
  let calls = 0;
  const retries: number[] = [];
  await assert.rejects(fetchOccupationHistoryWithRetries('/api/occupations/history', {
    signal: new AbortController().signal,
    delayMs: 0,
    onRetry: (attempt) => retries.push(attempt),
    fetcher: async () => {
      calls += 1;
      return new Response('busy', { status: 503 });
    },
  }), { message: 'BLS_HISTORY_UNAVAILABLE' });

  assert.equal(calls, 4);
  assert.deepEqual(retries, [1, 2, 3]);
});

test('retries network failures before accepting a successful response', async () => {
  let calls = 0;
  const result = await fetchOccupationHistoryWithRetries('/api/occupations/history', {
    signal: new AbortController().signal,
    delayMs: 0,
    fetcher: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('Network unavailable');
      return new Response('{"points":[]}', { status: 200 });
    },
  });

  assert.deepEqual(result, { points: [] });
  assert.equal(calls, 2);
});

test('does not retry a client-side rate limit response', async () => {
  let calls = 0;
  await assert.rejects(fetchOccupationHistoryWithRetries('/api/occupations/history', {
    signal: new AbortController().signal,
    delayMs: 0,
    fetcher: async () => {
      calls += 1;
      return new Response('limited', { status: 429 });
    },
  }), { message: 'HISTORY_REQUEST_FAILED_429' });
  assert.equal(calls, 1);
});

test('cancels the retry delay when the selected occupation changes', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = fetchOccupationHistoryWithRetries('/api/occupations/history', {
    signal: controller.signal,
    delayMs: 20_000,
    onRetry: () => controller.abort(),
    fetcher: async () => {
      calls += 1;
      return new Response('busy', { status: 503 });
    },
  });

  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('shows the retry notice in English, Simplified Chinese and Bahasa Melayu', () => {
  const source = readFileSync(new URL('./i18n.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes(
    "'The official BLS server is busy; retrying ({attempt}/3)…': ['官方 BLS 服务器繁忙，正在重试（{attempt}/3）…', 'Pelayan rasmi BLS sibuk; sedang mencuba semula ({attempt}/3)…']",
  ));
});

test('shows the local archive immediately, then prefers a successful live BLS response', async () => {
  let archiveCalls = 0;
  let archivedPreview: string | undefined;
  const result = await fetchBlsHistoryWithArchiveFallback(
    '/api/occupations/history',
    '/data/bls-oews-history.json',
    '15-1252.00',
    {
      signal: new AbortController().signal,
      onArchive: (history) => { archivedPreview = history.sourceMode; },
      fetcher: async (input) => {
        if (String(input).includes('/data/')) {
          archiveCalls += 1;
          return archiveResponse(false, [archiveRecord]);
        }
        return new Response(JSON.stringify({
          occupationCode: '15-1252.00',
          socCode: '15-1252',
          sourceName: 'U.S. Bureau of Labor Statistics — OEWS',
          sourceUrl: 'https://www.bls.gov/oes/tables.htm',
          refreshedAt: '2026-10-24T00:00:00.000Z',
          points: [{ year: 2024, employment: 1_060_000 }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    },
  );

  assert.equal(result.sourceMode, 'live');
  assert.deepEqual(result.points, [{ year: 2024, employment: 1_060_000 }]);
  assert.equal(archiveCalls, 1);
  assert.equal(archivedPreview, 'archive');
});

test('loads only a matching verified BLS record after all live retries fail', async () => {
  let liveCalls = 0;
  let archiveCalls = 0;
  const retryAttempts: number[] = [];
  const result = await fetchBlsHistoryWithArchiveFallback(
    '/api/occupations/history',
    '/data/bls-oews-history.json',
    '15-1252.01',
    {
      signal: new AbortController().signal,
      delayMs: 0,
      onRetry: (attempt) => retryAttempts.push(attempt),
      fetcher: async (input) => {
        if (String(input).includes('/data/')) {
          archiveCalls += 1;
          return archiveResponse(false, [
            { ...archiveRecord, socCode: '15-2051' },
            archiveRecord,
          ]);
        }
        liveCalls += 1;
        return new Response('BLS busy', { status: 503 });
      },
    },
  );

  assert.equal(liveCalls, 4);
  assert.equal(archiveCalls, 1);
  assert.deepEqual(retryAttempts, [1, 2, 3]);
  assert.equal(result.sourceMode, 'archive');
  assert.equal(result.occupationCode, '15-1252.01');
  assert.equal(result.publicationDate, '2025-05-01');
  assert.deepEqual(result.points, archiveRecord.points);
});

test('does not treat template, unverified, or non-BLS records as static fallback data', async () => {
  const controller = new AbortController();
  const fetcher = async (input: RequestInfo | URL) => String(input).includes('/data/')
    ? archiveResponse(true, [archiveRecord])
    : new Response('not available', { status: 404 });
  await assert.rejects(fetchBlsHistoryWithArchiveFallback(
    '/api/occupations/history',
    '/data/bls-oews-history.json',
    '15-1252.00',
    { signal: controller.signal, fetcher },
  ), { message: 'BLS_HISTORY_UNAVAILABLE' });

  for (const invalidRecord of [
    { ...archiveRecord, recordStatus: 'synthetic' },
    { ...archiveRecord, sourceUrl: 'https://example.com/history.csv' },
  ]) {
    const invalidFetcher = async (input: RequestInfo | URL) => String(input).includes('/data/')
      ? archiveResponse(false, [invalidRecord])
      : new Response('not available', { status: 404 });
    await assert.rejects(fetchBlsHistoryWithArchiveFallback(
      '/api/occupations/history',
      '/data/bls-oews-history.json',
      '15-1252.00',
      { signal: new AbortController().signal, fetcher: invalidFetcher },
    ), { message: 'BLS_HISTORY_UNAVAILABLE' });
  }
});

test('checked-in California archive contains the extracted series but keeps its source unverified', async () => {
  const archive = JSON.parse(readFileSync(
    new URL('../../public/data/bls-oews-history.json', import.meta.url),
    'utf8',
  )) as { templateOnly: boolean; records: Array<Record<string, unknown>> };
  assert.equal(archive.templateOnly, false);
  assert.equal(archive.records.length, 1);
  assert.equal(archive.records[0].recordStatus, 'user-supplied-unverified');
  assert.equal(archive.records[0].areaName, 'California');
  assert.deepEqual(archive.records[0].missingYears, [2011, 2012]);
  assert.equal(archive.records[0].publicationDate, null);
  assert.equal(archive.records[0].sourceUrl, null);

  const result = await fetchBlsHistoryWithArchiveFallback(
    '/api/occupations/history',
    '/data/bls-oews-history.json',
    '13-1071.00',
    {
      signal: new AbortController().signal,
      fetcher: async (input) => {
        if (String(input).includes('/data/')) {
          return new Response(JSON.stringify(archive), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('No live series for this test', { status: 404 });
      },
    },
  );
  assert.equal(result.sourceMode, 'uploaded-unverified');
  assert.equal(result.socCode, '13-1071');
  assert.equal(result.points.length, 16);
  assert.deepEqual(result.missingYears, [2011, 2012]);
  assert.deepEqual(result.points[0], { year: 2009, employment: 19_150 });
  assert.deepEqual(result.points.at(-1), { year: 2026, employment: 104_000 });
});

test('publishes the local chart data before a pending live BLS request finishes', async () => {
  const archive = JSON.parse(readFileSync(
    new URL('../../public/data/bls-oews-history.json', import.meta.url),
    'utf8',
  )) as { templateOnly: boolean; records: Array<Record<string, unknown>> };
  let resolveLiveRequest!: (response: Response) => void;
  const liveRequest = new Promise<Response>((resolve) => {
    resolveLiveRequest = resolve;
  });
  let resolveArchiveShown!: (history: unknown) => void;
  const archiveShown = new Promise<unknown>((resolve) => {
    resolveArchiveShown = resolve;
  });
  let liveFinished = false;

  const result = fetchBlsHistoryWithArchiveFallback(
    '/api/occupations/history',
    '/data/bls-oews-history.json',
    '13-1071.00',
    {
      signal: new AbortController().signal,
      fetcher: (input) => String(input).includes('/data/')
        ? Promise.resolve(new Response(JSON.stringify(archive), { status: 200 }))
        : liveRequest,
      onArchive: (history) => resolveArchiveShown(history),
    },
  ).finally(() => { liveFinished = true; });

  const earlyHistory = await archiveShown as {
    sourceMode: string;
    points: Array<{ year: number; employment: number }>;
  };
  assert.equal(earlyHistory.sourceMode, 'uploaded-unverified');
  assert.equal(earlyHistory.points.length, 16);
  assert.equal(liveFinished, false);

  resolveLiveRequest(new Response(JSON.stringify({
    occupationCode: '13-1071.00',
    socCode: '13-1071',
    sourceName: 'U.S. Bureau of Labor Statistics — OEWS',
    sourceUrl: 'https://www.bls.gov/oes/tables.htm',
    refreshedAt: '2026-10-24T00:00:00.000Z',
    points: [{ year: 2024, employment: 130_000 }],
  }), { status: 200 }));
  const finalHistory = await result;
  assert.equal(finalHistory.sourceMode, 'live');
  assert.deepEqual(finalHistory.points, [{ year: 2024, employment: 130_000 }]);
});

test('localizes the California source and limitations notice in all three app languages', () => {
  const translations = readFileSync(new URL('./i18n.tsx', import.meta.url), 'utf8');
  assert.match(translations, /Source: California government open-data mirror, not national data/u);
  assert.match(translations, /来源：加州政府开放数据镜像，非全国数据，缺少2011-2012年/u);
  assert.match(translations, /Sumber: cermin data terbuka kerajaan California/u);
});

test('history load failure is an inline neutral status with retry, not a red alert', () => {
  const source = readFileSync(
    new URL('../components/career-data-pages.tsx', import.meta.url),
    'utf8',
  );
  const start = source.indexOf("historyState === 'error'");
  const end = source.indexOf("historyState === 'unavailable'", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const errorState = source.slice(start, end);
  assert.match(errorState, /role="status"/u);
  assert.doesNotMatch(errorState, /role="alert"/u);
  assert.match(errorState, /button-retry-occupation-history/u);
});
