# VedaAI — AI-Powered Exam Grading

Teachers upload a question paper and a student's answer sheet. The system extracts a
rubric, reads the handwriting, matches each answer to its question, grades against the
rubric, and hands back a side-by-side review screen with bounding boxes and per-question
marks the teacher can override.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web — Next.js 15 (App Router)                                  │
│  Tailwind v4 · shadcn-style primitives · Lucide · TanStack Query      │
│  PDF.js + canvas overlay · socket.io-client                          │
└───────────┬──────────────────────────────────────┬───────────────────┘
            │ REST /api/v1 (JWT bearer)            │ WebSocket /events
            ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│  apps/api — NestJS 11                                                │
│  AuthModule · AssessmentsModule · SubmissionsModule · StorageModule   │
│  AiEngineModule · EvaluationModule · EventsGateway · QueueModule      │
└───┬─────────────────┬──────────────────┬─────────────────────────────┘
    │                 │                  │
    ▼                 ▼                  ▼
┌─────────┐    ┌─────────────┐    ┌──────────────────┐
│ Postgres│    │ Redis       │    │ Cloudflare R2    │
│ pgvector│    │ BullMQ      │    │ (MinIO locally)  │
└─────────┘    └──────┬──────┘    └──────────────────┘
                      │
                      ▼  workers
   ingest → question-extraction ┐
          → layout-analysis ────┼→ mapping → evaluation → aggregation
                                ┘
```

The file bytes never pass through the API. The browser gets a pre-signed PUT URL and
uploads straight to object storage; the API only ever handles keys and metadata.

### Packages

| Path | Purpose |
|---|---|
| `apps/web` | Next.js frontend |
| `apps/api` | NestJS API + BullMQ pipeline workers |
| `packages/shared` | Zod schemas + TypeScript types shared by both apps. Single source of truth for API DTOs, VLM structured outputs and WebSocket payloads |
| `packages/database` | Prisma schema, generated client, migrations, seed |
| `packages/typescript-config` | Shared `tsconfig` presets |

---

## Local development

### Prerequisites

- **Node.js** ≥ 20.11 (this repo was set up on v24)
- **pnpm** 9 — `npm install -g pnpm@9`
  On Windows, make sure `%APPDATA%\npm` is on your `PATH`. `corepack enable` needs an
  admin shell because it writes into `C:\Program Files\nodejs`.
- **Docker Desktop** — for Postgres, Redis and MinIO

### 1. Install

```bash
pnpm install
cp .env.example .env
```

### 2. Start infrastructure — **Checkpoint B**

```bash
pnpm infra:up          # postgres(pgvector) + redis + minio, all on localhost
```

| Service | URL | Credentials |
|---|---|---|
| Postgres | `localhost:5434` | `vedaai` / `vedaai` |
| Redis | `localhost:6380` | — |
| MinIO API | `http://localhost:9002` | `vedaai` / `vedaai-secret` |
| MinIO console | `http://localhost:9003` | same |

> **Why non-default ports?** These are deliberately off the standard numbers. A
> native PostgreSQL Windows service commonly owns 5432 and wins the bind over
> Docker, which produces a confusing `P1000: Authentication failed` because
> Prisma is talking to the *other* Postgres. Using 5434/6380/9002 keeps VedaAI
> isolated from anything else already running on the machine.

The `pgvector/pgvector:pg16` image is required — the plain `postgres` image will fail the
migration because the schema declares `vector(768)` columns.

Prefer hosted? Swap `DATABASE_URL` for a **Supabase** or **Neon** connection string and
`REDIS_URL` for an **Upstash** one (note: Upstash needs `rediss://`, with two `s`). On a
pooled Postgres connection you must also set `DIRECT_URL` to the direct (non-pooled)
string — Prisma Migrate issues DDL that a connection pooler cannot proxy.

### 3. Migrate + seed

```bash
pnpm db:migrate        # creates the schema and the pgvector extension
pnpm db:seed           # Delhi Public School + Madhur Rastogi + a demo exam
pnpm db:studio         # optional: browse the data
```

Seeded login: `madhur@vedaai.test` / `vedaai123`

