## 002 — Asynchronous indexing over synchronous uploads

### Decision

Uploads create a `source` record and enqueue indexing work (parse → chunk → embed) as jobs, instead of doing parsing/embedding in the request cycle.

### Why

- **Responsiveness**: uploads return quickly without waiting on embeddings.
- **Operability**: each stage has a status and can be retried independently.
- **Visibility**: job history makes it easy to diagnose “why retrieval looks empty.”

### Tradeoffs

- Requires Redis + a worker process to be running.
- Adds eventual consistency: a source may exist before it’s indexed.

