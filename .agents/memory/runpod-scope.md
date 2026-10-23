---
name: Runpod integration scope
description: Selected Runpod workload and the limits of the user's authorization
---

Runpod's intended workload in FuturePath AI is CV processing, not career matching
or career explanations. Do not expose secrets or provision paid resources.
The initial authorization was an offline adapter. The user subsequently authorized
actual local PDF text extraction and preparation of a default-disabled GLM-5.3
Chat Completions mapper using the organizer's supplied endpoint.
This does not authorize live calls, secret inspection or costs during coding.

**Why:** The user's later integration brief explicitly separates implementation
from a user-run live test and requires a server-side flag plus configured key.
Adding credentials must not implicitly authorize billable execution.

**How to apply:** Keep the existing profile review and confirmation boundary.
Use actual PDF bytes for local extraction and explicitly report OCR_REQUIRED for
no-text PDFs. GLM receives text only; multimodal/OCR support is not established.
Keep network tests mocked, never probe the organizer's endpoint during coding,
and describe endpoint/model compatibility as unverified until a user-run test
confirms it. The user must manually enable the live flag and consent to external
text transfer/costs. Credentials alone cannot enable it. Preserve the original
offline adapter; its synthetic fixtures are never real CV output or a verified
OCR worker contract. Missing facts remain empty, and confirmation remains explicit.
