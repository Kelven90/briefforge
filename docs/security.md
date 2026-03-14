# Security

## Authentication

- **NextAuth (Auth.js)** is used for web sessions. The demo flow uses a Credentials provider with a fixed access code; in production you would replace this with a proper IdP (e.g. OAuth).
- **API routes** that need a user call `requireUser(req)`. Unauthenticated requests receive `401 Unauthorized`.
- **Internal eval token**: In non-production only, requests with header `x-internal-eval-token` matching `BRIEFFORGE_EVAL_TOKEN` are treated as the demo user. This is for local/CI evals only. The bypass is disabled when `NODE_ENV === "production"`.

## Secrets and environment

- **Never commit** `.env`, `.env.local`, or any file containing `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `AUTH_SECRET`, or `BRIEFFORGE_EVAL_TOKEN`. They are listed in `.gitignore` / `.env.example`.
- Use strong `AUTH_SECRET` in production (e.g. `openssl rand -base64 32`).
- In CI, use repository secrets for any sensitive env vars if you enable evals with real LLM calls.

## Data and authorization

- All workspace-scoped operations (sources, QA, briefs) check that the workspace is owned by the current user (by `owner_id`).
- File uploads (source content) are written under `STORAGE_ROOT` with paths derived from `workspaceId` and filename. The indexing worker reads from the same root; ensure it is not exposed by the web server.

## Input and validation

- Request bodies are validated with Zod before use. Invalid input returns `400` with `issues` when applicable.
- File name and type length limits are enforced in the source upload schema. No raw user content is executed as code.

## Trust levels and guardrails (V1)

- Sources have a `trust_level` (`trusted` | `flagged` | `blocked`). Blocked sources are excluded from retrieval.
- Planned: prompt-injection detection and unsupported-claim checks; see roadmap in README.
