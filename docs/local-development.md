## Local development

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Docker** (for Postgres and Redis)
- **PostgreSQL client** (`psql`) on your PATH — for running migrations and seed SQL.
- **Python** 3.11+ (only if you run the indexing worker locally)

### 1. Clone and install

```bash
git clone git@github.com:Kelven90/briefforge.git
cd briefforge
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Required for local dev:

- `DATABASE_URL` – local Postgres instance (docker-compose uses `briefforge` DB by default).
- `REDIS_URL` – Redis connection string.
- `OPENAI_API_KEY` – for embeddings and chat completion.
  - Set `BRIEFFORGE_DISABLE_LLM=1` during UI/dev work to avoid calling OpenAI.

Optional but recommended:

- `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`, `OPENAI_STRICT_MODEL`
- `AUTH_SECRET` (for NextAuth)

### 3. Start infrastructure and seed DB

```bash
docker compose up -d db redis
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
pnpm seed
```

### 4. Run the app and worker

In **two separate terminals** from the repo root:

```bash
# Terminal 1 — Web app
pnpm dev --filter @briefforge/web
```

```bash
# Terminal 2 — Indexing worker (Python)
cd services/indexing-worker
python -m venv .venv

# Activate:
# macOS/Linux → source .venv/bin/activate
# Windows (Git Bash) → source .venv/Scripts/activate

pip install -e .
python -m src.main
```

The web app runs at `http://localhost:3000`.

If you run on a different host/port, set `NEXTAUTH_URL` accordingly so callbacks work.

### 5. Run checks (CI-equivalent)

```bash
pnpm install --frozen-lockfile
pnpm check

### 6. Optional: smoke test + evals

With the app running (or using `pnpm --filter @briefforge/web start` in another terminal):

```bash
pnpm test:smoke
pnpm evals
```

