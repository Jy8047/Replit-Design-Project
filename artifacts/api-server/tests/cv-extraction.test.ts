import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { once } from "node:events";
import express from "express";
import { makePdf, encryptedPdf, fictionalText, fictionalProfile } from "./cv-fixtures.ts";
import { extractPdfText, MAX_CV_PDF_BYTES } from "../src/lib/pdf-extraction.ts";
import { createCvExtractionRouter } from "../src/routes/cv-extraction.ts";
import { CvError } from "../src/lib/cv-errors.ts";

// These tests allow loopback HTTP only, never outbound fetch/inference.
mock.method(globalThis, "fetch", () => { throw new Error("No external fetch is permitted in CV tests"); });
after(() => mock.restoreAll());

test("extracts actual generated PDF bytes, not filename or fixture output", async () => {
  const result = await extractPdfText(await makePdf("A DIFFERENT fictional PDF contains Rust and Writing."));
  assert.equal(result.status, "TEXT_EXTRACTED");
  assert.match(result.text, /Rust and Writing/);
  assert.doesNotMatch(result.text, /Fictional Student|SYNTHETIC/);
  assert.equal(result.pages, 1);
});
test("blank and real image-only PDFs require OCR, never generate a profile", async () => {
  for (const bytes of [await makePdf(""), await makePdf("", 1, true)]) {
    assert.deepEqual(await extractPdfText(bytes), { status: "OCR_REQUIRED", text: "", pages: 1 });
  }
});
test("rejects corrupt, truncated, empty, oversized and wrongly typed bytes", async () => {
  const valid = await makePdf();
  for (const [bytes, type, code] of [
    [new Uint8Array(), "application/pdf", "EMPTY_FILE"],
    [new Uint8Array(MAX_CV_PDF_BYTES + 1), "application/pdf", "FILE_TOO_LARGE"],
    [valid, "image/jpeg", "PDF_ONLY"],
    [Buffer.from("%PDF-1.7\nNot a real PDF\n%%EOF"), "application/pdf", "CORRUPT_PDF"],
    [valid.subarray(0, 150), "application/pdf", "CORRUPT_PDF"],
  ] as const) {
    await assert.rejects(extractPdfText(bytes, type), { code });
  }
});
test("rejects genuinely encrypted PDFs including an empty user password", async () => {
  for (const password of ["fictional-test-password", ""]) {
    await assert.rejects(extractPdfText(await encryptedPdf(password)), { code: "ENCRYPTED_PDF" });
  }
});
test("rejects too many pages and excessive extracted text", async () => {
  await assert.rejects(extractPdfText(await makePdf("", 31)), { code: "PAGE_LIMIT" });
  await assert.rejects(extractPdfText(await makePdf("Fictional long content ".repeat(120), 25)), { code: "TEXT_TOO_LARGE" });
});

async function withApi(map: (text: string, type: "fresh_graduate" | "career_switcher") => Promise<any>, run: (post: (bytes: Uint8Array, query?: string, headers?: Record<string, string>) => Promise<{ status: number; body: any; headers: any }>) => Promise<void>) {
  const app = express();
  app.use("/api", createCvExtractionRouter({ extract: extractPdfText, map }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const post = (bytes: Uint8Array, query = "profile_type=fresh_graduate", headers = {}) => new Promise<{status: number; body: any; headers: any}>((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1", port: address.port, path: `/api/profile/extract-pdf?${query}`, method: "POST",
      headers: { "Content-Type": "application/pdf", "X-CV-Consent": "local-extraction", ...headers },
    }, res => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(body), headers: res.headers }));
    });
    req.on("error", reject); req.end(bytes);
  });
  try { await run(post); } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
test("actual HTTP upload extracts text locally and does not invoke mapper without consent", async () => {
  let calls = 0;
  await withApi(async () => { calls++; throw new Error("Must not map"); }, async post => {
    const result = await post(await makePdf());
    assert.equal(result.status, 200);
    assert.match(result.body.text, /Fictional Student/);
    assert.equal(result.body.profile, null);
    assert.equal(result.body.mapping, "NOT_REQUESTED");
    assert.equal(result.headers["cache-control"], "no-store");
    const invalid = await post(await makePdf(), "profile_type=fresh_graduate&map_profile=true");
    assert.equal(invalid.status, 400);
    const wrong = await post(await makePdf(), undefined, { "Content-Type": "image/jpeg" });
    assert.equal(wrong.status, 415);
  });
  assert.equal(calls, 0);
});
test("HTTP mapping uses actual PDF text, preserves employment, and failure returns no draft", async () => {
  let calls = 0;
  await withApi(async (text, type) => {
    assert.match(text, /Fictional Student/);
    assert.equal(type, "career_switcher");
    calls++;
    if (calls > 1) throw new CvError("LIVE_DISABLED");
    return { ...fictionalProfile(type), employment_experience: "Fictional stated work" };
  }, async post => {
    const headers = { "X-CV-Consent": "runpod-text" };
    const query = "profile_type=career_switcher&map_profile=true";
    const good = await post(await makePdf(), query, headers);
    assert.equal(good.body.profile.confirmed_by_user, false);
    assert.equal(good.body.profile.employment_experience, "Fictional stated work");
    const disabled = await post(await makePdf(), query, headers);
    assert.equal(disabled.body.mapping, "LIVE_DISABLED");
    assert.equal(disabled.body.profile, null);
    const scan = await post(await makePdf("", 1, true), query, headers);
    assert.equal(scan.body.status, "OCR_REQUIRED");
    assert.equal(calls, 2);
    const tooBig = await post(new Uint8Array(MAX_CV_PDF_BYTES + 1));
    assert.equal(tooBig.status, 413);
  });
});
