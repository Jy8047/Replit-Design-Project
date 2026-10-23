---
name: Runpod integration scope
description: Selected Runpod workload and the limits of the user's authorization
---

Runpod's intended workload in FuturePath AI is CV processing, not career matching
or career explanations. Do not expose secrets or provision paid resources.
The current product scope is a no-login public demonstration: actual local PDF
text extraction and explicitly labelled, rule-based simulated mapping.
The user explicitly prohibited Replit Auth, Clerk, login pages, user tables and
session tables. Keep the prepared GLM-5.3 client disconnected from public requests.
No live calls, secret inspection or inference costs are authorized during coding.

**Why:** The user rejected the proposed login/allowlist approach and required a
safe public demonstration instead. Without reliable caller authorization and
durable spend controls, a flag plus a key is not an adequate safety boundary.

**How to apply:** Keep the existing profile review and confirmation boundary.
Use actual PDF bytes for local extraction and explicitly report OCR_REQUIRED for
no-text PDFs. GLM receives text only; multimodal/OCR support is not established.
Keep network tests mocked, never probe the organizer's endpoint during coding,
and describe endpoint/model compatibility as unverified until a user-run test
confirms it. Keep real mapping blocked even if credentials or flags are changed.
Do not provide flag-only instructions for enabling public paid inference.
Future real testing needs separately approved reliable authorization or an
isolated operator-only runner, spend controls, and explicit cost/data-transfer
approval. Do not introduce login without a new user instruction.
Preserve simulation labels through review, recovery and confirmation;
confirmation does not make simulated data real AI evidence. Preserve the original
offline adapter; its fixtures are never real CV output or a verified OCR worker
contract. Missing facts remain empty, and confirmation remains explicit.
