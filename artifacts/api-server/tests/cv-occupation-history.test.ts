import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { once } from "node:events";
import express from "express";
import { createOccupationHistoryRouter } from "../src/routes/occupation-history.ts";

async function withApi(
  fetcher: typeof fetch,
  run: (get: (query: string) => Promise<{ status: number; body: any }>) => Promise<void>,
) {
  const app = express();
  app.use("/api", createOccupationHistoryRouter({ fetcher }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const get = async (query: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/occupations/history?${query}`);
    return { status: response.status, body: await response.json() };
  };
  try {
    await run(get);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test("maps an O*NET occupation code to national BLS OEWS annual employment data", async () => {
  let requestBody: Record<string, unknown> | undefined;
  await withApi(async (input, init) => {
    assert.equal(String(input), "https://api.bls.gov/publicAPI/v2/timeseries/data/");
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      status: "REQUEST_SUCCEEDED",
      Results: { series: [{ seriesID: "OEUN000000000000015125201", data: [
        { year: "2022", period: "A01", value: "100,000" },
        { year: "2023", period: "A01", value: "105000" },
        { year: "2023", period: "M05", value: "90000" },
        { year: "2024", period: "A01", value: "suppressed" },
      ] }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }, async get => {
    const response = await get("occupationCode=15-1252.00");
    assert.equal(response.status, 200);
    assert.equal(response.body.socCode, "15-1252");
    assert.deepEqual(response.body.points, [
      { year: 2022, employment: 100000 },
      { year: 2023, employment: 105000 },
    ]);
    assert.match(response.body.sourceName, /Bureau of Labor Statistics/);
    assert.match(response.body.sourceUrl, /^https:\/\/www\.bls\.gov\//);
  });
  assert.deepEqual(requestBody?.seriesid, ["OEUN000000000000015125201"]);
});

test("maps O*NET sub-occupations to the broader BLS SOC and returns that boundary", async () => {
  let requestBody: Record<string, unknown> | undefined;
  await withApi(async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      status: "REQUEST_SUCCEEDED",
      Results: { series: [{ seriesID: "OEUN000000000000015205101", data: [] }] },
    }), { status: 200 });
  }, async get => {
    const response = await get("occupationCode=15-2051.01");
    assert.equal(response.status, 200);
    assert.equal(response.body.occupationCode, "15-2051.01");
    assert.equal(response.body.socCode, "15-2051");
  });
  assert.deepEqual(requestBody?.seriesid, ["OEUN000000000000015205101"]);
});

test("rejects invalid occupation codes without contacting BLS", async () => {
  let calls = 0;
  await withApi(async () => {
    calls += 1;
    throw new Error("unexpected external request");
  }, async get => {
    const response = await get("occupationCode=https%3A%2F%2Fexample.com");
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "INVALID_OCCUPATION_CODE");
  });
  assert.equal(calls, 0);
});

test("returns an explicit fallback on BLS errors and does not cache failures", async () => {
  let calls = 0;
  await withApi(async () => {
    calls += 1;
    return new Response(JSON.stringify({ status: "REQUEST_FAILED", Results: {} }), { status: 200 });
  }, async get => {
    const first = await get("occupationCode=15-1252.00");
    const second = await get("occupationCode=15-1252.00");
    assert.equal(first.status, 502);
    assert.equal(first.body.code, "BLS_HISTORY_UNAVAILABLE");
    assert.equal(second.status, 502);
  });
  assert.equal(calls, 2);
});

test("caches successful BLS history for subsequent requests", async () => {
  let calls = 0;
  await withApi(async () => {
    calls += 1;
    return new Response(JSON.stringify({
      status: "REQUEST_SUCCEEDED",
      Results: { series: [{ seriesID: "OEUN000000000000015125201", data: [{ year: "2024", period: "A01", value: "1200" }] }] },
    }), { status: 200 });
  }, async get => {
    const first = await get("occupationCode=15-1252.00");
    const second = await get("occupationCode=15-1252.00");
    assert.equal(first.status, 200);
    assert.deepEqual(second.body.points, [{ year: 2024, employment: 1200 }]);
  });
  assert.equal(calls, 1);
});

test("limits repeated refresh/history requests per client", async () => {
  let calls = 0;
  await withApi(async () => {
    calls += 1;
    return new Response(JSON.stringify({
      status: "REQUEST_SUCCEEDED",
      Results: { series: [{ seriesID: "OEUN000000000000015125201", data: [] }] },
    }), { status: 200 });
  }, async get => {
    for (let request = 0; request < 20; request += 1) {
      assert.equal((await get("occupationCode=15-1252.00")).status, 200);
    }
    const limited = await get("occupationCode=15-1252.00");
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "HISTORY_RATE_LIMITED");
  });
  assert.equal(calls, 1);
});
