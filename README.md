# PivotPath AI

**Navigate Change. Shape Your Future.**

An evidence-aware career-readiness prototype that helps students and career
changers explore skill overlap, learning resources, and scenario-based
interpretations using a user-confirmed profile.

PivotPath AI is the fixed product name in every language. The tagline and
product description below are positioning; the current prototype does not call
an external AI model.

| Language | Tagline | Product description |
|---|---|---|
| English | Navigate Change. Shape Your Future. | An AI-powered career intelligence and future-readiness platform. |
| 简体中文 | 洞见变化，规划未来。 | 一个以人工智能辅助职业匹配、技能差距分析和未来职业发展规划的平台。 |
| Bahasa Melayu | Kenali Perubahan, Rancang Masa Depan. | Platform kecerdasan kerjaya dan kesiapsiagaan masa depan yang dibantu oleh kecerdasan buatan. |

## Team information

| Field | Verified information |
|---|---|
| Team | Fresh team |
| Hackathon domain | Domain 1 |
| SDG tracks stated in the supplied proposal | SDG 4, SDG 8, SDG 10 |
| University | Xiamen University Malaysia |
| Team size | 5 |

The supplied presentation lists Chen Yang, Jiang Yue, Yan Zimeng, Gao Jingyi,
and Chen Yike. The technical declaration identifies Chen Yang as team leader.
Individual roles and public member handles are not stated in the supplied
materials.

## Links

