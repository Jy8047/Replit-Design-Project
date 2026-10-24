---
name: PDF worker verification
description: Why source-level parser tests are insufficient for the packaged PDF API
---

Verify PDF extraction through the built, running API with fictional file bytes,
not just by invoking the TypeScript function in source tests.

**Why:** Worker entry-point paths can differ after bundling, and a parser's startup
heap requirements can make valid PDFs look corrupt when the worker exits. These
are execution-environment failures, not evidence that the input is invalid.

**How to apply:** Keep a built-route/browser smoke test whenever changing parser
dependencies, worker isolation, build entry points or packaging. Preserve safe
user errors without logging CV contents or raw parser output for diagnosis.

## Skill alias evidence

For rule-based skill aliases, retain the exact matched spelling from the CV,
validate that source span against the extracted text, and only then canonicalize
it for downstream matching.

**Why:** A canonical skill label may not literally appear in the source CV; using
it as evidence would either reject a valid alias or tempt weakening source checks.

**How to apply:** Keep alias lookup separate from source-evidence validation and
test aliases through the actual API response as well as the mapper.

## Cancellation and concurrency

Keep parser concurrency allocated until the worker has actually stopped, even
when the HTTP client has already disconnected or received a timeout response.

**Why:** Freeing a request slot before its parser exits lets repeated client
disconnects start more parsing work than the concurrency budget allows.

**How to apply:** When changing intake cancellation, test disconnection after a
complete body as well as during upload, and prove that replacement work cannot
reuse the cancelled parser's slot before termination settles.

## Plain-text layout boundaries

Normalize only clear section headings, explicit field labels, and visible table
separators. Keep every mapped value verifiable against the original extracted
text; leave uncertain fields blank, and never search education or experience
prose for inferred skills.

**Why:** The current PDF worker exposes page text without layout coordinates.
Flattened columns can join unrelated values, so aggressive reconstruction can
create false majors or skills while appearing to improve coverage.

**How to apply:** Use synthetic generated PDFs to verify the real API route.
Before claiming support for arbitrary layouts, test a redacted, user-approved
sample; if reading order itself is lost, evaluate coordinate-aware extraction
separately rather than weakening source-evidence checks.
