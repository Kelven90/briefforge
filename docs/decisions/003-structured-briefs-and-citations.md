## 003 — Structured briefs and citation-first UX

### Decision

Generate and store briefs as a stable JSON schema (`BriefContent`) with citations per section, and expose evidence in the UI.

### Why

- **Validation**: schema compliance is enforced before storing output.
- **Reviewability**: citations and evidence make it easier to trust (or reject) model output.
- **Testability**: eval scripts can assert structure and citation coverage across prompt/model changes.

### Tradeoffs

- More prompt and UI work than returning a single markdown blob.
- Requires careful schema evolution if the brief format changes over time.

