# API contracts

All application API routes live under `/api` and return JSON. Authenticated routes require a valid NextAuth session (or, in non-production, the internal eval token). Errors use a consistent shape: `{ error: string }` or `{ error: string, issues?: unknown }`.

## Authentication

- **Session-based**: Use NextAuth (Credentials provider). Session cookie is sent automatically by the browser.
- **Internal evals** (non-production only): Send header `x-internal-eval-token` with a token matching `BRIEFFORGE_EVAL_TOKEN` to authenticate as the demo user. Used by `packages/evals` scripts.

## Routes

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workspaces` | List workspaces for the current user. |
| POST | `/api/workspaces` | Create a workspace. |
| GET | `/api/workspaces/[id]` | Get a single workspace (must be owned by the user). |

**POST /api/workspaces** body:

```json
{
  "name": "string (required, 1–200 chars)",
  "description": "string (optional, max 2000)"
}
```

Response: `{ workspace: Workspace }` (201) or 400/500.

---

### Sources

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sources/upload` | Create a source and enqueue a parse job. |

**POST /api/sources/upload** body:

```json
{
  "workspaceId": "uuid (required)",
  "fileName": "string (required)",
  "fileType": "string (required)",
  "storagePath": "string (optional)",
  "content": "string (optional – inline text; written to storage for the worker)"
}
```

Response: `{ source, job, queueJob }` (201), or 404 (workspace not found), 400/500.

---

### Q&A

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/qa/ask` | Grounded Q&A with citations. |

**POST /api/qa/ask** body:

```json
{
  "workspaceId": "uuid (required)",
  "question": "string (required)",
  "topK": "number (optional, 1–20, default 8)"
}
```

Response: `{ id, answerText, citations: [{ chunkId, sourceId }], latencyMs, tokenInput?, tokenOutput?, estimatedCost? }` (200), or 400/404/500.

---

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/jobs/retry` | Re-queue a failed indexing job (resets to `queued` and enqueues to Redis). |

**POST /api/jobs/retry** body:

```json
{
  "workspaceId": "uuid (required)",
  "jobId": "uuid (required)"
}
```

Only jobs with `status: "failed"` and a non-null `sourceId` can be retried. Response: `{ ok: true }` (200), or 400/404.

---

### Briefs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/briefs/generate` | Generate a structured brief for the workspace. |

**POST /api/briefs/generate** body:

```json
{
  "workspaceId": "uuid (required)",
  "question": "string (optional)",
  "topK": "number (optional, 1–50, default 24)"
}
```

Response: `{ id, content: BriefContent, version, latencyMs, tokenInput?, tokenOutput?, estimatedCost? }` (200), or 400/404/500.

---

### Auth

NextAuth handles:

- `GET/POST /api/auth/*` (e.g. signin, callback, session).

See [NextAuth.js routes](https://next-auth.js.org/configuration/pages) and `apps/web/lib/auth/config.ts`.