### 4. Run

```bash
pnpm dev               # turbo runs every app in parallel
```

- Web → http://localhost:3000
- API → http://localhost:4000

**UI-only preview.** Set `NEXT_PUBLIC_UI_PREVIEW=1` in `.env` to simulate uploads in the
browser and click through the screens with no API running. It defaults to `0` so a
misconfigured deploy fails loudly instead of faking success.

---

## Environment variables

Everything lives in one root `.env`; Turborepo passes it to both apps. See
[`.env.example`](.env.example) for the annotated version.

| Group | Keys |
|---|---|
| Database | `DATABASE_URL`, `DIRECT_URL` |
| Queue | `REDIS_URL`, `WORKER_CONCURRENCY` |
| Auth | `AUTH_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Storage | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_URL` |
| AI | `AI_PROVIDER`, `AI_VISION_MODEL`, `AI_GRADING_MODEL`, plus the provider key |
| Embeddings | `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` |
| Services | `API_PORT`, `WEB_PORT`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `CORS_ORIGINS` |

`AUTH_SECRET` must be **identical** for web and api — the API signs the JWT with it
and NestJS verifies it on every request. Generate one with `openssl rand -base64 32`.

### How auth works

**Email + password**

1. `/sign-in` posts to a Next route handler (`/api/auth/login` or `/api/auth/register`).
2. That handler calls the API, which validates with Zod, hashes with bcrypt, and
   returns a signed JWT.
3. The handler stores the JWT in an **httpOnly** cookie (`vedaai.token`) — it never
   reaches client JS, so an XSS cannot exfiltrate it.
4. The browser replays that cookie to the API automatically: `localhost:3000` and
   `localhost:4000` are the *same site* (ports do not create a new site), so a
   `SameSite=Lax` cookie crosses the port boundary.
5. NestJS's `JwtStrategy` accepts the token from the cookie **or** an
   `Authorization: Bearer` header, so server components, the browser and `curl`
   all pass through the same guard.

**Google OAuth**

`/api/auth/google/start` → Google consent → `/api/auth/google/callback`. The callback
exchanges the code for an ID token and posts it to the API, which **re-verifies it
with Google** before trusting any field. Two details that matter:

- `state` is stored in a short-lived httpOnly cookie and compared on return — this
  is what prevents login CSRF.
- The API checks the token's `aud` against `GOOGLE_CLIENT_ID`. Without that, a token
  minted for *any* Google app would be accepted.

The web app never decides who the user is; it only relays. A Google identity whose
verified email matches an existing password account is **linked** to it rather than
creating a second user.

With `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` unset, `GET /auth/providers` reports
`{"google": false}` and the button is not rendered at all.

Setup: console.cloud.google.com → APIs & Services → Credentials → Create OAuth client
ID → Web application, with authorised redirect URI
`http://localhost:3000/api/auth/google/callback`.

### User table

Sign-up collects exactly these fields:

| Column | Notes |
|---|---|
| `firstName` | The greeting uses this alone ("Welcome back, Priya") |
| `lastName` | Separate so users can be sorted and searched by surname |
| `email` | Unique, lower-cased on write |
| `passwordHash` | bcrypt; **null** for OAuth-only accounts |
| `schoolId` | FK to `schools`, resolved from the school name typed at sign-up |
| `role` | `TEACHER` or `ADMIN` |
| `avatarUrl` | Taken from the Google profile picture when present |

School names are matched **case-insensitively**, so "Delhi Public School" and
"delhi public school" resolve to the same `schools` row instead of duplicating it.

### Cloudflare R2 (production storage)

1. Cloudflare dashboard → **R2** → create bucket `vedaai-uploads`
2. **Manage API Tokens** → create a token with *Object Read & Write*
3. Fill in the R2 block in `.env` (the commented section)
4. Add a CORS policy to the bucket, or the browser's direct PUT is blocked:

```json
[{ "AllowedOrigins": ["http://localhost:3000"],
   "AllowedMethods": ["PUT", "GET", "HEAD"],
   "AllowedHeaders": ["*"],
   "ExposeHeaders": ["ETag"] }]
```

---

## API routes

