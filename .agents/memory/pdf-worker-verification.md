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

## Cancellation and concurrency

Keep parser concurrency allocated until the worker has actually stopped, even
when the HTTP client has already disconnected or received a timeout response.

**Why:** Freeing a request slot before its parser exits lets repeated client
disconnects start more parsing work than the concurrency budget allows.

**How to apply:** When changing intake cancellation, test disconnection after a
complete body as well as during upload, and prove that replacement work cannot
reuse the cancelled parser's slot before termination settles.
