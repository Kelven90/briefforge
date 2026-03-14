## BriefForge

BriefForge is an AI-native workspace that turns messy client materials into grounded, reviewable project briefs.

It is designed as a **portfolio-grade system** for agencies, solutions engineers, and creator-tool teams: uploads are indexed asynchronously, questions are answered with citations, briefs are structured and schema-validated, and the system tracks jobs, latency, and token usage.

### Why this project exists

- **Problem**: Teams work from kickoff transcripts, PDFs, brand guides, FAQs, and shifting requirements. Synthesis is manual, easy to miss, and hard to review.
- **Goal**: Provide a workspace where you can drop messy sources, ask grounded questions, and generate structured briefs that are backed by evidence.
- **Design stance**: Outputs are *untrusted* until validated. Everything important is structured (jobs, briefs, evals, usage), not freeform blobs.

### High-level architecture

At a glance:

- **Next.js App Router (TypeScript, Tailwind)**  
  - Auth (Auth.js / NextAuth)  
  - Dashboard UI (workspaces, sources, QA, briefs, jobs)  
  - REST API/BFF for QA, briefs, evals, and usage
- **Postgres + pgvector (via Supabase layout)**  
  - `workspaces`, `sources`, `chunks`, `briefs`, `answer_runs`, `jobs`, `evaluations`
  - `chunks.embedding` stores pgvector embeddings for retrieval
- **Redis + BullMQ**  
  - `indexing-jobs` queue for parse → chunk → embed → reindex flows
- **Python indexing worker (Pydantic, psycopg, OpenAI)**  
  - Consumes jobs, parses files, chunks content, and writes embeddings
- **OpenAI**  
  - Embeddings for retrieval  
  - Chat models for grounded QA and structured brief generation
- **Shared packages**  
  - `@briefforge/core`: Zod schemas and shared types  
  - `@briefforge/prompts`: versioned prompts with strict output contracts  
  - `@briefforge/observability`: logger utilities (Pino-based)

For more architectural detail, see `docs/architecture.md`.

### Core workflow

1. **Upload sources**  
   - User uploads files into a workspace (kickoff transcript, brand guide, FAQ, etc.).  
   - The API writes a `sources` row and enqueues a `parse` job in `jobs`.

2. **Async indexing**  
   - The Python worker polls `jobs` and processes:
     - `parse`: read and normalize file text, mark source as `parsing`, enqueue `chunk`.
     - `chunk`: split into overlapping chunks, insert into `chunks`, enqueue `embed`.
     - `embed`: call OpenAI embeddings, update `chunks.embedding`, mark source as `indexed`.

3. **Grounded Q&A with citations**  
   - `/api/qa/ask`:
     - Uses pgvector to retrieve top‑k chunks for the workspace and question.
     - Calls an OpenAI chat model with a **JSON-only, citation-aware** prompt.
     - Validates the answer JSON with Zod and stores an `answer_runs` row (question, answer, citations, latency, token usage, estimated cost).

4. **Structured brief generation**  
   - `/api/briefs/generate`:
     - Retrieves a broader context set via pgvector.
     - Uses a prompt that must return JSON matching `BriefContent` (project name, goals, deliverables, constraints, etc.), with citations per section.
     - Validates against `BriefContentSchema` and writes a versioned `briefs` row.

5. **Review and iterate**  
   - Dashboard UI shows:
     - Workspaces (including the seeded “Acme Creator Launch”).  
     - Sources and their indexing status / trust level.  
     - Recent jobs (parse/chunk/embed) for quick indexing visibility.  
     - Grounded QA with evidence chips.  
     - Structured brief with per-section citation counts.

### Local development

#### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)
- Python 3.11+ (if running the worker locally outside Docker)

#### 1. Clone and install

```bash
git clone git@github.com:Kelven90/briefforge.git
cd briefforge

pnpm install
```

#### 2. Environment variables

Copy the example env file and fill in the required values:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Required for local dev:

- `DATABASE_URL` – local Postgres instance (docker-compose uses `briefforge` DB by default).
- `REDIS_URL` – Redis connection string.
- `OPENAI_API_KEY` – for embeddings and chat completion.
  - Set `BRIEFFORGE_DISABLE_LLM=1` during UI/dev work to avoid calling OpenAI; the app will return stubbed, obviously marked responses using real chunks but no model calls.

Optional but recommended:

- `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`, `OPENAI_STRICT_MODEL`
- `AUTH_SECRET` (for NextAuth)

#### 3. Start infrastructure (Postgres + Redis + services)

```bash
docker compose up -d db redis
```

Run initial migration and seed via Supabase CLI or psql:

```bash
# Apply schema
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql

# Seed demo user + workspace
psql "$DATABASE_URL" -f supabase/seed.sql
```

Then, in separate terminals:

```bash
# Web app
pnpm dev --filter @briefforge/web

# Indexing worker (Python)
cd services/indexing-worker
python -m src.main
```

The web app will be available at `http://localhost:3000`.

**Note:** If you run the app on a different port or host, set `NEXTAUTH_URL` (e.g. `http://localhost:3001`) so sign-in and callbacks work. If port 3000 is already in use, stop the other process or set the port when starting (e.g. `PORT=3001 pnpm dev --filter @briefforge/web`).

#### 4. Run CI locally (before pushing)

You can run the same steps as GitHub Actions locally so you don’t have to push to see if CI passes.

**Quick check before every push:** from repo root run `pnpm install --frozen-lockfile` then `pnpm check`. If both succeed, the first CI job (lint, typecheck, build) will pass.

**Step 1 – Same as CI job 1 (lint, typecheck, build)**

From the repo root:

