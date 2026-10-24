import { test, mock, after } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { once } from "node:events";
import express from "express";
import {
  makePdf, makeMultiColumnPdf, makeUnusualReadingOrderPdf, makePdfPages, encryptedPdf,
} from "./cv-fixtures.ts";
import { extractPdfText, MAX_CV_PDF_BYTES } from "../src/lib/pdf-extraction.ts";
import { createCvExtractionRouter } from "../src/routes/cv-extraction.ts";

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

async function withApi(run: (post: (bytes: Uint8Array, query?: string, headers?: Record<string, string>) => Promise<{ status: number; body: any; headers: any }>) => Promise<void>, extract = extractPdfText) {
  const app = express();
  app.use("/api", createCvExtractionRouter({ extract }));
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
test("actual anonymous HTTP upload extracts text locally, with no mapping provenance", async () => {
  await withApi(async post => {
    const result = await post(await makePdf());
    assert.equal(result.status, 200);
    assert.match(result.body.text, /Fictional Student/);
    assert.equal(result.body.profile, null);
    assert.equal(result.body.mapping, "NOT_REQUESTED");
    assert.equal(result.body.mapping_provenance, "none");
    assert.equal(result.headers["cache-control"], "no-store");
    const invalid = await post(await makePdf(), "profile_type=fresh_graduate&map_profile=true");
    assert.equal(invalid.status, 403);
    assert.equal(invalid.body.code, "LIVE_MAPPING_BLOCKED");
    const wrong = await post(await makePdf(), undefined, { "Content-Type": "image/jpeg" });
    assert.equal(wrong.status, 415);
  });
});
test("HTTP demo maps explicit actual PDF lines and preserves employment, never reports real AI success", async () => {
  await withApi(async post => {
    const query = "profile_type=career_switcher&mapping_mode=demo";
    const good = await post(await makePdf("School: Fictional University\nDegree: Bachelor\nMajor: Computing\nSkills: Python, SQL\nEmployment Experience: Fictional stated work"), query);
    assert.equal(good.status, 200);
    assert.equal(good.body.mapping, "SIMULATED");
    assert.equal(good.body.mapping_provenance, "simulated");
    assert.equal(good.body.profile.mapping_provenance, "simulated");
    assert.equal(good.body.profile.confirmed_by_user, false);
    assert.equal(good.body.profile.employment_experience, "Fictional stated work");
    assert.equal(good.body.profile.education.school, "Fictional University");
    assert.equal(good.body.profile.skills, "Python, SQL");
    assert.equal(good.body.profile.name, "");
    assert.equal(good.body.profile.mapping_method, "rules-v2");
    assert.deepEqual(good.body.profile.matched_summary, { skills: 2, education: 3, basics: 0 });
    assert.notEqual(good.body.mapping, "READY");
    const scan = await post(await makePdf("", 1, true), query);
    assert.equal(scan.body.status, "OCR_REQUIRED");
    assert.equal(scan.body.profile, null);
    assert.equal(scan.body.mapping_provenance, "none");
    const tooBig = await post(new Uint8Array(MAX_CV_PDF_BYTES + 1));
    assert.equal(tooBig.status, 413);
  });
});

test("HTTP demo maps simple labelled PDF lines to a partial, unconfirmed profile", async () => {
  const text = `Jordan Miller | jordan.miller@example.test | +60 12-345 6789
EDUCATION University of Malaya | 2020-2024 | Bachelor of Science in Computer Science
SKILLS Python | SQL | React
WORK EXPERIENCE Northstar Analytics | Data Intern | 2023-2024`;
  await withApi(async post => {
    const response = await post(await makePdf(text), "profile_type=career_switcher&mapping_mode=demo");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "TEXT_EXTRACTED");
    assert.match(response.body.text, /EDUCATION University of Malaya/u);
    assert.equal(response.body.mapping, "SIMULATED");
    assert.equal(response.body.mapping_provenance, "simulated");
    assert.equal(response.body.profile.mapping_method, "rules-v2");
    assert.equal(response.body.profile.confirmed_by_user, false);
    assert.equal(response.body.profile.name, "Jordan Miller");
    assert.equal(response.body.profile.education.school, "University of Malaya");
    assert.equal(response.body.profile.education.degree, "Bachelor of Science");
    assert.equal(response.body.profile.education.major, "Computer Science");
    assert.deepEqual(response.body.profile.skills.split(", "), ["Python", "SQL", "React"]);
    assert.match(response.body.profile.employment_experience, /Northstar Analytics/u);
    assert.equal(response.body.profile.background, "");
  });
});

