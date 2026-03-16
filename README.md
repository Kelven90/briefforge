## BriefForge

BriefForge is an AI-native workspace that turns messy client materials into grounded, reviewable project briefs.

It is designed as a system for agencies, solutions engineers, and creator-tool teams: uploads are indexed asynchronously, questions are answered with citations, briefs are structured and schema-validated, and the system tracks jobs, latency, and token usage.

### Why this project exists

- **Problem**: Teams work from kickoff transcripts, PDFs, brand guides, FAQs, and shifting requirements. Synthesis is manual, easy to miss, and hard to review.
- **Goal**: Provide a workspace where you can drop messy sources, ask grounded questions, and generate structured briefs that are backed by evidence.
- **Design stance**: Outputs are *untrusted* until validated. Everything important is structured (jobs, briefs, evals, usage), not freeform blobs.

For the full system diagram and component breakdown, see `docs/architecture.md`.

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

### Quickstart (local)

```bash
pnpm install
docker compose up -d db redis
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
pnpm seed
pnpm dev --filter @briefforge/web
```

Worker (separate terminal):

```bash
cd services/indexing-worker
python -m venv .venv
pip install -e .
python -m src.main
```

### Docs

- `docs/local-development.md` (full setup + CI-equivalent commands)
- `docs/demo-walkthrough.md` (short live demo walkthrough)
- `docs/architecture.md`
- `docs/api-contracts.md`
- `docs/security.md`
- `docs/future-updates.md`

### Deployment considerations

BriefForge is **designed to run locally first** using Docker‑based Postgres and Redis, but the same pieces map cleanly to a simple cloud deployment:

- **Services**
  - Web app: build with `pnpm build && pnpm start` and run as a single Node.js service (e.g. Railway, Render, Fly.io, or a small VM behind Nginx).
  - Postgres: managed Postgres (e.g. Supabase, Railway, Render) with pgvector enabled.
  - Redis: managed Redis (e.g. Upstash, Railway, Render) for the `indexing-jobs` BullMQ queue.
  - Indexing worker: one long‑running Python process (container) pointing at the same Postgres/Redis as the web app.

- **Environment**
  - Same env vars as local dev: `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`, `NEXTAUTH_URL`, plus optional model overrides.
  - Secrets stay in the platform’s secret manager; only `.env.example` is checked into git.

- **Scaling story (demo‑scale)**
  - Web app: scale to a small number of instances; stateless except for sessions backed by the NextAuth adapter.
  - Worker: usually a **single** indexing worker is enough; horizontal scaling is possible by running multiple workers consuming the same queue.
  - Database: single Postgres instance with pgvector extension; reads/writes are modest for a demo workspace.
  - Redis: standard single‑region instance; queue depth and failure rates are visible via the `jobs` table and logs.

### Before pushing to GitHub

- **Secrets:** Never commit `.env`, `apps/web/.env.local`, or any file containing real keys or passwords. They are listed in `.gitignore`; only `.env.example` and `apps/web/.env.example` (templates) are tracked.
- **If you already committed secrets:** Remove them from history before pushing. From the repo root run:
  `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env apps/web/.env.local" --prune-empty HEAD`
  Then **rotate any exposed keys** (new AUTH_SECRET, new OPENAI_API_KEY, etc.).

### Key design decisions

- **pgvector over external vector DB**  
  Keeping embeddings inside Postgres simplifies local development, migrations, and seeding. For a single‑node demo, the operational cost of an external vector service isn’t worth the extra moving parts.

- **Async indexing over synchronous uploads**  
  Upload requests merely create a `sources` row and enqueue a `parse` job; a worker does parse → chunk → embed. This keeps the upload UX responsive, makes retries explicit, and gives you a single `jobs` table to debug indexing issues.

- **Structured briefs over freeform text**  
  Briefs are stored as JSON (`BriefContent` with sections and citations) instead of a single markdown blob. That makes validation, rendering, evaluation, and future diffing or export much easier.

- **Citations and groundedness as first‑class concepts**  
  Every QA/brief run stores citations plus groundedness metadata and exposes them in the UI. The system is designed around “evidence + status” rather than “LLM said so,” which is closer to how you would design a real assistive tool.

Full decision notes:

- `docs/decisions/001-pgvector-over-external-vector-db.md`
- `docs/decisions/002-async-indexing.md`
- `docs/decisions/003-structured-briefs-and-citations.md`

