# Real PDF text extraction and prepared RunPod GLM-5.3 mapping

## Status and consent

- Local backend extraction reads **actual uploaded PDF bytes**, using `pdf-parse`.
- No fixture adapter or filename is used to produce real extraction output.
- Blank/image-only PDFs return **`OCR_REQUIRED`**. This is not OCR, and does not
  diagnose whether every scanned page is legible. Mixed PDFs may yield only their
  text-layer pages. Missing/garbled text must be reviewed.
- The GLM Chat Completions client is implemented but **disabled by default**.
  Its tests use mocked HTTP responses. **The supplied endpoint/model has not
  been contacted or verified.** No secret was read or live inference performed
  during development.
- The original offline Runpod adapter and its tests remain separate and unchanged.
- No paid resources are created. Enabling inference can still incur costs on
  the organizer's existing endpoint.

## Actual flow

1. My Profile → Upload CV: one PDF, at most 10 MiB. Local metadata/header/EOF
   checks still run. No document is sent until the user consents and clicks Parse.
2. `PdfExtractionPanel` calls generated `extractCvPdf` with the **File as the raw
   application/pdf body**, a chosen profile type, and `X-CV-Consent`.
   Filenames are not sent to the API or model.
3. `POST /api/profile/extract-pdf` validates consent/type/size/query and parses in
   an isolated worker with an empty environment (no inherited secrets), 256 MiB
   JS heap cap, 15-second timeout, at most 30 pages and 60,000 extracted characters.
   Embedded JS is not evaluated. Raw parser output/errors are not logged.
4. Without `map_profile=true`, only local text is returned. With explicit
   RunPod consent, the mapper checks the exact server flag, then the key.
   Disabled or failed mapping returns local text with `profile:null` and an error
   code, never a fabricated draft.
5. If enabled, the client POSTs **text only**, never PDF/image input, to
   `https://api.runpod.ai/v2/b1dd8hy2hqo1nb/openai/v1/chat/completions`
   with `model:glm-5.3`, `temperature:0`, `max_tokens:2500`, no streaming,
   a 30-second timeout, redirects rejected, response capped at 100,000 bytes,
   and **no automatic retries**. The model's context/tokenizer limits remain
   unverified; 60,000 characters is an application cap, not a token guarantee.
6. Prompt treats CV content as untrusted data. Missing facts must be `""`;
   keys/types are exactly the existing Profile schema. Server rejects missing/
   extra keys, arrays in text fields, oversized values, wrong metadata, automatic
   confirmation, and nonempty fields not found as literal spans in source text.
   Skills may be comma-separated spans. This strict check can reject legitimate
   paraphrases and is intentionally conservative.
7. User inspects the returned raw text and JSON. “Review and edit extracted draft”
   requires confirmation before replacing an existing dirty draft. It opens the
   existing editable form; it does **not** save a confirmed profile.
8. Existing education validation, employment-resolution guard, preview, and
   Confirm Profile must succeed before `onSave` updates storage and Router state.
   `readProfile` ignores unconfirmed legacy stored objects. Matching still
   receives only the confirmed `skills` string; no matcher logic was changed.
   Both online and PDF-derived drafts retain `input_method` across tab recovery.

## API contract

Single source: `lib/api-spec/openapi.yaml`; generated React helpers and Zod
response validators are regenerated with:

```sh
pnpm --filter @workspace/api-spec run codegen
```

Parameters:
- `profile_type=fresh_graduate|career_switcher` (required; selected by the user).
- `map_profile=false|true` (default omitted/false).
- `X-CV-Consent: local-extraction` for local only, or `runpod-text` for mapping.
- `Content-Type: application/pdf`; raw bytes, **not multipart or base64 JSON**.

Success response:

```json
{
  "status": "TEXT_EXTRACTED",
  "text": "Actual text from the supplied PDF",
  "pages": 1,
  "profile": null,
  "mapping": "NOT_REQUESTED"
}
```