test("HTTP demo maps separate text columns without merging adjacent field values", async () => {
  await withApi(async post => {
    const response = await post(await makeMultiColumnPdf(), "profile_type=career_switcher&mapping_mode=demo");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "TEXT_EXTRACTED");
    assert.match(response.body.text, /EDUCATION SKILLS/u);
    assert.match(response.body.text, /University of Malaya Python/u);
    assert.equal(response.body.mapping, "SIMULATED");
    assert.equal(response.body.mapping_provenance, "simulated");
    assert.equal(response.body.profile.mapping_method, "rules-v2");
    assert.equal(response.body.profile.confirmed_by_user, false);
    assert.equal(response.body.profile.name, "Jordan Miller");
    assert.equal(response.body.profile.education.school, "University of Malaya");
    assert.equal(response.body.profile.education.degree, "Bachelor of Science");
    assert.equal(response.body.profile.education.major, "Computer Science");
    assert.deepEqual(response.body.profile.skills.split(", "), ["Python", "SQL", "React"]);
    assert.equal(response.body.profile.academic_experience, "Graduated 2024");
    assert.equal(response.body.profile.employment_experience, "");
    assert.equal(response.body.profile.personal_experience, "");
    assert.equal(response.body.profile.background, "");
  });
});

test("HTTP demo maps a real generated table-like PDF through explicit column labels", async () => {
  const text = `Jordan Miller
School | Degree | Major | Skills
Fictional University | Bachelor of Science | Data Science | Python, SQL`;
  await withApi(async post => {
    const response = await post(await makePdf(text), "profile_type=fresh_graduate&mapping_mode=demo");
    assert.equal(response.status, 200);
    assert.equal(response.body.profile.education.school, "Fictional University");
    assert.equal(response.body.profile.education.degree, "Bachelor of Science");
    assert.equal(response.body.profile.education.major, "Data Science");
    assert.equal(response.body.profile.skills, "Python, SQL");
    assert.equal(response.body.profile.confirmed_by_user, false);
  });
});

test("HTTP demo maps reordered sections and wrapped education in a generated PDF", async () => {
  const text = `Jordan Miller
SKILLS
Python
SQL
EDUCATION
Example Institute
Bachelor of Science
in Computer Science`;
  await withApi(async post => {
    const response = await post(await makePdf(text), "profile_type=fresh_graduate&mapping_mode=demo");
    assert.equal(response.status, 200);
    assert.equal(response.body.profile.education.school, "Example Institute");
    assert.equal(response.body.profile.education.degree, "Bachelor of Science");
    assert.equal(response.body.profile.education.major, "Computer Science");
    assert.equal(response.body.profile.skills, "Python, SQL");
  });
});

test("HTTP demo handles a PDF whose content stream lists the skills column before the name", async () => {
  await withApi(async post => {
    const response = await post(
      await makeUnusualReadingOrderPdf(),
      "profile_type=fresh_graduate&mapping_mode=demo",
    );
    assert.equal(response.status, 200);
    assert.ok(response.body.text.indexOf("SKILLS") < response.body.text.indexOf("Jordan Miller"));
    assert.equal(response.body.profile.name, "");
    assert.equal(response.body.profile.education.school, "Example Institute");
    assert.equal(response.body.profile.education.major, "Computer Science");
    assert.equal(response.body.profile.skills, "Python, SQL");
  });
});

