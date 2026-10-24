import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import { request, type ClientRequest, type Server } from "node:http";
import { once } from "node:events";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import express from "express";
import actualApp from "../src/app.ts";
import { createCvExtractionRouter, CV_REQUEST_DEADLINE_MS } from "../src/routes/cv-extraction.ts";
import { extractPdfText, MAX_CV_PDF_BYTES } from "../src/lib/pdf-extraction.ts";
import { CvError } from "../src/lib/cv-errors.ts";
import { makePdf } from "./cv-fixtures.ts";

mock.method(globalThis, "fetch", () => { throw new Error("External calls forbidden"); });
after(() => mock.restoreAll());
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const syntheticExtract: typeof extractPdfText = async () => ({ status: "OCR_REQUIRED", text: "", pages: 1 });

async function serve(
  run: (port: number) => Promise<void>,
  extract: typeof extractPdfText = extractPdfText,
  deadlineMs?: number,
  app = express().use("/api", createCvExtractionRouter({ extract }, { deadlineMs })),
) {
  const server: Server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await run((server.address() as { port: number }).port); }
  finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function upload(port: number, headers: Record<string, string> = {}) {
  let req!: ClientRequest;
  const result = new Promise<{ status: number; body: any; headers: any }>((resolve, reject) => {
    req = request({
      hostname: "127.0.0.1", port, method: "POST",
      path: "/api/profile/extract-pdf?profile_type=fresh_graduate",
      headers: { "Content-Type": "application/pdf", "X-CV-Consent": "local-extraction", ...headers },
      agent: false,
    }, res => {
      const chunks: Buffer[] = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        try { resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()), headers: res.headers }); }
        catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    // Test watchdog, not the protection under test; fail instead of hanging.
    req.setTimeout(40_000, () => req.destroy(new Error("Test watchdog")));
  });
  return { req, result };
}
async function post(port: number, bytes: Uint8Array, headers: Record<string, string> = {}) {
  const { req, result } = upload(port, headers);
  req.end(bytes);
  return result;
}
async function until(predicate: () => boolean) {
  for (let i = 0; i < 400; i++) {
    if (predicate()) return;
    await pause(5);
  }
  assert.fail("Controlled local operation did not reach expected state");
}

test("over-limit Content-Length is rejected without sending body or starting extraction", async () => {
  let calls = 0;
  await serve(async port => {
    const { req, result } = upload(port, { "Content-Length": String(MAX_CV_PDF_BYTES + 1) });
    req.flushHeaders(); // Deliberately never send the advertised body.
    const response = await result;
    assert.equal(response.status, 413);
    assert.equal(response.body.code, "FILE_TOO_LARGE");
    assert.equal(response.headers.connection, "close");
    assert.equal(calls, 0);
    req.destroy();
    assert.equal((await post(port, Buffer.from("synthetic next body"))).status, 200);
  }, async (...args) => { calls++; return syntheticExtract(...args); });
});

test("chunked upload without Content-Length extracts actual PDF; identity encoding is accepted", async () => {
  await serve(async port => {
    const pdf = await makePdf(`Genuine fictional chunked upload.
EDUCATION: A fictional university, bachelor degree.
I worked with Rust and Python to build projects with a small team.`);
    const { req, result } = upload(port, { "Transfer-Encoding": "chunked", "Content-Encoding": "identity" });
    req.write(pdf.subarray(0, 100));
    req.end(pdf.subarray(100));
    const response = await result;
    assert.equal(response.status, 200);
    assert.match(response.body.text, /fictional chunked upload/);
    assert.match(response.body.text, /Rust/);
    assert.equal(response.body.mapping_provenance, "none");
  });
});

test("streamed bytes exceeding 10 MiB are rejected before end, without extraction", async () => {
  let calls = 0;
  await serve(async port => {
    const { req, result } = upload(port, { "Transfer-Encoding": "chunked" });
    // No end(): a reader that waits to drain the body would hang here.
    const piece = Buffer.alloc(64 * 1024);
    for (let i = 0; i < MAX_CV_PDF_BYTES / piece.length + 1; i++) {
      if (!req.write(piece)) await once(req, "drain");
    }
    const response = await result;
    assert.equal(response.status, 413);
    assert.equal(response.body.code, "FILE_TOO_LARGE");
    assert.equal(calls, 0);
    req.destroy();
  }, async (...args) => { calls++; return syntheticExtract(...args); });
});