Empty/image-only: `status:"OCR_REQUIRED"`, `text:""`, `profile:null`,
`mapping:"OCR_REQUIRED"`. Successful mapping: `mapping:"READY"` and the existing
Profile object with `input_method:"pdf_upload"`, `confirmed_by_user:false`.
Education fields, experience, interests, skills, name, role, background and notes
remain **strings**, not arrays. A fresh graduate's explicitly stated employment
is retained and routed to the existing type-resolution screen.

File failures return safe `{code}` responses:
400 empty/invalid/consent; 413 size; 415 media type; 422 corruption, encryption,
page/text limits or parser timeout; 429 concurrency/rate backstop.
Mapping failures are reported alongside successfully extracted local text:
`LIVE_DISABLED`, `KEY_MISSING`, `AUTH_ERROR`, `RATE_LIMITED`,
`UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`, `MALFORMED_RESPONSE`, `INVALID_PROFILE`,
`TEXT_TOO_LARGE`. Neither raw upstream errors nor CV content appear in errors.

## Required Secrets and manual flags (not set by development)

- Secret: **`RUNPOD_API_KEY`**. Backend only; never use `VITE_` or paste into
  chat, code, URLs, test fixtures, logs or screenshots.
- Nonsecret server flag: **`RUNPOD_LIVE_ENABLED=true`**, exact lowercase string.
  Anything else keeps inference off, without reading the key.
- Optional flag **`RUNPOD_LOW_REASONING_SUPPORTED=true`** adds
  `reasoning_effort:"low"`. Leave it unset until the organizer confirms support
  for this endpoint. No fallback retry is performed if unsupported.
- Base URL/model are fixed in backend code, not browser/user-supplied URLs.

Use the project's Replit Secrets interface for the key and nonsecret environment
configuration for flags. Configure development/production separately as needed.
Restart the API workflow after manual configuration. **No configuration or
secret request was made as part of this coding task.**

## Manual live-test procedure — user-run only, can incur costs

1. Ask the organizer to confirm endpoint/model availability, access permissions,
   data-retention policy, pricing and supported reasoning parameter. Do not
   provision a new endpoint. The generic RunPod docs do not establish this
   particular endpoint's capabilities.
2. Restrict app access to authorized testers before enabling the flag. This app's
   current API has **no account authentication**. A consent header is not auth.
   Never enable this as a public paid inference proxy.
3. Put the key in backend Secrets and manually set the live flag. Leave low
   reasoning off unless confirmed supported. Restart the API.
4. Create a **fictional**, text-based student PDF with explicit school/degree/
   major and comma-separated skills; omit personal contact/ID details.
5. Keep a known confirmed profile and an unsaved draft. Upload the PDF, select
   type, read both consent statements, enable optional RunPod mapping, Parse
   **once**. It may take a cold start longer than the timeout.
6. Only `mapping:READY` with fields matching the PDF counts as a successful live
   mapping test. Check names, empty missing fields, skill strings, retained work,
   then use the draft, edit, preview and explicitly confirm. Matching must not
   change beforehand. Do not call mocked tests “live verified”.
7. On timeout, inspect the organizer's job/usage records before another attempt:
   it may already be running/billed. The app never automatically re-submits.
8. Disable the live flag after testing and restart. If it fails, share only safe
   error codes, never CV text, API keys or raw request/response logs.

No “list models” probe or other real request is required by the app.

## Automated / local validation

```sh
pnpm --filter @workspace/api-server run test:cv
pnpm --filter @workspace/api-server run test:ocr
pnpm --filter @workspace/career-pathways test
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/career-pathways run typecheck
```

PDF tests generate actual fictional PDFs with `pdf-lib`, including real embedded
image-only pages and genuine Standard Security encrypted PDFs (password-required
and empty-user-password). Tests also cover truncation/corruption, MIME, byte/page/
text limits, HTTP consent/response shape, and no mapping on OCR_REQUIRED.
GLM tests deny global outbound fetch and inject mocked transports for successful
and malformed responses, auth/rate errors, oversized output, timeout/abort,
bounded requests, evidence rejection and disabled/key-missing protection.
Loopback HTTP is used for the upload-route tests. No real endpoint is tested.

