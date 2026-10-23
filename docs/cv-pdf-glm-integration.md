# FuturePath AI: public PDF demo and disconnected GLM-5.3 client

## Current safety boundary

The public application deliberately has **no login or caller authentication**.
It does not assume Replit's platform protection covers API paths.
Consent headers, CORS, cross-site checks and rate limits are not authentication.

**There is no live RunPod mapping path in the public router.**
`map_profile=true` is rejected with HTTP 403 / `LIVE_MAPPING_BLOCKED` before
PDF parsing. The route has no injectable live mapper. `serverGlmSettings()`
always returns `{enabled:false}` without reading any environment variable or
credential. Adding a key or changing `RUNPOD_LIVE_ENABLED` cannot reconnect it.
The live flag must remain unset/false; it is not a sufficient safety boundary
and is no longer an enabling mechanism.

No Replit Auth, Clerk integration, login page, user/session tables, new service,
new credential requirement or paid resource was introduced.

## Working features

1. **Real local PDF text extraction:** the browser sends raw PDF bytes to this
   application's server after consent. `pdf-parse` extracts actual text; no
   filename or bundled fixture produces extraction output.
2. **Optional simulated mapping:** a deterministic, offline label copier maps
   explicitly labelled PDF lines into an editable profile. This is **not AI**,
   not a GLM response, not OCR and not a natural-language CV parser.
3. **Existing online form / review / confirmation:** unchanged apart from
   persistent simulation notices. Failed requests do not replace current drafts
   or confirmed profiles. Replacing a dirty draft requires an explicit choice.
4. **Existing matching and planning:** the same confirmed skills string is used;
   no matching, roadmap, SDG or scenario algorithm was rewritten.
5. The original synthetic queue/OCR adapter remains separate and unchanged.

## Demonstrate without login, credentials or RunPod calls

1. My Profile → Upload CV → choose a fictional, text-based PDF under 10 MiB.
2. Consent to sending the file to the **app server**, not RunPod.
3. Leave simulated mapping unchecked to inspect actual extracted text only.
4. For an editable simulated draft, check simulated mapping and use a PDF with
   one explicit English label per line, for example:

```text
Name: Fictional Student
School: Fictional University
Degree: Bachelor of Science
Major: Computing
Key Courses: Databases
Skills: Python, SQL
Internship Experience: Fictional research internship
Employment Experience: Fictional part-time assistant
```

Other supported labels correspond to existing fields: Academic Experience,
Professional Certificates, Personal Experience, Interests & Hobbies,
Other Experience, Role and Background. Underscored field labels also work.
First occurrence wins for repeated labels. Unknown narrative is ignored.
Missing facts remain empty strings, never guessed. This limited English-label
format is intentional; UI instructions/notices support English, Chinese and Malay.

5. Check the extracted text and visibly marked **SIMULATED MAPPING** result.
6. Choose Review and edit extracted draft. If Fresh Graduate retains an explicit
   employment line, the existing type-resolution guard still requires a choice.
7. Edit missing education fields (or explicitly enter None where appropriate),
   review, then Confirm Profile. Confirmation records user review; it does not
   convert a simulation into a real or independently verified AI result.

`mapping_provenance:"simulated"` is optional metadata on the existing Profile.
Ordinary online/older profiles retain their existing structure without that key.
The marker persists through tab-draft recovery, confirmation and reload.
The existing education/experience/skills values remain strings.

## API contract

`POST /api/profile/extract-pdf`

- Raw `application/pdf` body, not multipart or JSON.
- Required `profile_type=fresh_graduate|career_switcher`.
- Optional `mapping_mode=none|demo`; default none.
- Legacy `map_profile=false` accepted; **true always rejected**.
- Required `X-CV-Consent: local-extraction`; this is consent, not authentication.

Local-only result:

```json
{
  "status": "TEXT_EXTRACTED",
  "text": "Actual text from supplied bytes",
  "pages": 1,
  "profile": null,
  "mapping": "NOT_REQUESTED",
  "mapping_provenance": "none"
}
```

Simulated result uses `mapping:"SIMULATED"`,
`mapping_provenance:"simulated"`, and an unconfirmed `profile` with its own
`mapping_provenance:"simulated"`, `input_method:"pdf_upload"`,
`confirmed_by_user:false`. It never reports `READY` or real AI success.
If an API response includes a profile without the simulation markers, the UI
rejects it rather than showing it as a successful draft.

Blank/image-only PDF: `status:"OCR_REQUIRED"`, `text:""`, `profile:null`,
`mapping:"OCR_REQUIRED"`, `mapping_provenance:"none"`. **OCR is not implemented.**
Mixed PDFs may yield only their text layer; partial extraction is not OCR.

Error codes are safe fixed strings, with no raw CV/upstream data:
empty/invalid/consent 400, blocked live mode 403, size 413, media type 415,
corrupt/encrypted/page/text/parser-timeout 422, concurrency/rate 429.

