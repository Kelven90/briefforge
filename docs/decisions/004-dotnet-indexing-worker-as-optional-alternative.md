## 004 — .NET indexing worker as an optional alternative

### Decision

Provide a **.NET 8** implementation of the indexing worker as an **optional alternative** to the existing Python worker, without changing the web app or database schema.

### Why

- **Demonstrate C#/.NET in a practical way**: background processing, DB reads/writes, retries, and structured logging on a real workflow.
- **Low-risk evolution**: keep Python as the default path and allow swapping workers without touching upload/QA/brief flows.
- **Contract-first design**: the worker is defined by Postgres tables (`jobs`, `sources`, `chunks`) and job types (`parse → chunk → embed`), not by the implementation language.

### Tradeoffs

- Two worker implementations means **two places to maintain** behavior and edge cases.
- Requires discipline to keep contracts stable (enums, statuses, and schema migrations must remain compatible).

