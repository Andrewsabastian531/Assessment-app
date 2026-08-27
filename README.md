# VedaAI

Grading a class set of exam papers takes a teacher hours. VedaAI does the first pass in
minutes and leaves the teacher in charge of the result.

A teacher uploads two files — the question paper and a student's answer sheet. The system
reads both, works out which scribble on the page answers which question, marks each answer
against the rubric, and returns a side-by-side review screen: the student's handwriting on
the right with each answer boxed in green, the marks and reasoning on the left. Every mark
can be changed by hand before it is finalised.

Nothing is graded silently. The AI proposes; the teacher decides.

---

## How it works

Six stages run in the background after the teacher presses **Start Mapping**. Each is a
separate queued job, so a failure in one retries on its own instead of restarting the lot.

| # | Stage | What happens |
|---|---|---|
| 1 | **Ingest** | The upload (PDF, JPG, PNG or HEIC) becomes one normalised PNG per page |
| 2 | **Question extraction** | A vision model reads the question paper into a rubric: questions, sub-questions, marks |
| 3 | **Layout analysis** | Each answer page is split into regions, marked as printed or handwriting, and transcribed |
| 4 | **Mapping** | Each answer region is paired with the question it answers |
| 5 | **Evaluation** | Every question is graded against the rubric — marks, verdict, step-by-step reasoning |
| 6 | **Aggregation** | Totals are computed and the paper is released for review |

Stages 3 and 5 fan out — one job per page, one job per question — and the pipeline waits for
all of them before continuing. The teacher watches this happen live; progress arrives over a
WebSocket rather than by polling.

### Matching answers to questions

This is the part that decides whether the whole thing works. It uses three signals, in
descending order of trust:

1. **A printed label.** If the model reads a "Q2" or "3." at the start of a region, that is
   near-decisive and nothing else needs to run.
2. **Meaning.** Otherwise the question and the answer are both turned into vectors and
   compared by cosine similarity. An answer about photosynthesis finds the photosynthesis
   question with no label in sight.
3. **Word overlap.** If the embedding service is unreachable, it compares words directly.
   Worse, but the pipeline degrades instead of failing.

Anything below the confidence threshold is left unmatched rather than guessed, and appears
in review as a question with no answer found.

### Grading

Each question is sent with its rubric, the transcribed answer, and a **cropped image of the
actual handwriting** — so diagrams and mathematical notation are judged from the page rather
than from a flattened transcription. The model returns marks, a verdict, per-step credit or
deductions, and a confidence score.

Awarded marks are clamped to the question maximum before they reach the database, because a
schema cannot express "no more than this question is worth". A mark the teacher has
overridden is never overwritten by a re-run.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | One install, one command, shared types across apps |
| Frontend | Next.js 15 (App Router), React 19 | Server components for the authenticated shell |
| Styling | Tailwind CSS v4 | Design tokens declared in CSS, no config file |
| UI | Radix primitives, Lucide icons | Accessible behaviour without adopting a whole design system |
| Data fetching | TanStack Query | Cache invalidation after a mark is overridden |
| Backend | NestJS 11 | Modules and dependency injection suit a pipeline this size |
| Queue | BullMQ + Redis | Retries, per-stage concurrency, fan-out and fan-in |
| Database | PostgreSQL + pgvector | Relational data and vector search in one place |
| ORM | Prisma | Typed queries and versioned migrations |
| Storage | Cloudflare R2 (MinIO locally) | S3 API, no egress fees |
| Realtime | Socket.io | Live progress during grading |
| Validation | Zod | One schema for the API, the client and the AI output |
| AI | Google Gemini (swappable) | Free tier, vision plus structured JSON output |

Two decisions worth explaining:

**Files never pass through the API.** The browser asks for a pre-signed URL and uploads
straight to object storage. An 8 MB scan routed through Node would block the event loop for
no benefit; the API only ever handles keys and metadata.

