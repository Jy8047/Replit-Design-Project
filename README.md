# PivotPath AI

**Navigate Change. Shape Your Future.**

An AI-powered career intelligence and future-readiness platform.

PivotPath AI is the fixed product name in every language. It connects a
user-confirmed profile to transparent skill matching, learning pathways, SDG
relevance notes, and estimate-based disruption scenarios.

| Language | Tagline | Product description |
|---|---|---|
| English | Navigate Change. Shape Your Future. | An AI-powered career intelligence and future-readiness platform. |
| 简体中文 | 洞见变化，规划未来。 | 一个以人工智能辅助职业匹配、技能差距分析和未来职业发展规划的平台。 |
| Bahasa Melayu | Kenali Perubahan, Rancang Masa Depan. | Platform kecerdasan kerjaya dan kesiapsiagaan masa depan yang dibantu oleh kecerdasan buatan. |

The description is product positioning, not a claim that the current demo runs
AI inference: matching is deterministic and rule-based, PDF mapping is explicitly
`simulated`, and no external AI model is called. The UI repeats this distinction.
There is no custom product-name editor. Existing profile, draft, language,
occupation and learning-progress storage keys are preserved; a legacy custom
title is ignored without automatically clearing browser data.

## Current implementation

- **Frontend:** React, TypeScript, and Vite.
- **API:** Express and TypeScript.
- **Profile storage:** confirmed profiles are stored in the browser; unconfirmed drafts use temporary browser storage.
- **PDF intake:** text is extracted locally by the app server from text-based PDF uploads. Scanned PDFs require OCR, which is not implemented.
- **PDF profile draft:** optional rule-based mapping copies explicitly labelled fields. It does not infer missing facts and is always marked `simulated`.
- **Career matching:** deterministic skill matching with transparent scores; scores are not hiring probabilities.
- **Trend records:** the checked-in demo dataset is synthetic/illustrative unless a row is independently verified and carries its source evidence.
- **Learning, SDG, and scenario views:** these are in-app recommendations, intended-contribution explanations, and scenario estimates—not measured impact or guaranteed predictions.

## External services and AI

This project does **not** use a GPU, RunPod, or GLM-5.3. There is no model client, model request, or RunPod SDK in the application. PDF text extraction and labelled rule simulation run without external model inference. Simulation output must not be presented as AI output.

The code does not read `RUNPOD_API_KEY`, `RUNPOD_LIVE_ENABLED`, or `RUNPOD_LOW_REASONING_SUPPORTED`. The Replit Secrets panel was not inspected and no secret was deleted. If an old `RUNPOD_API_KEY` secret remains, the project owner can remove it manually after confirming no other repl workflow needs it.

## Local commands

```sh
pnpm install
pnpm --filter @workspace/api-server test:cv
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/career-pathways test
pnpm --filter @workspace/career-pathways typecheck
BASE_PATH=/ pnpm --filter @workspace/career-pathways build
```

The official Tech Tools Declaration template was not present in this workspace. This README is project documentation, not a substitute for that official declaration; provide the required template before preparing one.

## Brand regression checks

The normal frontend test command includes `src/lib/brand.test.ts`. With the
existing web/API workflows running and local Chromium available, run:

```sh
node --experimental-strip-types artifacts/career-pathways/tests/brand.e2e.mjs
```

The browser check uses a separate temporary browser profile and fictional data:
three languages across eight routes, fixed branding and social metadata, removed
name-editing controls, online confirmation/cancellation, a genuine local PDF
extraction with simulated mapping, and matching/reload. It does not operate on
the user's browser storage, intercept a success response, or call an AI model.