All under `/api/v1`, all JWT-guarded except `/auth/*` and `/health*`. Request and
response shapes are the Zod schemas in `packages/shared`, so the client and server
cannot drift.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/login` | Email + password → JWT |
| `POST` | `/auth/register` | Create teacher account (first/last name, school, email) |
| `POST` | `/auth/oauth/exchange` | Verify a provider ID token, link or create the user |
| `GET` | `/auth/providers` | Which social providers this server can serve |
| `GET` | `/auth/me` | Current session user |
| `GET` | `/assessments` | List exams |
| `POST` | `/assessments` | Create exam |
| `GET` | `/assessments/:id` | Exam detail + assets |
| `POST` | `/assessments/:id/uploads/presign` | Pre-signed PUT URL |
| `POST` | `/assessments/:id/uploads/confirm` | Mark asset uploaded |
| `DELETE` | `/assets/:id` | Remove a file chip |
| `POST` | `/assessments/:id/start-mapping` | Enqueue the pipeline → `{ jobId, submissionId }` |
| `GET` | `/assessments/:id/questions` | Extracted rubric |
| `PATCH` | `/questions/:id` | Edit a question / its marks |
| `GET` | `/submissions/:id` | Full review payload (questions + pages + regions + evaluations) |
| `GET` | `/submissions/:id/pages/:idx/url` | Signed GET for a page image |
| `PATCH` | `/evaluations/:id/override` | Manual mark override |
| `POST` | `/submissions/:id/finalize` | Lock the result |

## WebSocket events

Namespace `/events`. Rooms: `job:{jobId}` and `submission:{submissionId}`.
Payload types live in [`packages/shared/src/events.ts`](packages/shared/src/events.ts).

**Client → server**

| Event | Payload |
|---|---|
| `subscribe.job` | `{ jobId }` |
| `subscribe.submission` | `{ submissionId }` |
| `unsubscribe` | `{ room }` |

**Server → client**

| Event | Payload |
|---|---|
| `job.queued` | `{ jobId, submissionId, assessmentId, status }` |
| `job.progress` | `{ jobId, stage, current, total, percent, message }` |
| `page.rasterized` | `{ jobId, submissionId, pageIndex, totalPages }` |
| `extraction.completed` | `{ jobId, assessmentId, questionCount }` |
| `mapping.completed` | `{ jobId, submissionId, matched, unmatched }` |
| `evaluation.question.completed` | `{ jobId, submissionId, questionId, questionLabel, awardedMarks, maxMarks, verdict }` |
| `job.completed` | `{ jobId, submissionId, assessmentId, totalAwarded, totalMax, durationMs }` |
| `job.failed` | `{ jobId, submissionId, stage, error, retryable }` |

---

## Data model

Full schema: [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma)

```
School ─┬─ User ─── Assessment ─┬─ Asset ─── Submission ─┬─ SubmissionPage ─── AnswerRegion
        │                       │                        │                          │
        │                       ├─ Question ─┬─ RubricCriterion                     │
        │                       │            └─ (self-relation: sub-questions)      │
        │                       │                                                    │
        │                       └─ Job              Evaluation ─┬─ EvaluationStep ◄──┘
        └─ Override ◄───────────────────────────────────────────┘
```

Two `vector(384)` columns (`Question.embedding`, `AnswerRegion.embedding`) back the
semantic question ⇄ answer matching. The dimension is fixed by the embedding model —
changing `EMBEDDING_MODEL` to one with a different width requires a migration.

---

## Design system

Tokens are defined CSS-first in [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css)
under `@theme`, so every token is automatically a Tailwind utility.

| Token | Value | Used for |
|---|---|---|
| `brand-500` | `#f26522` | Headline accent, upload labels, sparkles, badges |
| `brand-100` | `#ffede4` | Illustration rings, AI feedback panel |
| `ink-900` | `#111214` | Headlines, primary pill, body |
| `ink-600` | `#6b7280` | Subtitles, inactive nav |
| `ink-200` | `#e5e7eb` | Borders |
| `success-600` | `#16a34a` | Full-score pills, bounding boxes |
| `danger-600` | `#dc2626` | PDF badge, errors |