Acceptance results for this change:
- New PDF/API/GLM suite: **14 passed**.
- Unchanged offline adapter suite: **14 passed**.
- Full frontend logic suite (matching/scenarios/profile/storage): **30 passed**.
- API and frontend TypeScript checks passed.
- Headless Chromium exercised the running, built API: actual text-PDF upload and
  image-only OCR_REQUIRED response passed. Browser-intercepted (mocked) mapping
  responses verified failure preservation, editable draft, reload recovery,
  preview and explicit confirmation; PDF provenance remained intact. An old
  unconfirmed stored profile was excluded from confirmed state. No browser runtime
  exceptions were observed in that journey.
- These are local and mocked results, **not a real RunPod endpoint test**.

## Changed files / dependencies

- API `src/lib/cv-errors.ts`, `pdf-extraction.ts`,
  `pdf-extraction-worker.ts`, `runpod-glm-profile.ts`; route
  `src/routes/cv-extraction.ts` and route registration.
- API `build.mjs`: separate worker entry point, external `pdf-parse`;
  `tsconfig.json`: TypeScript import extensions for tests/source.
- API `package.json`, workspace lockfile: runtime **pdf-parse 2.4.5**;
  development-only **pdf-lib 1.17.1**, **tsx**; new `test:cv` script.
  Existing `runpod-sdk` is retained. No OpenAI SDK is needed for the bounded fetch
  client using the documented compatible HTTP API.
- OpenAPI spec and generated api-client-react/api-zod files; api-zod type-only DOM
  lib enables the generated binary `Blob` declaration without runtime DOM use.
- Web `pdf-extraction-panel.tsx`, existing `profile-page.tsx`, `profile-storage.ts`,
  its test, `App.tsx` confirmation gate, and EN/ZH/MS translations.
- This guide, offline adapter guide scope clarification, project memory.
- Ignore rules exclude generated browser-test outputs. No uploaded CV is saved.

## Remaining limitations and privacy

- No OCR, multimodal submission, layout reconstruction, verified live endpoint,
  independently verified CV facts, or guaranteed prompt-injection immunity.
  Literal-span validation cannot prove that a claim belongs to the correct field
  or is true. User review remains essential; never infer missing credentials.
- Real PDF extraction was tested on generated fictional documents, not all PDF
  producers/languages/fonts. Unsupported fonts or complex layouts may extract
  incorrectly; encrypted documents are intentionally rejected rather than
  asking for passwords.
- Local bytes/raw text are memory-only, not in DB, App Storage, localStorage or
  logs. Draft **profile fields** still use the existing temporary sessionStorage,
  and confirmed fields use device localStorage. Browser extensions, shared
  devices, screenshots and an operator's infrastructure can affect privacy;
  “not saved” does not guarantee secure physical-memory erasure.
- If live mapping is explicitly enabled, the entire text layer (including contact
  details present in the CV) goes to the organizer's RunPod endpoint. The prompt
  tells the model not to populate sensitive fields, but this is **not redaction**.
- Per-process backstops: two active uploads, ten requests/minute, five mapping
  attempts/hour. They reset on restart and are not distributed budgets/auth.
  Add authenticated authorization, distributed limits, usage controls and a
  reviewed data-retention policy before public live use.

## Documentation consulted

- https://docs.runpod.io/serverless/vllm/openai-compatibility
  (Chat Completions, base URL, parameters, model/vision support caveats).
- https://mehmet-kozan.github.io/pdf-parse/typedoc/index.html
  (PDFParse data/getInfo/getText/destroy, PasswordException and Node support).
- Existing offline SDK guide remains `docs/runpod-offline-ocr.md`.
