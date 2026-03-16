## Demo walkthrough (≈3 minutes)

1. **Home → demo sign‑in**
   - Go to `http://localhost:3000`.
   - Click **“Start demo workspace”** and complete the sign‑in flow as the demo user.
2. **Open the seeded workspace**
   - On the dashboard, open the **Acme launch demo workspace**.
   - Point out that it’s seeded with kickoff, brand, FAQ, and a prompt‑injection sample.
3. **Inspect sources & trust**
   - Expand **Sources**.
   - Click the trust badges (`Trusted` / `Flagged`) to show the short explanation for each label.
4. **Show the indexing pipeline**
   - Expand **Jobs (indexing pipeline)**.
   - Point out parse → chunk → embed stages and how retries surface when something fails.
5. **Ask one grounded question**
   - In **Q&A (grounded with evidence)** ask:
     - “What constraints does Acme have around the launch timeline and scope?”
   - Click a couple of **Evidence** chips to show retrieved chunks and trust levels.
6. **Generate and review a structured brief**
   - In **Structured brief**, generate a new brief (or reuse the latest).
   - Call out stable sections + citation counts.
   - Optionally use **“Needs changes”** and regenerate with short feedback.
7. **Usage, cost, and evals**
   - Expand **Usage & latency** to show recent runs (latency, tokens, cost).
   - Expand **Evals (QA & brief)** to show the latest summaries and mention `pnpm evals`.