```bash
pnpm install --frozen-lockfile
pnpm check
```

If both commands succeed, the first CI job would pass. Run this whenever you change code and before you push.

**Step 2 – Optional: same as CI evals job**

Only needed if you want to run the evals (QA + brief) that CI runs. You need Postgres and Redis and the app running.

1. **Start Postgres and Redis** (if not already running):
   ```bash
   docker compose up -d db redis
   ```

2. **Set env**  
   Ensure `.env` (or `apps/web/.env.local`) has `DATABASE_URL` and `REDIS_URL` (e.g. `postgresql://postgres:postgres@localhost:5432/briefforge` and `redis://localhost:6379`).

3. **Migrate and seed** (from repo root):
   ```bash
   pnpm exec tsx infra/scripts/migrate.ts
   psql "$DATABASE_URL" -f supabase/seed.sql
   pnpm seed
   ```
   On Windows PowerShell, for the seed SQL use:  
   `Get-Content -Raw supabase/seed.sql | psql $env:DATABASE_URL`  
   if `psql` is in your path, or run the SQL via another tool. Then run `pnpm seed`.

4. **Start the app**  
   In one terminal:
   ```bash
   pnpm --filter @briefforge/web start
   ```
   Wait until you see the app listening (e.g. on port 3000).

5. **Run evals**  
   In a second terminal (from repo root):
   ```bash
   pnpm evals
   ```

If step 1 passes and (optionally) step 2 passes, your push should pass CI.

**Alternative: run the whole workflow with act**

If you have [act](https://github.com/nektos/act) and Docker, you can run the full workflow locally:

```bash
act push
```

or `act pull_request`. This uses the same `.github/workflows/ci.yml` and service containers.

#### 5. Demo flow

The intended recruiter/demo flow:

1. Navigate to `http://localhost:3000`.
2. Click **“Sign in as demo”** and enter access code `demo`.
3. On the dashboard, open the **“Acme Creator Launch”** workspace.
4. Review seeded sources and their indexing status.
5. Ask a grounded question (e.g. “What constraints does Acme have around launch timelines?”) and inspect the answer + citations.
6. Click **“Generate brief”** to see structured sections (goals, deliverables, constraints, risks, open questions) with citation counts.

### Before pushing to GitHub

- **Secrets:** Never commit `.env`, `apps/web/.env.local`, or any file containing real keys or passwords. They are listed in `.gitignore`; only `.env.example` and `apps/web/.env.example` (templates) are tracked.
- **If you already committed secrets:** Remove them from history before pushing. From the repo root run:
  `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env apps/web/.env.local" --prune-empty HEAD`
  Then **rotate any exposed keys** (new AUTH_SECRET, new OPENAI_API_KEY, etc.).

### Testing & quality

Planned (and partially scaffolded):

- **Unit tests** via Vitest for core libraries (`@briefforge/core`, prompts, retrieval).
- **E2E/smoke tests** via Playwright for the main demo flow (sign in → open workspace → ask question → generate brief).
- **Eval harness** (`packages/evals`) to run seeded QA and brief evaluations:
  - Citation coverage for QA answers (each golden question expects a minimum number of citations).
  - Schema compliance and citation presence for briefs (sections must validate against `BriefContent` and carry citations).
  - Regression-friendly aggregate metrics (how many cases passed, and average latency).

#### Quality & evals

- `pnpm evals` runs both:
  - **QA evals**: calls the live `/api/qa/ask` endpoint against a small golden dataset for the Acme workspace and checks citation coverage + latency.
  - **Brief evals**: calls `/api/briefs/generate` and validates that the returned JSON matches `BriefContent` and that multiple sections include citations.
- Evals call the same endpoints the UI uses, so they exercise:
  - Retrieval (pgvector queries over `chunks.embedding`).
  - Prompting and schema validation.
  - Answer/brief recording into `answer_runs` and `briefs`.


### Key design decisions

- **pgvector over external vector DB**  
  Local-first, simple, and good enough for single-node deployments. Documented in `docs/decisions/001-pgvector-over-pinecone.md`.

- **Async indexing over synchronous uploads**  
  Uploads remain snappy, and the `jobs` table gives you robust retries and observability. See `docs/decisions/002-async-indexing.md`.

- **Structured briefs over freeform text**  
  Briefs are stored as JSON (`BriefContent`) to make validation, rendering, diffing, and evals straightforward. See `docs/decisions/003-citation-first-ux.md`.

- **TypeScript-first, narrow Python worker**  
  Next.js + TypeScript own the product surface; Python is used narrowly for indexing and embeddings where async file/IO work shines.

### Project layout

See the `briefforge/` root for the full monorepo layout. Key pieces:

- `apps/web` – Next.js app (App Router, dashboard, APIs)
- `services/indexing-worker` – Python background worker
- `packages/core` – shared Zod schemas and types
- `packages/prompts` – model prompts and prompt versions
- `packages/evals` – eval harness (planned)
- `packages/observability` – logging utilities
- `supabase` – migrations and seed data
- `docs` – architecture, API contracts, security, demo script, [future updates](docs/future-updates.md) (optional CI and Jobs improvements)

### Status

This repository is intentionally scoped as a **weekend MVP + 2-week V1** build:

- MVP:
  - Auth, workspaces, source upload, async indexing (parse/chunk/embed), pgvector retrieval.
  - Grounded QA with citations and structured brief generation.
  - Basic dashboard to inspect sources, jobs, answers, and briefs.
- V1 (planned):
  - Trust levels, prompt-injection flagging, unsupported-claim checks.
  - Eval harness and regression tests.
  - Usage and cost tracking surfaces in the UI.
  - CI, smoke tests, and richer docs.