| Resource | Link / status |
|---|---|
| GitHub repository | [https://github.com/Jy8047/Replit-Design-Project.git](https://github.com/Jy8047/Replit-Design-Project.git)  |
| Replit Project | [https://replit-design-project--Lilya8047.replit.app](https://replit-design-project--Lilya8047.replit.app)  |
| **Live Demo** | [https://youtu.be/PmRa8RllxrA?feature=shared](https://youtu.be/PmRa8RllxrA?feature=shared) |
| RunPod Endpoint | **Not applied** |
| Slide Deck | [Google Slides](https://docs.google.com/presentation/d/1trne_SWzpuSYvcBpnVeVZkT75rpnpiNO/edit?usp=drive_link&ouid=106855909570867161658&rtpof=true&sd=true) — exact supplied URL; an original PPTX is also included in `submission/`. Link access was not verified. |
| **Demo Video** | [https://youtu.be/7KzkwWIodYs?si=kC8E2wW8Dthg8p8v](https://youtu.be/7KzkwWIodYs?si=kC8E2wW8Dthg8p8v) |

## Overview

### Problem

Students and career changers may have difficulty translating their education,
experience, and current skills into concrete career options and next learning
steps. This prototype is intended to make that exploration more transparent
and available in English, Simplified Chinese, and Bahasa Melayu.

### Solution

The app connects a user-confirmed profile to deterministic skill-overlap
matching, visible skill gaps, a static learning roadmap, explanatory SDG
contribution notes, and selectable disruption scenarios. Results are guidance
and estimates, not hiring probabilities, measured impact, or guaranteed
forecasts.

### Key features

- **Profile intake:** online form or PDF upload; users review and explicitly
  confirm before a profile becomes available to matching.
- **PDF text extraction:** the Express API extracts text from supported
  text-based PDFs using `pdf-parse`. It does not perform OCR; scanned or
  image-only PDFs need manual entry.
- **Rule-based profile mapping:** the CV mapper uses a static vocabulary and
  heuristics. Mapping output is marked `simulated`; no LLM is called and
  missing facts must be reviewed or supplied by the user.
- **Career matches:** a deterministic weighted skill-overlap score, with
  matched and missing skills. The score is not an employment probability.
- **Skills and learning:** four-dimension skill visualizations, static learning
  resources, and roadmap progress stored in the browser.
- **Scenarios and SDGs:** scenario outputs are estimates; SDG links describe
  intended contribution, not measured real-world impact.

## Actual technology and data

| Layer | Technology / source | Current use |
|---|---|---|
| Frontend | React 19.1.0, TypeScript 5.9.3, Vite 7.3.7 | Main web application |
| UI and routing | Tailwind CSS 4.3.3, Wouter 3.13.0, Radix UI, Lucide | Styling, routes, controls, icons |
| Charts | Recharts 2.15.4 | Skills, role, and scenario visualizations |
| API | Node.js 24.22.1, Express 5.3.0, Pino 9.14.0 | Internal API and structured logging |
| PDF text | `pdf-parse` 2.4.5 | Local text extraction in the API worker; no OCR |
| Occupation data | O*NET 31.0 subset, CC BY 4.0 | Static occupation/competency data; PivotPath AI adaptations are not endorsed by USDOL/ETA. See [`artifacts/career-pathways/public/data/README.md`](artifacts/career-pathways/public/data/README.md) and [`docs/occupation-expansion.md`](docs/occupation-expansion.md). |
| Demonstration data | `skills-occupations.csv`, scenario JSON, static learning catalog | Synthetic examples and authored estimates; not independently verified labor-market findings |
| Live public data | World Bank Open Data API; BLS Public API v1 | World Bank supplies a global unemployment macro indicator only. BLS is queried for occupation history when requested; neither feed drives the skill-match score. |
| Browser storage | `localStorage` and `sessionStorage` | Confirmed profile, preferences/progress, and temporary drafts; data is browser/device-local |
| Database | No active application database connection | A workspace DB/Drizzle package exists as scaffolding but is not wired into these app flows. |
| Authentication | None in the application | No login or user account is required. |
| Model / GPU | None | No live LLM, GLM-5.3, GPU, or RunPod request. RunPod status: **Not applied**. |
| Planned API | Remotive | A URL is listed as reference metadata in `workforce-scenarios.json`; runtime code does not call it. |
| Package manager | pnpm 10.26.1 | Workspace scripts and package management |

### Data and evidence notes

- `official-occupations.csv` contains a reviewed O*NET 31.0 subset (48
  classifications and 473 competency associations). Its metadata says no demand
  trend has been verified; compatibility `stable` values must not be described
  as measured market stability.
- `skills-occupations.csv` contains synthetic demonstration records. Their
  trend directions are not labor-market evidence.
- `bls-oews-history.json` is marked `user-supplied-unverified`, has no verified
  direct source URL or publication date, and must not be represented as
  independently verified BLS data. The client accepts only matching verified
  BLS records as an archive fallback.
- The World Bank request is for the global unemployment indicator
  `SL.UEM.TOTL.ZS`; the UI labels it as macro context, not occupation growth.
- BLS connectivity is not guaranteed. The app retries the public request and
  only uses a verified matching BLS archive as fallback; a successful live
  response was not verified during this submission preparation.
- Scenario data is local and illustrative. The Remotive reference URL in that
  file is not fetched by the application.
- Learning resources are static links in the repository, not courses generated
  or fetched by an AI service.

## Project structure

```text
.
├── artifacts/
│   ├── career-pathways/          # React + Vite application and static data
│   ├── api-server/               # Express API, PDF extraction, BLS proxy
│   ├── mockup-sandbox/           # Component preview utility
│   └── pivotpath-submission-deck/ # Separate editable import of the supplied 8-slide PPTX
├── docs/                         # Profile, security, and data-source handoffs
├── lib/                          # Shared API packages and unused DB scaffolding
├── scripts/                      # Workspace maintenance scripts
├── submission/                   # Preserved submission-document copies
├── attached_assets/               # Supplied files and retained PPTX import staging
├── .replit                        # Replit workflows and deployment configuration
├── pnpm-workspace.yaml
└── README.md
```

The submission deck artifact is a separate editable copy. The original PPTX in
`submission/` and `attached_assets/` is unchanged.

## Architecture

```text
Browser (React/Vite)
  ├─ confirmed profile, draft, preferences and roadmap progress → browser storage
  ├─ PDF bytes + explicit consent → this project's POST /api/profile/extract-pdf
  │    └─ Express → local pdf-parse worker → extracted text + simulated draft
  ├─ occupation history → this project's GET /api/occupations/history
  │    └─ Express → public BLS v1 API (only when a role is selected)
  └─ global unemployment context → World Bank Open Data API (browser request)
```

PDF data is processed by this project's API for text extraction; the route does
not persist the uploaded PDF or raw extracted text. User profile and roadmap
state remain in browser storage. There is no server-side profile database. BLS
and World Bank requests are public-data calls; no user profile fields are sent
to those providers by these flows.

## How to run

Use the existing workspace scripts. In Replit, `.replit` configures the web
workflow at port `24958` with `BASE_PATH=/` and the API workflow at port `8080`.
For local development, run the API and web app in separate terminals:

```sh
pnpm install

# Terminal 1 — API (development script builds, then starts the API)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — web application
PORT=24958 BASE_PATH=/ pnpm --filter @workspace/career-pathways run dev
```

Validation commands:

```sh
pnpm --filter @workspace/career-pathways test
pnpm --filter @workspace/career-pathways typecheck
BASE_PATH=/ pnpm --filter @workspace/career-pathways build

pnpm --filter @workspace/api-server run test:cv
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run build

pnpm run typecheck
pnpm --filter @workspace/pivotpath-submission-deck run validate-slides
```

The frontend unit tests use Node's built-in `node:test`; API CV tests use
`tsx --test`. Browser E2E scripts are separate `.mjs` files and require the
existing web/API workflows and local Chromium/CDP.

## How we use Replit

Replit is the development environment for this TypeScript workspace. The
provided Replit Proof of Use document contains workspace usage screenshots,
and `.replit` defines the app and API workflows. The supplied prototype URL
returned an HTTP 200 HTML shell during this preparation, but a visual browser
check could not be completed; this README does not claim that a deployment was
fully verified. The Proof of Use screenshots contain account-level usage
details; review their privacy before sharing them publicly.

## How we use RunPod

**Not applied.** This project has no configured RunPod endpoint, handler, GPU
inference flow, or RunPod proof-of-use document.

## Challenges & learnings

- PDF text extraction is not OCR; image-only/scanned PDFs cannot be mapped by
  the current extraction path.
- Matching and profile mapping must be described separately: the score is a
  deterministic rule-based overlap, while PDF mapping is simulated.
- Public macro indicators and occupation history are not interchangeable with
  verified skill-demand evidence.
- Browser storage is convenient for a prototype but does not synchronize
  profiles or progress across devices.
- The official Tech Tools Declaration needs reconciliation with current code:
  its API section says “None,” while the app currently requests World Bank and
  BLS public data. Preserve the submitted PDF and update it only through the
  official form and authorized team review.
- The supplied presentation contains claims about AI evaluation, CV formats,
  job outcomes/salary information, forecasts, a Rotary Club partnership, and
  “GLM-5.3 / RunPod.” These claims were not independently verified against
  current code. RunPod status in this README remains **Not applied**.

## Future improvements

- Reconcile the Tech Tools Declaration, preliminary proposal, and presentation
  with the current implementation before final judging.
- Independently verify or replace the user-supplied occupation-history archive.
- Confirm public access and synchronization for the GitHub repository and
  demo video links.
- Consider OCR or a live model only after the team chooses and declares a
  supported, authorized implementation.
- Add server-side persistence only if the team needs cross-device profiles and
  has approved the associated privacy and security design.

## Team

| Name | Role information in supplied materials |
|---|---|
| Chen Yang | Team leader |
| Jiang Yue | Not specified |
| Yan Zimeng | Not specified |
| Gao Jingyi | Not specified |
| Chen Yike | Not specified |

No public GitHub handles or individual roles beyond the team leader were
provided in the supplied submission files.

## License

No project-wide `LICENSE` file is present. Do not infer a project license from
the licenses of individual dependencies. O*NET attribution and license details
are recorded in the data README linked above.

## Submission checklist

- [x] Project overview, actual architecture, current tech stack, and run/test commands documented.
- [x] The [Replit Proof of Use](submission/SDC2026_Freshteam_Replit_POU.pdf) keeps the imported PDF bytes unchanged under the requested local filename. The Technical Declaration and [Preliminary PDF](submission/SDC2026_Fresh_team_preliminary_1792868544917.pdf) remain unchanged; the Preliminary matches its supplied attachment byte-for-byte.
- [ ] The specified Drive replacement sources for the Technical Declaration, Replit Proof of Use, and Preliminary redirect to Google sign-in. Their Drive file types and identities could not be confirmed; see [`submission/README.md`](submission/README.md). No replacement was made.
- [x] The previously supplied video URL and the **Demo Video** URL are listed exactly as supplied; the Slide Deck URL is also unchanged.
- [x] RunPod Endpoint status is **Not applied**.
- [ ] Update the official Tech Tools Declaration to disclose current BLS and World Bank API calls and reconcile other differences; do not alter its signature or date without the team.
- [ ] Review the preliminary PDF and presentation claims against current behavior before final submission.
- [ ] Confirm public GitHub access/synchronization and demo video link access.
