import { after, mock, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { readFile } from "node:fs/promises";

let networkAttempts = 0;
function rejectNetwork(): never {
  networkAttempts += 1;
  throw new Error("Network access is prohibited in offline OCR tests.");
}
// Guards are installed before the module is imported, including for import-time calls.
mock.method(globalThis, "fetch", rejectNetwork);
mock.method(http, "request", rejectNetwork);
mock.method(http, "get", rejectNetwork);
mock.method(https, "request", rejectNetwork);
mock.method(https, "get", rejectNetwork);
mock.method(net.Socket.prototype, "connect", rejectNetwork);
const {
  createOfflineCvOcrAdapter, CV_OCR_AVAILABILITY, OFFLINE_OCR_FIXTURES,
  MAX_OFFLINE_OCR_JOBS, OfflineCvOcrError,
} = await import("../src/lib/runpod-cv-ocr.ts");

after(() => {
  mock.restoreAll();
  assert.equal(networkAttempts, 0, "No fixture, error path, or import may attempt network access.");
});

test("availability explicitly says real extraction and live calls are unavailable", () => {
  assert.equal(CV_OCR_AVAILABILITY.liveCallsEnabled, false);
  assert.equal(CV_OCR_AVAILABILITY.realPdfExtractionAvailable, false);
  assert.equal(CV_OCR_AVAILABILITY.mode, "offline");
  assert.equal(Object.isFrozen(CV_OCR_AVAILABILITY), true);
});

for (const fixture of ["text_pdf", "scanned_pdf"] as const) {
  test(`${fixture} simulates queue progression with clearly synthetic, unconfirmed text`, async () => {
    const adapter = createOfflineCvOcrAdapter();
    const queued = await adapter.submitFixture(fixture);
    assert.equal(queued.status, "IN_QUEUE");
    assert.equal(queued.text, null);
    assert.equal((await adapter.getJob(queued.id)).status, "IN_PROGRESS");
    const completed = await adapter.getJob(queued.id);
    assert.equal(completed.status, "COMPLETED");
    assert.match(completed.text!, /SYNTHETIC/);
    assert.equal(completed.confirmed_by_user, false);
    assert.equal(completed.provenance, "synthetic_fixture");
    assert.equal(completed.mode, "offline");
    assert.deepEqual(await adapter.getJob(queued.id), completed);
    assert.equal("education" in completed, false, "Must not invent a structured profile.");
  });
}

for (const [fixture, status, code] of [
  ["empty_output", "FAILED", "NO_TEXT"],
  ["worker_failure", "FAILED", "WORKER_FAILED"],
  ["malformed_output", "FAILED", "INVALID_OUTPUT"],
  ["oversized_output", "FAILED", "OUTPUT_TOO_LARGE"],
  ["timed_out", "TIMED_OUT", "TIMED_OUT"],
  ["cancelled", "CANCELLED", "CANCELLED"],
] as const) {
  test(`${fixture} never returns usable or confirmed text`, async () => {
    const adapter = createOfflineCvOcrAdapter();
    const queued = await adapter.submitFixture(fixture);
    await adapter.getJob(queued.id);
    const result = await adapter.getJob(queued.id);
    assert.equal(result.status, status);
    assert.equal(result.error?.code, code);
    assert.equal(result.text, null);
    assert.equal(result.confirmed_by_user, false);
    assert.equal(result.provenance, "synthetic_fixture");
  });
}

test("unknown fixtures, real files, and payload objects are rejected without reflecting their contents", async () => {
  const adapter = createOfflineCvOcrAdapter();
  for (const input of [undefined, null, "", "constructor", "student-real-name.pdf", { fixture_id: "text_pdf" }]) {
    await assert.rejects(adapter.submitFixture(input as never), { code: "INVALID_FIXTURE" });
  }
  const document = Object.defineProperty({}, "bytes", {
    get() { throw new Error("Offline extraction must not inspect a document."); },
  });
  await assert.rejects(adapter.extractPdf(document), { code: "LIVE_DISABLED" });
  await assert.rejects(adapter.extractPdf(null), { code: "LIVE_DISABLED" });
});

test("foreign, malformed and unknown job IDs cannot be queried", async () => {
  const first = createOfflineCvOcrAdapter();
  const second = createOfflineCvOcrAdapter();
  const job = await first.submitFixture("text_pdf");
  for (const id of ["", "remote-runpod-job", "offline-cv-ocr-999999-1", job.id, null]) {
    await assert.rejects(second.getJob(id as never), { code: "OFFLINE_JOB_NOT_FOUND" });
  }
});

test("the offline queue has a fixed memory bound", async () => {
  const adapter = createOfflineCvOcrAdapter();
  for (let i = 0; i < MAX_OFFLINE_OCR_JOBS; i++) await adapter.submitFixture("text_pdf");
  await assert.rejects(adapter.submitFixture("text_pdf"), { code: "OFFLINE_JOB_LIMIT" });
});

test("all documented fixtures are covered and errors have safe fixed messages", () => {
  assert.equal(OFFLINE_OCR_FIXTURES.length, 8);
  const error = new OfflineCvOcrError("LIVE_DISABLED", "Live extraction is disabled.");
  assert.equal(error.name, "OfflineCvOcrError");
  assert.equal(error.code, "LIVE_DISABLED");
});

test("the implementation has no environment reads or runtime SDK import", async () => {
  const source = await readFile(new URL("../src/lib/runpod-cv-ocr.ts", import.meta.url), "utf8");
  assert.equal(/process\s*\.\s*env/.test(source), false);
  assert.equal(/\bimport\s+(?!type\b)[^\n]*from\s+["']runpod-sdk/.test(source), false);
  assert.equal(/\bfetch\s*\(|\brunpodSdk\s*\(/.test(source), false);
});
