import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLS_HISTORY_RETRY_DELAY_MS,
  fetchOccupationHistoryWithRetries,
} from './occupation-history-client.ts';

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