**One schema, three jobs.** Each Zod schema in `packages/shared` validates the HTTP request,
types the React component, *and* becomes the JSON Schema that constrains the model's output.
The client and server cannot drift, and a malformed AI response is caught at the boundary
instead of corrupting a row.

---

## Running it locally

### What you need

- **Node.js 20.11+**
- **pnpm 9** — `npm install -g pnpm@9`
- **Docker Desktop** — runs the database, queue and file storage

### Five steps

```bash
pnpm install
cp .env.example .env      # then set AUTH_SECRET and GOOGLE_AI_API_KEY
pnpm infra:up             # Postgres, Redis and MinIO in Docker
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Open **http://localhost:3000**. Sign in with the seeded account
`madhur@vedaai.test` / `vedaai123`, or create your own from the sign-up tab.

Two values in `.env` matter before you start:

- `AUTH_SECRET` — any random string. `openssl rand -base64 32` produces one.
- `GOOGLE_AI_API_KEY` — free from [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
  Everything up to page rasterisation works without it; grading does not.

Check the AI is reachable before uploading anything:

```bash
curl http://localhost:4000/api/v1/health/ai
```

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the web app and API together |
| `pnpm stop` | Stop them and free ports 3000 and 4000 |
| `pnpm build` | Build everything |
| `pnpm typecheck` | Type-check every package |
| `pnpm infra:up` / `infra:down` | Start / stop the Docker services |
| `pnpm infra:reset` | Stop and **delete all local data** |
| `pnpm db:migrate` | Apply schema changes |
| `pnpm db:seed` | Insert the demo teacher and exam |
| `pnpm db:studio` | Browse the database in a GUI |

Local ports are deliberately non-standard so they cannot collide with a Postgres or Redis
already installed on your machine: Postgres **5434**, Redis **6380**, MinIO **9002**
(console **9003**).

---

## Project structure

```
apps/
  web/                     Next.js frontend
    src/app/               routes (App Router)
    src/components/        shell, upload, mapping, viewer, ui primitives
    src/hooks/             upload and live-progress hooks
    src/lib/               API client, session, OAuth helpers
  api/                     NestJS backend
    src/modules/           auth, assessments, submissions, storage,
                           ai-engine, events, queue, prisma, health
    src/workers/           the six pipeline stages
packages/
  shared/                  Zod schemas and types used by both apps
  database/                Prisma schema, migrations, seed
  typescript-config/       shared tsconfig presets
```

### The AI layer is swappable

`AI_PROVIDER` selects between Google, Groq, OpenRouter, OpenCode Zen, OpenAI and Ollama.
Every model call goes through one interface, so changing provider is an environment change,
never a code change. The only hard requirements are **image input** and **structured JSON
output** — not every free model has both, which is why `/health/ai` exists.

### Staying inside a free-tier quota

The pipeline fans out, so a single paper can fire a dozen model requests within a few
seconds. Free tiers count requests per *minute*, which a burst like that exhausts almost
immediately. Two mechanisms keep it inside the budget:

**Rate limiting.** `AI_REQUESTS_PER_MINUTE` (default 12) spaces requests to one provider at
a fixed interval, regardless of how many workers are queued behind it. Concurrency alone
cannot do this — the quota is counted per account, not per worker.

**Failover.** `AI_FALLBACK_PROVIDERS` is an ordered list tried when the one before reports a
quota failure:

```bash
AI_PROVIDER="google"
AI_FALLBACK_PROVIDERS="openrouter"

