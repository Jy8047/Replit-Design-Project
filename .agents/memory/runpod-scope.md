---
name: Runpod integration scope
description: Selected Runpod workload and the limits of the user's authorization
---

Runpod's intended workload in FuturePath AI is CV text extraction/OCR, not career
matching or career explanations. Do not expose secrets or provision paid resources.
The user explicitly chose an offline adapter only, with no live calls.

**Why:** The user explicitly selected CV text extraction/OCR, prohibited paid
resource creation, and chose offline preparation rather than connecting a live
endpoint. Installing the SDK must not implicitly authorize billable execution.

**How to apply:** Keep the existing profile review and confirmation boundary.
Establish the existing worker's input/output contract before implementing live
calls. Choosing the workload is not permission to create an endpoint, submit
billable test jobs, or upload personal CV data. Use offline tests until live
execution and data transfer are explicitly authorized.
Future credentials or endpoint configuration must not silently change that
authorization. Synthetic fixtures must never be presented as extracted CV data
or treated as a verified real worker contract.
