## BriefForge

BriefForge is an AI-native workspace that turns messy client materials into grounded, reviewable project briefs.

It is designed as a system for agencies, solutions engineers, and creator-tool teams: uploads are indexed asynchronously, questions are answered with citations, briefs are structured and schema-validated, and the system tracks jobs, latency, and token usage.

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

- **Node.js** 20+ and **pnpm** 9+
- **Docker** (for Postgres and Redis)
- **PostgreSQL client** (`psql`) on your PATH — for running migrations and seed SQL. Install via [PostgreSQL](https://www.postgresql.org/download/) or `choco install postgresql` on Windows; ensure the `bin` directory is in PATH.
- **Python** 3.11+ (only if you run the indexing worker locally)

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

#### 3. Start infrastructure and seed DB

From the repo root:

```bash
docker compose up -d db redis
```

Then run migrations and seed (requires `psql` on your PATH):

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
pnpm seed
```

#### 4. Run the app and worker

In **two separate terminals** from the repo root:

```bash
# Terminal 1 — Web app
pnpm dev --filter @briefforge/web

# Terminal 2 — Indexing worker (Python)
cd services/indexing-worker
python -m venv .venv

# Activate: 
macOS/Linux → source .venv/bin/activate   
Windows (Git Bash) → source .venv/Scripts/activate

pip install -e .
python -m src.main
```

The web app will be available at `http://localhost:3000`.

**Note:** If you run the app on a different port or host, set `NEXTAUTH_URL` (e.g. `http://localhost:3001`) so sign-in and callbacks work. If port 3000 is already in use, stop the other process or set the port when starting (e.g. `PORT=3001 pnpm dev --filter @briefforge/web`).

#### 5. Run CI locally (before pushing)

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

3. **Migrate and seed** (from repo root; same as step 3 above):
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
   psql "$DATABASE_URL" -f supabase/seed.sql
   pnpm seed
   ```

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

#### 6. Quick Demo walkthrough

1. **Home → demo sign‑in**
   - Go to `http://localhost:3000`.
   - Click **“Start demo workspace”** and complete the sign‑in flow as the demo user.
2. **Open the seeded workspace**
   - On the dashboard, open the **Acme launch demo workspace**.
   - Briefly point out the description so people know this is seeded with kickoff, brand, FAQ, and a prompt‑injection file.
3. **Inspect sources & trust**
   - Expand **Sources**.
   - Hover a couple of rows (kickoff, brand guide, FAQ, prompt‑injection).
   - Click the trust badges (`Trusted` / `Flagged`) to show the short explanation of why each label exists.
4. **Show the indexing pipeline**
   - Expand **Jobs (indexing pipeline)**.
   - Use the small `i` icon to explain that uploads fan out into **parse → chunk → embed** jobs with retries.
5. **Ask one grounded question**
   - In **Q&A (grounded with evidence)**, ask a prepared question like:
     - “What constraints does Acme have around the launch timeline and scope?”
   - When the answer returns, point out latency, groundedness status, and click a couple of **Evidence** chips to show the retrieved chunks and trust levels.
6. **Generate and review a structured brief**
   - In **Structured brief**, either generate a new brief or reuse the latest one.
   - Call out the stable sections (goals, deliverables, constraints, timeline risks, open questions) and the citation counts per section.
   - Optionally hit **“Needs changes”** and regenerate with a short feedback note to show iterative improvement.
7. **Usage, cost, and evals**
   - Expand **Usage & latency** to show recent Q&A runs, average latency, tokens in/out, and estimated cost.
   - Expand **Evals (QA & brief)** to show the latest QA/brief eval summaries (passed/total and average latency) and mention that `pnpm evals` calls the same endpoints as the UI.

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

### Security & guardrails

This is a demo, but it is still designed with basic safety and isolation in mind:

- **Auth and tenant scoping**  
  - Auth is handled with NextAuth; all workspace‑scoped APIs check that the current user owns the workspace ID on every request.

- **Validation and schemas everywhere**  
  - Request bodies are parsed with Zod (`CreateSourceInput`, QA/brief request bodies).
  - LLM responses for briefs must validate against `BriefContentSchema` before they are stored; invalid JSON fails the request instead of silently corrupting state.

- **Prompt‑injection awareness**  
  - New sources run through a simple `detectTrustLevel` heuristic; suspicious content (e.g. “ignore previous instructions”, “system prompt”, “jailbreak”) is marked as **flagged** and surfaced in the UI so you can reason about which files might be adversarial.

- **Isolation of secrets and demo data**  
  - All secrets live in env vars; only `.env.example` templates are committed.
  - The Acme workspace and its files are fully synthetic demo data, not real customer material.

- **Evidence‑first UX**  
  - Both QA answers and briefs are accompanied by citations and groundedness/unsupported‑claim signals so the user can review before trusting or acting on model output.

### Key design decisions

- **pgvector over external vector DB**  
  Keeping embeddings inside Postgres simplifies local development, migrations, and seeding. For a single‑node demo, the operational cost of an external vector service isn’t worth the extra moving parts.

- **Async indexing over synchronous uploads**  
  Upload requests merely create a `sources` row and enqueue a `parse` job; a worker does parse → chunk → embed. This keeps the upload UX responsive, makes retries explicit, and gives you a single `jobs` table to debug indexing issues.

- **Structured briefs over freeform text**  
  Briefs are stored as JSON (`BriefContent` with sections and citations) instead of a single markdown blob. That makes validation, rendering, evaluation, and future diffing or export much easier.

- **Citations and groundedness as first‑class concepts**  
  Every QA/brief run stores citations plus groundedness metadata and exposes them in the UI. The system is designed around “evidence + status” rather than “LLM said so,” which is closer to how you would design a real assistive tool.

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

This repository is intentionally scoped as:

- MVP:
  - Auth, workspaces, source upload, async indexing (parse/chunk/embed), pgvector retrieval.
  - Grounded QA with citations and structured brief generation.
  - Basic dashboard to inspect sources, jobs, answers, and briefs.
- V1 (planned):
  - Trust levels, prompt-injection flagging, unsupported-claim checks.
  - Eval harness and regression tests.
  - Usage and cost tracking surfaces in the UI.
  - CI, smoke tests, and richer docs.