# A fallback needs its own model ids - the primary's mean nothing elsewhere.
OPENROUTER_VISION_MODEL="dots-studio/dots-3-note-preview:free"
OPENROUTER_GRADING_MODEL="dots-studio/dots-3-note-preview:free"
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"
```

`GET /health/ai` reports which provider actually served, plus the whole chain, so a
silent failover is visible rather than guessed at.

Only a genuine rate limit triggers the switch. A malformed request fails on every provider,
so retrying it elsewhere would waste another quota for the same outcome.

When a provider does return 429, the app reads the retry hint it sends — Gemini's
`retryDelay`, or a `Retry-After` header — and parks that provider's queue for exactly that
long instead of guessing with exponential backoff.

If your quota is tight, lower `AI_REQUESTS_PER_MINUTE` and `WORKER_CONCURRENCY` together.
Grading takes longer but finishes rather than failing halfway.

> **Check a model can do the job before relying on it.** Most free models are text-only, and
> JSON-schema support varies even among the multimodal ones. A text-only model passes the
> health check — which only exercises embeddings — and then fails on the first page image.
> Point `AI_PROVIDER` at the candidate temporarily and run one real upload end to end.
>
> On OpenRouter, these free models were verified to handle an image *and* return
> schema-valid JSON: `dots-studio/dots-3-note-preview:free` and `openrouter/free`.

---

## API

Everything lives under `/api/v1`. All routes require a JWT except `/auth/*` and `/health*`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create an account |
| `POST` | `/auth/login` | Email and password, returns a JWT |
| `POST` | `/auth/oauth/exchange` | Verify a Google ID token, link or create the user |
| `GET` | `/auth/providers` | Which social logins this server can serve |
| `GET` | `/auth/me` | The signed-in teacher |
| `GET` `POST` | `/assessments` | List and create exams |
| `GET` | `/assessments/:id` | Exam detail and its files |
| `POST` | `/assessments/:id/uploads/presign` | Get a pre-signed upload URL |
| `POST` | `/assessments/:id/uploads/confirm` | Mark an upload complete |
| `DELETE` | `/assets/:id` | Remove an uploaded file |
| `POST` | `/assessments/:id/start-mapping` | Start the pipeline |
| `GET` | `/assessments/:id/questions` | The extracted rubric |
| `PATCH` | `/questions/:id` | Edit a question or its marks |
| `GET` | `/submissions/:id` | Everything the review screen needs |
| `GET` | `/submissions/:id/pages/:idx/url` | Signed URL for a page image |
| `PATCH` | `/evaluations/:id/override` | Change a mark by hand |
| `POST` | `/submissions/:id/finalize` | Lock the result |
| `GET` | `/health`, `/health/ai` | Database and AI reachability |

### WebSocket events

Namespace `/events`. Clients join `job:{jobId}` or `submission:{id}`.

| Event | When |
|---|---|
| `job.queued` | Pipeline accepted |
| `job.progress` | Stage advanced; carries an overall percentage |
| `page.rasterized` | A page image is ready |
| `extraction.completed` | Rubric extracted |
| `mapping.completed` | Answers paired with questions |
| `evaluation.question.completed` | One question graded |
| `job.completed` | Paper ready for review |
| `job.failed` | A stage exhausted its retries |

Payload shapes live in `packages/shared/src/events.ts`.

---

## Data model

```
School ─┬─ User ─── Assessment ─┬─ Asset ─── Submission ─┬─ SubmissionPage ─── AnswerRegion
        │                       │                        │                          │
        │                       ├─ Question ─┬─ RubricCriterion                     │
        │                       │            └─ sub-questions (self-relation)       │
        │                       └─ Job              Evaluation ─┬─ EvaluationStep ◄──┘
        └─ Override ◄───────────────────────────────────────────┘
```

`Question.embedding` and `AnswerRegion.embedding` are `vector(768)` columns backing the
semantic matching. Switching to an embedding model of a different width needs a migration.

Sign-up stores first name, last name, email, password hash and a school reference. School
names are matched case-insensitively, so two teachers at one school share a record instead
of creating duplicates.

### Authentication

Email and password, or Google.

The API issues a JWT and the web app stores it in an **httpOnly** cookie, so page scripts can
never read it. The browser sends it to the API automatically — `localhost:3000` and
`localhost:4000` are the same site, so the cookie crosses the port boundary. NestJS accepts
the token from that cookie or from an `Authorization: Bearer` header, which is why server
components, the browser and `curl` all pass through one guard.

For Google, the web app runs the authorization-code flow and the API **re-verifies the ID
token with Google** before trusting anything in it, including checking the token's audience
against the client ID. The `state` parameter is cookie-bound and compared on return. A Google
account whose verified email matches an existing password account is linked to it rather
than duplicated.

To enable it: create an OAuth client at
[console.cloud.google.com](https://console.cloud.google.com) → Credentials → OAuth client ID →
Web application, with redirect URI `http://localhost:3000/api/auth/google/callback`, then set
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Leave them blank and the button is hidden.

---

## Deploying

Everything below runs on a free plan. `render.yaml` provisions the API and Redis;
the rest is created by hand once.

| Piece | Host | Free plan |
|---|---|---|
| Web | Vercel | Hobby |
| API + workers | Render | Free web service |
| Redis | Render Key Value | Free, 25 MB, no persistence |
| Postgres | Neon | Free, includes `pgvector` |
| Storage | Cloudflare R2 | 10 GB, no egress charges |

### Two limits to accept before you start

**A free Render service sleeps after 15 minutes idle** and takes about 50 seconds to
wake. A grading job in flight stalls until something touches the service.
`.github/workflows/keepalive.yml` pings `/health` every 10 minutes to prevent it. The
free tier allows 750 instance-hours a month against 744 in a month, so exactly one
service can stay awake — do not run a second.

**Free Key Value has no persistence.** If Redis restarts mid-grading, queued jobs are
lost. Uploaded files and marks already written survive, in R2 and Postgres; re-run the
paper to finish it.

### 1. Postgres

Create a project at [neon.tech](https://neon.tech), then in the SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Copy both connection strings — the pooled one for `DATABASE_URL`, the direct one for
`DIRECT_URL`. Prisma Migrate issues DDL a pooler cannot proxy, so they must differ.

### 2. Storage

Either works. R2 is more generous but wants a card on file; Supabase Storage has a
1GB free tier and no card. The two need different addressing:

| | R2 | Supabase Storage |
|---|---|---|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | `https://<PROJECT>.supabase.co/storage/v1/s3` |
| `S3_REGION` | `auto` | the project's region, e.g. `ap-south-1` |
| `S3_FORCE_PATH_STYLE` | `false` | **`true`** |

Getting `S3_FORCE_PATH_STYLE` wrong is quiet: the pre-signed URL is generated happily
and the browser's upload then fails with a 404 or a signature mismatch.

Cloudflare dashboard → R2 → create bucket `vedaai-uploads`, then **Manage API Tokens**
→ Object Read & Write. You need `S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"`,
the key pair, and `S3_FORCE_PATH_STYLE=false`.

Add a CORS rule to the bucket or the browser upload is blocked. The web origin is not
known until step 4, so come back and fill it in:

```json
[{ "AllowedOrigins": ["https://your-app.vercel.app"],
   "AllowedMethods": ["PUT", "GET", "HEAD"],
   "AllowedHeaders": ["*"],
   "ExposeHeaders": ["ETag"] }]
```

### 3. API

Render → **New → Blueprint** → pick this repository. It reads `render.yaml` and creates
the web service and Redis. Fill in the variables marked `sync: false`: the two Neon
strings, the five R2 values, and `GOOGLE_AI_API_KEY`. Leave `CORS_ORIGINS` until step 4.

The build runs `migrate:deploy`, so the schema is applied on first deploy.

### 4. Web

Vercel → import the repository. It detects the monorepo; set **Root Directory** to
`apps/web`. Environment variables:

```
NEXT_PUBLIC_API_URL   https://vedaai-api.onrender.com
NEXT_PUBLIC_WS_URL    https://vedaai-api.onrender.com
COOKIE_SAMESITE       none
```

`COOKIE_SAMESITE=none` matters when the two apps are on different domains. Note what it
does and does not do: a cookie belongs to the domain that set it, so one issued by
`your-app.vercel.app` is **never** sent to `your-api.onrender.com`, whatever SameSite
says. SameSite governs cross-site requests *to the cookie's own domain*.

That is why browser traffic is relayed through this app rather than sent to the API
directly. The browser calls `/api/proxy/...` on its own origin, a route handler reads the
httpOnly cookie server-side and forwards the token as a bearer header. Same origin, so no
CORS and no cookie-domain problem.

Hosting both on one domain (`app.example.com` + `api.example.com`) removes the need for
the hop: set `COOKIE_DOMAIN=.example.com`, keep `COOKIE_SAMESITE=lax`, and the browser can
talk to the API directly.

### 5. Wire the three together

- Render → `CORS_ORIGINS` = your Vercel URL
- R2 → CORS `AllowedOrigins` = your Vercel URL
- GitHub → Settings → Secrets and variables → Actions → **Variables** → `API_URL` = your
  Render URL, which turns the keep-alive on
- Google OAuth (optional) → add `https://your-app.vercel.app/api/auth/google/callback`
  as an authorised redirect URI, and set the two client variables on Vercel

### 6. Check it

```bash
curl https://vedaai-api.onrender.com/api/v1/health      # {"status":"ok"}
curl https://vedaai-api.onrender.com/api/v1/health/ai   # {"ok":true,...}
```

Then sign up on the Vercel URL and grade one paper end to end. First request after a
quiet spell is slow while the instance wakes.

### Scaling past free

The first thing to outgrow is Render's sleep. A Starter instance removes it and the
keep-alive workflow. After that, run a second instance of the same image with the HTTP
listener disabled so workers scale separately from the API.

## Troubleshooting

**API exits with `P1001: Can't reach database server`.** Docker is not running. Start Docker
Desktop, then `pnpm infra:up`.

**`pnpm dev` fails with `EADDRINUSE`.** An earlier run was orphaned. `pnpm stop` finds the
processes on ports 3000 and 4000, walks up to the root of the run, and kills the whole tree.
Killing the port holder alone is not enough — it is a leaf, and its parent survives.

**Ctrl+C does not stop the servers.** Known on Windows terminals. `turbo.json` uses
`"ui": "stream"` to keep the signal working; if it still misbehaves, use `pnpm stop`.

**Web app returns 500 with `ENOENT ... _buildManifest.js.tmp`.** The `.next` folder is
corrupted, usually from running `pnpm build` while `pnpm dev` was live. Stop everything,
delete `apps/web/.next`, start again.

**`prisma generate` fails with `EPERM`.** The running API holds the query engine open and
Windows will not rename an open file. Run `pnpm stop` first. The build skips generation when
the schema is unchanged, so this only appears after an actual schema edit.

**Uploads fail with "blocked by CORS policy" but sign-in works.** Sign-in goes through
a Next route handler server-side, so it never touches CORS; the upload calls the API
straight from the browser and does. Set `CORS_ORIGINS` on the API to the exact web
origin — scheme included, no trailing slash, no path. `https://*.vercel.app` is accepted
to cover preview deployments. The API logs its allowed list at boot and warns with the
rejected origin on every blocked request, so the Render log will tell you what it saw.

**Render build fails with `nest: not found`, `dotenv: not found`, or a missing
`@vedaai/typescript-config`.** Render sets `NODE_ENV=production`, and pnpm then skips
devDependencies — which is where TypeScript, Prisma, the Nest CLI and the shared tsconfig
live. The build command passes `--prod=false` for exactly this reason; if you edited it,
put that back.

**Render build fails on `corepack enable` with `EROFS`.** `/usr/bin` is read-only there,
so corepack cannot install its shim. Use `npm install -g pnpm@<version>` instead.

**Grading fails but uploads work.** Check `GET /api/v1/health/ai` — usually a missing key, or
a model that does not accept images.

---

## Status

Working end to end: authentication, uploads, the full six-stage pipeline, live progress, and
the review screen with bounding boxes and manual overrides.

Not built yet: an exam list page (`/exams` opens the most recent exam), a rubric editor UI
(the endpoint exists), batch grading of a whole class, and automated tests.