test("HTTP demo carries source-backed fields across actual PDF pages", async () => {
  const pages = [
    "Jordan Miller",
    "EDUCATION\nExample Institute\nBachelor of Science\nin Computer Science",
    "SKILLS\nPython\nSQL\nWORK EXPERIENCE\nNorthstar Analytics | Data Intern | 2023-2024",
  ];
  await withApi(async post => {
    const response = await post(await makePdfPages(pages), "profile_type=career_switcher&mapping_mode=demo");
    assert.equal(response.status, 200);
    assert.equal(response.body.pages, 3);
    assert.equal(response.body.profile.name, "Jordan Miller");
    assert.equal(response.body.profile.education.school, "Example Institute");
    assert.equal(response.body.profile.education.major, "Computer Science");
    assert.equal(response.body.profile.skills, "Python, SQL");
    assert.match(response.body.profile.employment_experience, /Northstar Analytics/u);
    assert.equal(response.body.profile.confirmed_by_user, false);
  });
});

test("paid-mode requests and spoofed identity/config headers are blocked before parsing or networking", async () => {
  let extractionCalls = 0;
  await withApi(async post => {
    for (const headers of [
      { "X-CV-Consent": "external-ai" },
      { "X-CV-Consent": "local-extraction", "Authorization": "Bearer fictional-forged-token" },
      { "X-CV-Consent": "external-ai", "X-Replit-User-Id": "fictional-owner" },
    ]) {
      const response = await post(Buffer.from("not a PDF"), "profile_type=fresh_graduate&map_profile=true&mapping_mode=demo", headers);
      assert.equal(response.status, 403);
      assert.deepEqual(response.body, { code: "LIVE_MAPPING_BLOCKED" });
    }
    const unknownMode = await post(Buffer.from("not a PDF"), "profile_type=fresh_graduate&mapping_mode=live");
    assert.equal(unknownMode.status, 400);
    const repeated = await post(Buffer.from("not a PDF"), "profile_type=fresh_graduate&map_profile=false&map_profile=true");
    assert.equal(repeated.status, 400);
    assert.equal(extractionCalls, 0);
  }, async () => { extractionCalls++; throw new Error("Blocked request must not parse"); });
});

test("resource backstop allows only two active uploads and releases slots after completion", async () => {
  const release: Array<() => void> = [];
  const waitFor = async (count: number) => {
    for (let i = 0; i < 200; i++) {
      if (release.length === count) return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail("Synthetic extraction did not reach its controlled wait");
  };
  await withApi(async post => {
    const first = post(Buffer.from("synthetic resource-test body"));
    await waitFor(1);
    const second = post(Buffer.from("synthetic resource-test body"));
    await waitFor(2);
    try {
      const busy = await post(Buffer.from("synthetic resource-test body"));
      assert.equal(busy.status, 429);
      assert.equal(busy.body.code, "BUSY");
    } finally {
      for (const resolve of release.splice(0)) resolve();
    }
    assert.equal((await first).status, 200);
    assert.equal((await second).status, 200);
    const next = post(Buffer.from("synthetic resource-test body"));
    await waitFor(1);
    release.shift()!();
    assert.equal((await next).status, 200);
  }, async () => {
    await new Promise<void>(resolve => release.push(resolve));
    return { status: "OCR_REQUIRED", text: "", pages: 1 };
  });
});

test("resource backstop rejects the eleventh request in the same per-process minute", async () => {
  let extractionCalls = 0;
  await withApi(async post => {
    for (let i = 0; i < 10; i++) {
      assert.equal((await post(Buffer.from("synthetic resource-test body"))).status, 200);
    }
    const limited = await post(Buffer.from("synthetic resource-test body"));
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "BUSY");
    assert.equal(extractionCalls, 10);
  }, async () => {
    extractionCalls++;
    return { status: "OCR_REQUIRED", text: "", pages: 1 };
  });
});
