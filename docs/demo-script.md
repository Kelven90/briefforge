## BriefForge demo script

This script is designed for a 5–10 minute live demo (e.g. with a hiring manager or recruiter). It intentionally mirrors the core engineering decisions.

### 1. Set the context (30–60s)

- **What**: “BriefForge is an AI-native workspace that turns messy client materials into grounded, reviewable project briefs.”
- **Who**: “It’s aimed at agencies, solutions engineers, and creator-tool teams who live in kickoff transcripts, brand guides, FAQs, and shifting requirements.”
- **How**: “Instead of a chat wrapper, it has async indexing, retrieval, structured briefs, citations, and job/usage tracking.”

### 2. Log in as the demo user (30s)

1. Go to `http://localhost:3000`.
2. Click **“Sign in as demo”**.
3. Enter access code `demo`.
4. Point out:
   - “Auth is via NextAuth; for the demo there’s a single seeded user in Postgres.”

### 3. Open the Acme Creator Launch workspace (1–2 min)

1. On `/dashboard`, open **“Acme Creator Launch”**.
2. Call out:
   - **Sources table**: “These are the kickoff transcript, brand guide, FAQ, and a malicious prompt-injection sample.”
   - **Status badges**: “Sources move from `uploaded → parsing → indexed` as the Python worker runs parse/chunk/embed jobs.”
   - **Trust levels**: “In V1 this will drive which chunks are included in retrieval.”
   - **Jobs strip**: “Recent parse/chunk/embed jobs for quick indexing visibility.”

### 4. Ask a grounded question (2–3 min)

1. In the **Grounded Q&A** panel, ask something like:

   > “What constraints does Acme have around launch timing and channels?”

2. Highlight:
   - The **answer text** with natural language explanation.
   - The **latency label** (ms).
   - The **evidence chips**:
     - Click “Evidence 1” and explain that it currently shows IDs, but is wired to chunk/source IDs for a richer drawer.
   - “Under the hood, this:
     - Computes a query embedding.
     - Runs a pgvector search over chunks for this workspace.
     - Calls an OpenAI chat model with a strict JSON‑only, citation‑aware prompt.
     - Validates the JSON against Zod and stores an `answer_runs` row with latency and token usage.”

### 5. Generate a structured brief (2–3 min)

1. In the **Structured brief** panel, click **“Generate brief”**.
2. When the brief appears, walk through:
   - **Project name** at the top.
   - Cards for **Goals**, **Deliverables**, **Constraints**, **Timeline & risks**, and **Open questions**.
   - Citation count badges: “For each section I can see roughly how much evidence backs it.”
3. Explain:
   - “The brief is not just a blob of text. It’s a `BriefContent` JSON object stored in Postgres.”
   - “This makes it easy to validate, render, and eventually diff between versions.”

### 6. Talk through the indexing pipeline (1–2 min)

Without leaving the app, summarize:

- “When I upload a source, the API writes a `sources` row and enqueues a `parse` job.”
- “A Python worker polls jobs, runs parse → chunk → embed, and writes embeddings into `chunks` with pgvector.”
- “The `jobs` table is the source of truth for status, attempts, and timing, which means I can build retries and dashboards later.”

### 7. Close with quality, evals, and future work (1–2 min)

Wrap up with:

- **Quality and evals**:
  - “There’s a dedicated `packages/evals` package planned to run seeded QA and brief evals: schema compliance, citation coverage, unsupported-claim rate, and groundedness.”
  - “Every answer/brief is already stored with enough metadata (citations, tokens, latency, cost slot) to drive these evals.”
- **Trust & safety**:
  - “Sources carry a trust level, and the retrieval layer already excludes `blocked` sources; the plan is to layer on prompt-injection detection and unsupported-claim checks.”
- **Extensions**:
  - “From here I’d add a usage tab for latency/tokens/cost, an eval runner in CI, and potentially a GraphQL read layer for richer dashboard queries.”

