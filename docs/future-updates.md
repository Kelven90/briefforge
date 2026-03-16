# Future updates and potential changes

This doc captures optional improvements and alternatives discussed for the current setup. None are required for the current scope; they are here for prioritisation later.

---

## CI pipeline checklist (verified)

When changing CI or the repo, avoid breaking the following:

- **pnpm:** Version comes from root `package.json` → `"packageManager": "pnpm@9.0.0"` only. Do not add `version` to `pnpm/action-setup@v4` in the workflow (causes version mismatch).
- **Lockfile:** Run `pnpm install` after adding/removing any dependency so `pnpm-lock.yaml` stays in sync. CI uses `--frozen-lockfile`.
- **Workspace deps:** Internal packages must use `"workspace:*"` (e.g. `@briefforge/core`, `@briefforge/prompts` in evals/prompts). A version like `"0.1.0"` makes pnpm try npm and fail with 404.
- **Lint:** `apps/web` must have an ESLint config (e.g. `apps/web/.eslintrc.json` with `extends: "next/core-web-vitals"`) so `next lint` runs non-interactively in CI.
- **Evals job:** The web app and `pnpm evals` must run in the **same step**. If the server is started in one step and evals in the next, the background server is killed when the first step ends, so evals hit nothing.
- **Telemetry:** `TURBO_TELEMETRY_DISABLED=1` is set in the workflow so Turbo does not prompt or delay.
- **Evals env:** Evals job sets `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `BRIEFFORGE_EVAL_TOKEN`, `BRIEFFORGE_DISABLE_LLM=1`, `NEXT_PUBLIC_APP_URL`. Seed and migrate use `DATABASE_URL`; the app uses the rest.

---

## CI (GitHub Actions)

**Current setup:** Two jobs — (1) lint, typecheck, build; (2) evals with Postgres + Redis, migrate, seed, start app, run evals on every push/PR.

**Potential changes:**

- **Run evals only on `main` (or nightly)**  
  Trigger the evals job only on push to `main` (or on a schedule). Keeps PR feedback fast while still validating the full stack after merge.

- **Evals as optional / manual**  
  Add `workflow_dispatch` so evals can be run manually from the Actions tab, or rely on “run `pnpm evals` locally before merge” and keep CI to lint, typecheck, and build only.

- **Run seed via Node instead of `psql`**  
  Execute `supabase/seed.sql` from a small Node script (e.g. using `pg` and `fs.readFileSync`) so the evals job does not need `apt-get install postgresql-client`. One fewer dependency and a more portable pipeline.

- **Cache build artifacts for the evals job**  
  Cache `.next` and/or `node_modules` between the lint-typecheck-build job and the evals job (e.g. with `actions/cache`) to shorten evals job time, at the cost of slightly more workflow complexity.

---

## Usage (recent answers) – click to view record

**Planned (priority before Jobs observability and Briefs review):** When the user clicks a question in the Usage (recent answers) table, show a detail view (drawer or modal) with:

- The full **answer record**: answer text, citations, groundedness status, unsupported-claims count, latency, token in/out, estimated cost.
- If a **brief** was generated in the same workspace around that flow (or linked to that answer/run), show the brief record (version, sections, citation counts) so the user can review answer and brief together.

This improves traceability and review without changing the existing QA or brief APIs.

---

## Jobs (indexing pipeline and UI)

**Current setup:** Jobs table in the workspace UI (type, status, source, started, completed, attempts); retry only for failed jobs with a non-null source. Worker polls Postgres only; retry updates the job to `queued` and also enqueues to Redis (redundant for current worker but harmless and future-proof).

**Potential changes:**

- **Store and show failure reason**  
  Add an `error_message` (or similar) column to `public.jobs`, have the worker set it on failure, and show it in the Jobs table so users can see why a job failed without checking logs.

- **Cancel queued or running jobs**  
  Allow users to cancel jobs in `queued` (and optionally `running`) state so they can stop a bad or obsolete run without waiting for failure or retry.

- **Pagination or “Load more” for job history**  
  If workspaces can have many jobs, add limit/offset or a “load more” control so the Jobs card stays responsive and the page does not load hundreds of rows at once.

---

## Other docs

- **Architecture:** `docs/architecture.md`  
- **API contracts:** `docs/api-contracts.md`  
- **Security:** `docs/security.md`  
- **Demo script:** `docs/demo-script.md`