test("exactly 10 MiB remains accepted by the streaming reader", async () => {
  let seen = 0;
  await serve(async port => {
    const response = await post(port, Buffer.alloc(MAX_CV_PDF_BYTES));
    assert.equal(response.status, 200);
    assert.equal(seen, MAX_CV_PDF_BYTES);
  }, async bytes => { seen = bytes.length; return syntheticExtract(bytes); });
  // Synthetic reader boundary test only; not claiming these bytes form a PDF.
});

test("gzip, deflate, Brotli and unsupported encodings are rejected before parsing", async () => {
  let calls = 0;
  await serve(async port => {
    const pdf = await makePdf();
    for (const [encoding, bytes] of [
      ["gzip", gzipSync(pdf)], ["deflate", deflateSync(pdf)],
      ["br", brotliCompressSync(pdf)], ["identity, gzip", pdf], ["unknown", pdf],
    ] as const) {
      const response = await post(port, bytes, { "Content-Encoding": encoding });
      assert.equal(response.status, 415);
      assert.equal(response.body.code, "UNSUPPORTED_ENCODING");
    }
    assert.equal(calls, 0);
    assert.equal((await post(port, pdf)).status, 200);
  }, async (...args) => { calls++; return syntheticExtract(...args); });
});

test("actual app rejects compressed/mistyped bodies before its global JSON parser", async () => {
  await serve(async port => {
    const response = await post(port, gzipSync(Buffer.from('{"fictional":true}')), {
      "Content-Type": "application/json", "Content-Encoding": "gzip",
    });
    assert.equal(response.status, 415);
    assert.equal(response.body.code, "UNSUPPORTED_ENCODING");
    const normal = await post(port, await makePdf(`Real local application boundary.
EDUCATION: Fictional University, Bachelor of Science.
I worked with Python and a team to build software projects.`));
    assert.equal(normal.status, 200);
    assert.match(normal.body.text, /Real local application boundary/);
  }, extractPdfText, undefined, actualApp);
});

test("production default is a real 30-second absolute deadline despite ongoing trickle traffic", { timeout: 40_000 }, async () => {
  assert.equal(CV_REQUEST_DEADLINE_MS, 30_000);
  let calls = 0;
  await serve(async port => {
    const { req, result } = upload(port, { "Transfer-Encoding": "chunked" });
    const started = performance.now();
    req.write("%PDF-");
    const trickle = setInterval(() => { if (!req.destroyed) req.write(" "); }, 100);
    try {
      const response = await result;
      const elapsed = performance.now() - started;
      assert.equal(response.status, 408);
      assert.equal(response.body.code, "UPLOAD_TIMEOUT");
      assert.ok(elapsed >= 29_500 && elapsed < 35_000, `Deadline elapsed ${elapsed}ms`);
      assert.equal(calls, 0);
    } finally { clearInterval(trickle); req.destroy(); }
  }, async (...args) => { calls++; return syntheticExtract(...args); });
});

test("two timed-out incomplete uploads release both concurrency slots", async () => {
  let calls = 0;
  await serve(async port => {
    const a = upload(port, { "Transfer-Encoding": "chunked" });
    const b = upload(port, { "Transfer-Encoding": "chunked" });
    a.req.write("%PDF-");
    b.req.write("%PDF-");
    await pause(30);
    assert.equal((await post(port, Buffer.from("synthetic busy"))).status, 429);
    for (const response of await Promise.all([a.result, b.result])) assert.equal(response.status, 408);
    a.req.destroy(); b.req.destroy();
    assert.equal((await post(port, Buffer.from("synthetic after deadline"))).status, 200);
    assert.equal(calls, 1);
  }, async (...args) => { calls++; return syntheticExtract(...args); }, 200);
});

test("client disconnect while uploading releases slots without extraction", async () => {
  let calls = 0;
  await serve(async port => {
    for (let i = 0; i < 2; i++) {
      const u = upload(port, { "Transfer-Encoding": "chunked" });
      const disconnected = u.result.catch(() => undefined);
      u.req.write("%PDF-");
      await pause(20);
      u.req.destroy();
      await disconnected;
    }
    await pause(30);
    assert.equal((await post(port, Buffer.from("synthetic after disconnect"))).status, 200);
    assert.equal(calls, 1);
  }, async (...args) => { calls++; return syntheticExtract(...args); });
});

