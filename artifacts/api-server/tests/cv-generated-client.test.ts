import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import {
  extractCvPdf, getExtractCvPdfUrl, getExtractCvPdfMutationKey,
  getExtractCvPdfMutationOptions,
} from "../../../lib/api-client-react/src/generated/api.ts";
import { ExtractCvPdfResponse } from "@workspace/api-zod";

// Contract-only transport fixtures; no network or claimed AI/OCR success.
const fixture = {
  status: "OCR_REQUIRED", text: "", pages: 1, profile: null,
  mapping: "OCR_REQUIRED", mapping_provenance: "none",
} as const;
let transport: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = async () => {
  throw new Error("No external calls permitted");
};
mock.method(globalThis, "fetch", (input: RequestInfo | URL, init?: RequestInit) => transport(input, init));
after(() => mock.restoreAll());

test("regenerated client preserves PDF query names, false values and mutation key", () => {
  const url = new URL(getExtractCvPdfUrl({
    profile_type: "career_switcher", mapping_mode: "demo", map_profile: false,
  }), "http://fictional.invalid");
  assert.equal(url.pathname, "/api/profile/extract-pdf");
  assert.equal(url.searchParams.get("profile_type"), "career_switcher");
  assert.equal(url.searchParams.get("mapping_mode"), "demo");
  assert.equal(url.searchParams.get("map_profile"), "false");
  assert.deepEqual(getExtractCvPdfMutationKey(), ["extractCvPdf"]);
  assert.deepEqual(getExtractCvPdfMutationOptions().mutationKey, ["extractCvPdf"]);
});

test("regenerated client preserves actual Blob body and consent in every HeadersInit format", async () => {
  const body = new Blob(["synthetic transport bytes only"], { type: "application/pdf" });
  let calls = 0;
  transport = async (url, init) => {
    calls++;
    assert.match(String(url), /^\/api\/profile\/extract-pdf\?/);
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, body);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("content-type"), "application/pdf");
    assert.equal(headers.get("x-cv-consent"), "local-extraction");
    return new Response(JSON.stringify(fixture), { headers: { "Content-Type": "application/json" } });
  };
  for (const headers of [
    { "X-CV-Consent": "local-extraction" },
    new Headers({ "X-CV-Consent": "local-extraction" }),
    [["X-CV-Consent", "local-extraction"]] as [string, string][],
  ]) {
    assert.deepEqual(await extractCvPdf(body, { profile_type: "fresh_graduate" }, { headers }), fixture);
  }
  assert.equal(calls, 3);
});

test("regenerated Zod v3 response keeps JSON fields and enforces OpenAPI integer pages", () => {
  assert.deepEqual(ExtractCvPdfResponse.parse(fixture), fixture);
  assert.equal(ExtractCvPdfResponse.safeParse({ ...fixture, pages: 1.5 }).success, false);
  assert.equal(ExtractCvPdfResponse.safeParse({ ...fixture, pages: "1" }).success, false);
  assert.equal(ExtractCvPdfResponse.safeParse({ ...fixture, mapping_provenance: "real_ai" }).success, false);
});

test("regenerated client does not turn backend upload rejection into success", async () => {
  transport = async () => new Response(JSON.stringify({ code: "UNSUPPORTED_ENCODING" }), {
    status: 415, headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(extractCvPdf(new Blob(["synthetic"]), { profile_type: "fresh_graduate" }), { status: 415 });
});
