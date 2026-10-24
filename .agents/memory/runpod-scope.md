---
name: Runpod integration scope
description: Selected Runpod workload and the limits of the user's authorization
---

The team decided on 2026-10-24 that PivotPath AI will not use a GPU, RunPod, or
GLM-5.3. The prepared provider client and offline SDK fixture have been removed.
The current product scope is local text extraction from text-based PDFs and
explicitly labelled, rule-based simulated profile mapping; OCR is not implemented.
The app does not read RunPod environment variables or call a model service.

The user has also prohibited Replit Auth, Clerk, login pages, user tables, and
session tables for this project. Profile/matching handoff work must not add
databases or other infrastructure, or modify other teams' module business logic.

**Why:** The team explicitly chose not to use GPU, RunPod, or GLM-5.3. This
supersedes earlier planning for a prepared provider client. The user also
rejected a login/allowlist approach and requires a no-login demonstration.

**How to apply:** Do not reintroduce RunPod/GLM clients, SDKs, GPU dependencies,
provider environment reads, or model calls. Preserve local PDF text extraction
and explicitly report OCR_REQUIRED for no-text PDFs. Preserve the profile
review and confirmation boundary. Keep simulation labels through review,
recovery, and confirmation; confirmation does not turn simulated data into AI
evidence. Missing facts remain empty, and confirmation remains explicit.