test("deadline includes extraction and does not release a worker slot before cancellation settles", async () => {
  let calls = 0;
  let cancelled = 0;
  let completeCancellation!: () => void;
  let started = false;
  await serve(async port => {
    const first = post(port, Buffer.from("synthetic processing"));
    await until(() => started);
    const timeout = await first;
    assert.equal(timeout.status, 408);
    assert.equal(timeout.body.code, "UPLOAD_TIMEOUT");
    assert.equal(cancelled, 1);
    // One cancelled extractor is deliberately held, another occupies slot two.
    const second = upload(port, { "Transfer-Encoding": "chunked" });
    second.req.write("%PDF-");
    await pause(15);
    assert.equal((await post(port, Buffer.from("synthetic third"))).status, 429);
    completeCancellation();
    await pause(20);
    assert.equal((await post(port, Buffer.from("synthetic after termination"))).status, 200);
    second.req.destroy();
    await second.result.catch(() => undefined);
  }, async (_bytes, _type, signal) => {
    calls++;
    if (calls !== 1) return syntheticExtract(_bytes);
    started = true;
    await new Promise<void>(resolve => {
      completeCancellation = resolve;
      signal!.addEventListener("abort", () => { cancelled++; }, { once: true });
    });
    throw signal!.reason;
  }, 200);
});

test("disconnect after full body aborts extraction and frees a slot after settlement", async () => {
  let calls = 0;
  let cancelled = 0;
  await serve(async port => {
    const u = upload(port);
    const disconnected = u.result.catch(() => undefined);
    u.req.end("synthetic completed body");
    await until(() => calls === 1);
    u.req.destroy();
    await disconnected;
    await until(() => cancelled === 1);
    assert.equal((await post(port, Buffer.from("synthetic following body"))).status, 200);
  }, async (bytes, _type, signal) => {
    calls++;
    if (calls !== 1) return syntheticExtract(bytes);
    await new Promise<void>((_resolve, reject) => signal!.addEventListener("abort", () => {
      cancelled++;
      reject(signal!.reason);
    }, { once: true }));
    return syntheticExtract(bytes);
  });
});

test("body upload and extraction share one deadline rather than restarting the clock", async () => {
  let extractionStarted = false;
  await serve(async port => {
    const u = upload(port, { "Transfer-Encoding": "chunked" });
    const started = performance.now();
    u.req.write("synthetic partial body");
    await pause(200);
    u.req.end(" completed");
    const response = await u.result;
    const elapsed = performance.now() - started;
    assert.equal(extractionStarted, true);
    assert.equal(response.status, 408);
    assert.equal(response.body.code, "UPLOAD_TIMEOUT");
    assert.ok(elapsed >= 290 && elapsed < 450, `Shared deadline elapsed ${elapsed}ms`);
  }, async (_bytes, _type, signal) => {
    extractionStarted = true;
    await new Promise<void>((_resolve, reject) => {
      signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
    });
    return syntheticExtract(_bytes);
  }, 300);
});

test("parser failures do not leak slots; a genuine valid PDF still works afterwards", async () => {
  await serve(async port => {
    for (let i = 0; i < 3; i++) {
      const response = await post(port, Buffer.from("%PDF-1.7\nbroken\n%%EOF"));
      assert.equal(response.status, 422);
      assert.equal(response.body.code, "CORRUPT_PDF");
    }
    assert.equal((await post(port, await makePdf())).status, 200);
  });
});

test("actual PDF worker cancellation settles; already-aborted requests cannot start extraction", async () => {
  const bytes = await makePdf();
  const prior = new AbortController();
  prior.abort(new CvError("UPLOAD_TIMEOUT", 408));
  await assert.rejects(extractPdfText(bytes, "application/pdf", prior.signal), { code: "UPLOAD_TIMEOUT" });
  const controller = new AbortController();
  const pending = extractPdfText(bytes, "application/pdf", controller.signal);
  const timer = setTimeout(() => controller.abort(new CvError("UPLOAD_ABORTED", 400)), 25);
  try { await assert.rejects(pending, { code: "UPLOAD_ABORTED" }); }
  finally { clearTimeout(timer); }
});
