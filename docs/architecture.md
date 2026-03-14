## BriefForge Architecture

This document captures the system architecture for BriefForge. It is intentionally pragmatic and focused on a solo‑engineer friendly implementation that still looks and feels production‑minded.

### High-level flow

1. Users authenticate via Auth.js / NextAuth in the Next.js app.
2. Users create workspaces and upload client materials (sources).
3. The upload endpoint:
   - Writes a `sources` row.
   - Inserts a `jobs` row (`job_type = 'parse'`, `status = 'queued'`).
   - Enqueues a corresponding job in the `indexing-jobs` Redis queue.
4. The Python indexing worker consumes jobs, parses files, chunks content, and writes embeddings into `chunks` (pgvector-backed).
5. The web app exposes REST APIs for:
   - Retrieval-grounded QA with citations (`/api/qa/ask`).
   - Structured brief generation (`/api/briefs/generate`).
   - Workspaces, sources, and job inspection.
6. All AI outputs are treated as untrusted until validated for schema compliance and groundedness, with citations into `chunks`.

### Components

#### Web app (Next.js, TypeScript)

- **Routes**:
  - Marketing: `/` (explains the product story and links to the demo).
  - Dashboard:
    - `/dashboard` – lists workspaces for the authenticated user.
    - `/dashboard/workspaces/[workspaceId]` – workspace detail with sources, jobs, QA, and briefs.
- **APIs (App Router)**:
  - `/api/workspaces` – list/create workspaces.
  - `/api/workspaces/[id]` – fetch workspace detail.
  - `/api/sources/upload` – create a source and enqueue a parse job.
  - `/api/qa/ask` – retrieval-grounded QA with citations.
  - `/api/briefs/generate` – structured brief generation backed by citations.
- **Auth**:
  - NextAuth with a demo‑friendly credentials provider (`code = demo`).
  - Sessions carry `userId` for workspace scoping in every API.

#### Database (Postgres + pgvector)

Core tables:

- `users` – demo user and potential future multi-user support.
- `workspaces` – logical grouping of client materials.
- `sources` – uploaded files with:
  - `status` (`uploaded | parsing | indexed | failed | blocked`)
  - `trust_level` (`trusted | flagged | blocked`)
- `chunks` – pgvector-backed text chunks:
  - `chunk_text`, `chunk_index`, `token_count`, `embedding vector(1536)`.
- `briefs` – versioned structured briefs stored as JSON (`content_json`).
- `answer_runs` – each QA call: question, answer, citations, latency, token usage, estimated cost.
- `jobs` – background jobs for indexing and evals:
  - `job_type` (`parse | chunk | embed | reindex | eval`)
  - `status` (`queued | running | completed | failed`)
- `evaluations` – future eval runs with opaque `score_json`.

#### Indexing pipeline

Indexing is deliberately asynchronous and explicit:

1. **Upload**  
   - `/api/sources/upload` validates the payload and ensures the workspace belongs to the current user.
   - Inserts a `sources` row with initial status `uploaded`.
   - Inserts a `jobs` row for `parse` and enqueues a matching Redis job.

2. **Worker loop**  
   - Python worker polls the `jobs` table for `status = 'queued'` and claims a job by marking it `running`.
   - For each job:
     - `parse` → read file, normalize text, mark source `parsing`, enqueue a `chunk` job.
     - `chunk` → create overlapping chunks in `chunks`, enqueue an `embed` job.
     - `embed` → call OpenAI embeddings, update `chunks.embedding`, mark source `indexed`.
   - All transitions are recorded in `jobs` (status, attempts, timestamps), giving a simple job history without needing a dedicated job UI yet.

3. **Trade-offs**  
   - Polling the DB for jobs is simpler than deeply integrating with BullMQ workers on the Python side and is sufficient for a single‑worker setup.
   - The Redis queue acts as a future‑proof contract between the TypeScript app and Python worker, while Postgres remains the source of truth for job state.

#### Retrieval and generation

- **Retrieval**:
  - `lib/rag/retrieve.ts`:
    - Computes a query embedding for a given `workspaceId` + question.
    - Uses pgvector cosine distance to fetch top‑k chunks from `chunks` where `sources.trust_level != 'blocked'`.
    - Returns `{ chunkId, sourceId, chunkText, score }` for use in prompts and citing responses.

- **Grounded QA**:
  - `/api/qa/ask`:
    - Validates input with Zod.
    - Verifies workspace ownership.
    - Retrieves chunks and builds a strict JSON‑only system prompt that requires:
      - `answerText`
      - `citations[]` (chunkId, sourceId)
    - Validates the model output against a Zod schema and records an `answer_runs` row with latency and token usage.

- **Structured briefs**:
  - `/api/briefs/generate`:
    - Uses a stricter model and a prompt defined in `@briefforge/prompts`.
    - Requires JSON matching `BriefContent` (goals, deliverables, constraints, risks, open questions), each with citations.
    - Validates via `BriefContentSchema` and stores a versioned `briefs` row.

### Observability and cost-awareness (initial)

- **Logs**:
  - Pino-based logger in `@briefforge/observability` for the web app.
  - Structured logs in the Python worker for job lifecycle events.
- **Metrics**:
  - Latency recorded per QA and brief generation call (`answer_runs.latency_ms`).
  - Token usage captured from OpenAI responses (input/output tokens).
  - Estimated cost field is present and can be filled as pricing stabilizes.

In a future iteration, these primitives can be wired into OpenTelemetry-compatible exporters or surfaced in a dedicated “Usage” tab in the dashboard.