Source of truth: `lib/api-spec/openapi.yaml`. Regenerate clients/schemas with:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Extraction safety and remaining public-service risk

Bytes are processed in an isolated worker with an empty environment (no inherited
secrets), 256 MiB JS heap cap, 15-second timeout, at most 30 pages and 60,000
extracted characters. Embedded JS is not evaluated. Encrypted/password-protected
documents are rejected, including those with an empty user password.
Parser warnings/raw errors are not piped into logs. Files/raw text are memory-only.

Public local processing still consumes this application's compute. Two active
requests and ten requests/minute are per-process backstops, not authentication,
distributed protection or a monetary budget. They reset on restart. Public
availability and provider-infrastructure billing are separate from RunPod
inference costs; this change does not claim all server operation is cost-free.
Platform preview protection and the authorized-user list remain **unverified**.

Unconfirmed profile fields use existing temporary sessionStorage; confirmed
profiles use device localStorage. Do not upload unnecessary personal details.
No CV is written to DB/App Storage, and no CV text is sent to RunPod in this demo.

## Prepared GLM-5.3 client audit (not connected to the public route)

`src/lib/runpod-glm-profile.ts` retains the client for future separately reviewed
work, and its tests inject mock settings/transports using fictional credentials.

| Setting | Code |
| --- | --- |
| URL | `https://api.runpod.ai/v2/b1dd8hy2hqo1nb/openai/v1/chat/completions` |
| Model | `glm-5.3` |
| Parameters | temperature 0, max_tokens 2500, stream false |
| Reasoning | omitted by default; low only when explicitly supported in injected settings |
| Timeout | 30 seconds; AbortController plus timeout race |
| Response cap | 100,000 bytes |
| Retries / redirects | no automatic retries; redirects rejected |
| Errors | safe auth/rate/timeout/upstream/malformed/profile error codes |
| Validation | exact keys/types, bounded strings, unconfirmed metadata, literal source spans |

Prompt treats CV text as untrusted; missing facts stay empty, no tools or
recommendations. Literal evidence checks cannot prove field assignment or truth.
Response truncation, tool calls and invalid content are rejected. A future
timeout could still leave a billed request; no automatic retry is safe.
The endpoint's model availability, reasoning support, context/token limits,
pricing, data retention and compatibility remain **unverified**.
PDF/image/multimodal submission is not implemented.

## Conditions for any future real test

Do not enable the flag to test this public demo: **it will not enable mapping**.
No real test was performed in this change.

A future approved change must first establish:
1. Reliable server-side caller authorization (or a separately isolated,
   access-controlled operator-only runner) without exposing a paid public proxy.
2. Durable usage/spend limits, concurrency controls and a reviewed retention policy.
3. Organizer confirmation of endpoint/model permissions, cost and parameters.
4. Explicit approval for costs and external CV-text transfer.
5. A separately reviewed reconnection, mock safety tests, and a user-run fictional
   live test. Keep secrets in the approved server-only secrets flow; never log,
   display or put them in browser code. The existing key alone grants no consent.

If these cannot be established, continue using local extraction and simulation.

## Verification commands and scope

```sh
pnpm --filter @workspace/api-server run test:cv
pnpm --filter @workspace/api-server run test:ocr
pnpm --filter @workspace/career-pathways test
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/career-pathways run typecheck
pnpm --filter @workspace/api-server run build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/career-pathways run build
```

PDF tests generate genuine fictional text, image-only, corrupt/truncated,
encrypted and oversized PDFs. API tests exercise actual local HTTP, including
blocked paid-mode requests with forged identity/config headers, no parsing on
blocked requests, simulation labels, missing facts and employment retention.
GLM network tests are mocked. Existing profile/matching/scenario tests remain.
No test contacts the real endpoint or reads actual credentials.

Validation for this change: 19 PDF/API/demo/GLM tests, 14 unchanged offline
adapter tests and 30 frontend profile/matching/planning tests passed. Both
TypeScript checks and both builds passed. The frontend build reported a
non-blocking tooltip source-map warning.
Headless Chromium used the actual built API for PDF text, OCR_REQUIRED and
rule-based demo responses (no fabricated happy-path responses). It verified
editable draft, failure preservation, reload recovery, review and explicit
confirmation with persistent simulation provenance, with no runtime exceptions.

## Changed areas

- API: `src/routes/cv-extraction.ts`, new `src/lib/cv-demo-mapping.ts`,
  `src/lib/runpod-glm-profile.ts`, CV/demo/GLM tests.
- Web: `pdf-extraction-panel.tsx`, simulation notice in `profile-page.tsx`,
  optional provenance normalization in `profile.ts`, provenance-storage test,
  EN/ZH/MS translations.
- OpenAPI plus regenerated api-client-react/api-zod outputs.
- This guide and scope clarification in the offline adapter guide.
- No new dependencies, login, tables, migrations or paid-resource configuration.
