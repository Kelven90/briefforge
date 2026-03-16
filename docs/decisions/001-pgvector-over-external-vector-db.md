## 001 — pgvector over an external vector DB

### Decision

Use Postgres + pgvector for embeddings and retrieval instead of an external vector database.

### Why

- **Local-first**: one database to run, migrate, seed, and debug.
- **Operational simplicity**: fewer moving parts for a demo and solo maintenance.
- **Good enough**: for a single workspace and small datasets, pgvector is more than sufficient.

### Tradeoffs

- Not optimized for large-scale multi-tenant retrieval workloads.
- Fewer built-in retrieval analytics compared to managed vector DBs.

