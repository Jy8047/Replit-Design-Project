# FuturePath AI

FuturePath AI is a multilingual career exploration demo. It connects a user-confirmed profile to transparent skill matching, learning pathways, SDG relevance notes, and estimate-based disruption scenarios.

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
pnpm --filter @workspace/career-pathways build
```

The official Tech Tools Declaration template was not present in this workspace. This README is project documentation, not a substitute for that official declaration; provide the required template before preparing one.
