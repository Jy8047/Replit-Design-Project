# Runpod CV OCR: offline adapter

## Current scope

This document describes the **unchanged offline adapter**, not a connected OCR
service. Its synthetic tests never make live calls or create paid resources.
The separate real-PDF text extractor and default-disabled GLM client are documented
in [CV PDF / GLM integration](cv-pdf-glm-integration.md). They do not use these fixtures.

- Official JavaScript package: `runpod-sdk` (installed version pinned by the lockfile).
- Backend module: `artifacts/api-server/src/lib/runpod-cv-ocr.ts`.
- The module imports **types only** from the SDK. It never creates a real client.
- It never reads credentials or environment variables, sends requests, creates
  resources, or examines PDF bytes.
- This offline adapter exposes no HTTP route and is not connected to the profile
  UI, matching pages, database, or browser storage.

Installing the SDK does not create a Runpod endpoint or make OCR available.

## Run locally without Runpod access

From the workspace root:

```sh
pnpm --filter @workspace/api-server run test:ocr
pnpm --filter @workspace/api-server run demo:ocr
```

The demo prints synthetic text from a bundled fixture and the simulated
`IN_QUEUE → IN_PROGRESS → COMPLETED` lifecycle. It does not load a CV. It never
asserts that the fictional student information came from a document.

## Adapter contract

```ts
const adapter = createOfflineCvOcrAdapter();
const queued = await adapter.submitFixture("text_pdf");
await adapter.getJob(queued.id); // IN_PROGRESS
const completed = await adapter.getJob(queued.id); // COMPLETED
```

Successful fixture results include:

```json
{
  "id": "offline-cv-ocr-1-1",
  "status": "COMPLETED",
  "mode": "offline",
  "provenance": "synthetic_fixture",
  "confirmed_by_user": false,
  "text": "[SYNTHETIC TEXT FIXTURE — no PDF parsing performed]\nFictional Student\nFictional University\nSkills: Research, Writing",
  "error": null
}
```

The ID is local to the adapter instance, not a real Runpod job ID. Every result is
synthetic and unconfirmed, including failures. The result is **not a Profile**
and does not invent education, employment, or other structured profile fields.
Calling `adapter.extractPdf(anything)` always rejects with `LIVE_DISABLED`,
without examining the argument.

### Fixtures and failure handling

| Fixture | Simulates | Terminal outcome |
| --- | --- | --- |
| `text_pdf` | A text-extraction success | Synthetic text only |
| `scanned_pdf` | An OCR success | Synthetic text only; no recognition performed |
| `empty_output` | Blank worker text | `NO_TEXT` |
| `worker_failure` | A failed worker | `WORKER_FAILED` |
| `malformed_output` | Wrong output schema | `INVALID_OUTPUT` |
| `oversized_output` | Text above 200,000 characters | `OUTPUT_TOO_LARGE` |
| `timed_out` | A terminal timeout | `TIMED_OUT` |
| `cancelled` | A terminal cancellation | `CANCELLED` |

Unknown fixture names, real-file payloads, unknown or foreign job IDs, and more
than 32 submissions per adapter are rejected. Only the fixed fixture names are
accepted. Failure messages do not reflect submitted input.

The private in-memory queue implements the installed SDK's `run` and `status`
TypeScript signatures. There is no injectable live endpoint. The mock request
`{input: {fixture_id: ...}}` and mock worker output `{text, provenance}` are
**local test contracts, not a verified OCR worker's API**.

Tests deny network access before importing the adapter and cover each fixture,
status transitions, idempotent terminal reads, invalid inputs, foreign IDs,
bounded queue size, real-extraction refusal, and unconfirmed provenance.
These are adapter tests, not proof of OCR accuracy or real SDK connectivity.

## What remains before real OCR integration

1. Identify an **existing** Runpod queue-based Serverless OCR endpoint and its
   documented input/output contract. Do not provision one under current approval.
2. Get explicit approval for billable jobs and external CV-data transfer. An
   existing endpoint can still charge for execution or scaling.
3. Configure server-only credentials through the approved secrets flow; do not
   paste keys into code, chat, browser variables, logs, or test fixtures.
4. Add a separately reviewed live adapter. Real SDK usage would initialize
   `runpodSdk(apiKey).endpoint(endpointId)`, then call `run({input: ...})` and
   `status(jobId)`. The worker-specific input must not be guessed from these mocks.
5. Before exposing any endpoint, define the OpenAPI contract, validate file size,
   type and contents, authenticate callers, enforce job ownership, bound polling
   and concurrency, sanitize errors, and prevent arbitrary endpoint selection.
   Do not blindly retry submissions: timeouts can leave an already billable job.
6. Verify the worker on fictional text PDFs, scanned PDFs, blank pages, damaged
   and encrypted files, relevant languages, and failure cases.
7. Separately implement evidence-based mapping from extracted text to editable
   profile fields. Never infer credentials or employment from a filename or
   automatically confirm extracted claims. Preserve the existing explicit
   review/confirmation and draft/privacy boundaries.

No environment toggle enables live calls **in this offline adapter**. Adding real
credentials later will not activate it.

## Official documentation used

- SDK setup: https://docs.runpod.io/serverless/sdks
- Requests and worker-specific input: https://docs.runpod.io/serverless/endpoints/send-requests
- JavaScript operations: https://docs.runpod.io/serverless/endpoints/operation-reference
