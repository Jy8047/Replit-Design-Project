---
name: Career-planning evidence and service constraints
description: Standing evidence and service-consent requirements for the hackathon app
---

Keep illustrative trend records clearly synthetic until independently verified.
Do not invent sources or learning courses. Learning links require existence and
relevance checks; otherwise show an explicit unverified state without a link.
SDG alignments are intended contributions, not measured outcomes. Scenario
assumptions must remain inspectable and labelled estimates, not predictions.
Do not introduce paid services or API keys without the user's consent.

Occupational classification and competency evidence do not establish market
demand. Keep verification of an occupation–competency association separate from
trend verification. A neutral compatibility value must not become a claim that
demand is stable. Check actual skill-data availability; a taxonomy may list a
title without providing the competency ratings needed to support it.

**Why:** The team approved broader source-backed career coverage while explicitly
prohibiting unverified trend claims. Public O*NET tables can contain a valid
occupation title without the corresponding rated skill records.

**How to apply:** Verify each association against its source rows, distinguish
release dates from observation/check dates, and omit unsupported candidates
rather than borrowing a neighbouring occupation's skills.

## Employment history source boundary

Use BLS OEWS for historical employment estimates; the existing O*NET catalog
provides occupation codes and descriptions, not employment history. Do not
present O*NET competency data as a labor-market trend or forecast.

**Why:** The team chose BLS for historical employment and the local O*NET
catalog for occupation identity. The live BLS response still needs verification
before any chart is treated as available evidence.

**How to apply:** Match the BLS six-digit SOC series, disclose when an O*NET
sub-occupation is aggregated to that broader group, display source and refresh
time, and show an explicit unavailable state when BLS returns no validated
annual series.

## User-supplied employment series

A historical employment series without a verifiable source URL or publication
date may be displayed only as explicitly user-supplied and unverified, with its
geographic scope and missing years visible. Never mark it verified or imply that
the supplied attribution was independently confirmed.

**Why:** An uploaded file can contain plausible occupation values while lacking
the metadata needed to establish its origin or release date.

**How to apply:** Keep such rows out of verified-source states, preserve null
source/date fields instead of inventing them, and require explicit user approval
before showing the series.

**Why:** The user explicitly set these trust and consent requirements for the
SDC Hackathon Domain 1 application.

**How to apply:** Apply these constraints whenever extending trend data,
recommendations, learning resources, SDG mapping, scenarios, or integrations.

## Profile confirmation and draft privacy

Unconfirmed edits must not change the profile used by downstream modules.
Changing profile identity must not silently delete or hide employment information.
Draft recovery should remain temporary and local, without retaining PDF files.

**Why:** The user requires explicit review and confirmation, protection from lost
input, and no unnecessary exposure of personal information. Temporary tab-level
recovery was chosen rather than a new cloud service or a permanent draft archive.

**How to apply:** Preserve the last confirmed profile until a new confirmation
succeeds. Explain draft storage and provide discard controls. Require an explicit
choice when changing identity would exclude employment information.

## Human-readable profile review

Keep the user-facing confirmation summary in a modal over the editing form,
not a separate review screen or a JSON/TypeScript/debug display.

**Why:** The user explicitly requires a beginner-friendly, grouped review
before confirming, in English, Simplified Chinese and Bahasa Melayu.

**How to apply:** Reuse the existing dialog, show missing facts without
inference, and keep save errors visible even when a long summary is scrolled.
Preserve access to extracted CV text for manual checking, not raw profile JSON.
