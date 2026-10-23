---
name: Security scan evidence
description: Avoid false zero-finding reports when scanner response shapes or completion states differ.
---

Validate a scanner's actual result collection and completion state before reporting a pass. A missing expected findings property is not evidence of zero findings.

**Why:** The SAST callback returned `results` with an `incomplete` flag, rather than the `vulnerabilities` collection shown in the skill example. Defaulting the absent property to an empty array would silently produce an unsupported clean result.

**How to apply:** Inspect response keys and completion flags, count the actual findings array, and report incomplete/error/unrecognized results as unverified. A fulfilled callback alone does not prove a completed clean scan.
