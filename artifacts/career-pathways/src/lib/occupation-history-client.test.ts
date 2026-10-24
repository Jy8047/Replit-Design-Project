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

test('uses live BLS data first and does not request the archive after live success', async () => {
  let archiveCalls = 0;
  const result = await fetchBlsHistoryWithArchiveFallback(
    '/api/occupations/history',
    '/data/bls-oews-history.json',
    '15-1252.00',
    {
      signal: new AbortController().signal,
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
  assert.equal(archiveCalls, 0);
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

test('checked-in BLS archive is an empty, clearly marked template rather than sample data', () => {
  const archive = JSON.parse(readFileSync(
    new URL('../../public/data/bls-oews-history.json', import.meta.url),
    'utf8',
  )) as { templateOnly: boolean; officialDownloadPage: string; records: unknown[] };
  assert.equal(archive.templateOnly, true);
  assert.equal(archive.officialDownloadPage, 'https://www.bls.gov/oes/tables.htm');
  assert.deepEqual(archive.records, []);
});