Shell metrics: sidebar `232px` expanded / `64px` rail, topbar `56px`.
Type: Inter via `next/font`, H1 `38px/700` desktop and `22px/700` mobile.

> Values were read from the exported Figma PNGs. Share the Figma file or dev-mode tokens
> and these get replaced with exact values in one pass.

---

## Project status

### Done — the full pipeline runs end to end

- [x] Turborepo + pnpm workspaces, shared tsconfig presets, Prettier
- [x] `packages/shared` — Zod contracts for REST DTOs, VLM outputs, WS events
- [x] `packages/database` — Prisma schema (14 models, pgvector 768-dim), migration applied, seed
- [x] `docker-compose` — Postgres(pgvector) + Redis + MinIO on dedicated ports
- [x] Design token layer + app shell (sidebar, 64px icon rail, topbar, mobile drawer)
- [x] **Screen 1 & 2** — upload empty/filled, drag-drop, validation, progress, remove
- [x] **Screen 3** — extracting, collapsed rail, live WebSocket progress
- [x] **Screen 4** — question ⇄ answer review: split pane, green bounding-box canvas
      overlay, AI feedback panel, step deductions, manual override, finalise
- [x] Auth — sign-in page, httpOnly cookie session, global `JwtAuthGuard`
- [x] `StorageModule` — pre-signed PUT/GET, verified round-trip against MinIO
- [x] `AssessmentsModule` / `SubmissionsModule` — CRUD, asset lifecycle, rubric edit,
      override audit trail, finalise
- [x] `QueueModule` — 6 BullMQ queues wired as a FlowProducer graph with fan-out/fan-in
- [x] `AiEngineModule` — provider-agnostic adapter (Google / OpenRouter / OpenCode Zen /
      OpenAI / Ollama), Gemini-safe structured output, image rasterisation and region
      cropping, hybrid label+embedding+lexical mapping
- [x] `EventsGateway` — typed Socket.io emitters, weighted cross-stage progress
- [x] Terminal-failure reporting on every stage, so a dead job surfaces in the UI
      instead of leaving the extracting screen spinning

### Verified manually

| Check | Result |
|---|---|
| `POST /auth/login` → JWT + session user | ✅ |
| Unauthenticated `GET /assessments` | ✅ 401 |
| Pre-sign → browser PUT → confirm → object in MinIO | ✅ |
| `POST /start-mapping` → ingest → rasterise → page row → flow fan-out | ✅ |
| Sign-in sets httpOnly cookie; API accepts it cross-port | ✅ |
| pgvector extension + both `vector(768)` columns | ✅ |

### Next

- [ ] Exam list page (`/exams` currently redirects to the most recent exam)
- [ ] Rubric editor UI (the `PATCH /questions/:id` endpoint exists and works)
- [ ] Google OAuth provider on the sign-in page
- [ ] Split workers into their own process for horizontal scaling
- [ ] Tests: Zod contract round-trips, upload flow, grading determinism

### Open item

- **`GOOGLE_AI_API_KEY` is required** before a grading job can complete. Everything
  up to and including page rasterisation runs without it; the AI stages fail with a
  clear message. Check status with `GET /api/v1/health/ai`.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run every app in dev mode |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | Lint everything |
| `pnpm format` | Prettier write |
| `pnpm infra:up` / `infra:down` | Start / stop Docker services |
| `pnpm infra:reset` | Stop and **delete all local data volumes** |
| `pnpm db:migrate` | Create + apply a migration |
| `pnpm db:push` | Push schema without a migration (prototyping) |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Prisma Studio |

### Health checks

```bash
curl http://localhost:4000/api/v1/health      # database connectivity
curl http://localhost:4000/api/v1/health/ai   # confirms the AI key + model work
```

### Troubleshooting

**Port already in use / stale server.** Restarting a dev server without killing the
old one leaves the old code serving. On Windows:

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**`P1000: Authentication failed`.** Something other than the VedaAI container is
answering on the Postgres port — usually a native PostgreSQL Windows service. Check
with `Get-NetTCPConnection -LocalPort 5434 -State Listen`.
