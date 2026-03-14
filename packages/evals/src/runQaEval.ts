import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

const QaGoldenSchema = z.array(
  z.object({
    id: z.string(),
    workspaceId: z.string().uuid(),
    question: z.string(),
    expectedCitationsMin: z.number().int().nonnegative().default(1)
  })
);

type QaGolden = z.infer<typeof QaGoldenSchema>[number];

type QaEvalResult = {
  id: string;
  question: string;
  ok: boolean;
  citationsCount: number;
  latencyMs: number;
};

async function callQaEndpoint(input: { workspaceId: string; question: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/qa/ask", baseUrl);

  const token = process.env.BRIEFFORGE_EVAL_TOKEN || "local-eval";

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-eval-token": token
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QA endpoint returned ${res.status}: ${text}`);
  }

  return (await res.json()) as {
    id: string;
    answerText: string;
    citations: { chunkId: string; sourceId: string }[];
    latencyMs: number;
  };
}

async function runQaEval(): Promise<void> {
  const datasetPath = path.join(__dirname, "..", "datasets", "qa-golden.json");
  const raw = fs.readFileSync(datasetPath, "utf8");
  const golden = QaGoldenSchema.parse(JSON.parse(raw));

  const results: QaEvalResult[] = [];

  for (const item of golden) {
    // In a more advanced setup, we'd attach an auth cookie. For now we assume demo session or a local token.
    // This script is primarily for local, manual evals.
    try {
      const resp = await callQaEndpoint({
        workspaceId: item.workspaceId,
        question: item.question
      });
      const citationsCount = resp.citations?.length ?? 0;
      const ok = citationsCount >= item.expectedCitationsMin;
      results.push({
        id: item.id,
        question: item.question,
        ok,
        citationsCount,
        latencyMs: resp.latencyMs ?? 0
      });
    } catch (err: any) {
      results.push({
        id: item.id,
        question: item.question,
        ok: false,
        citationsCount: 0,
        latencyMs: 0
      });
      console.error(`Eval case ${item.id} failed:`, err.message ?? err);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const avgLatency =
    results.reduce((acc, r) => acc + r.latencyMs, 0) / Math.max(total, 1);

  console.log("QA eval results");
  console.log("================");
  for (const r of results) {
    console.log(
      `- ${r.id}: ${r.ok ? "OK" : "FAIL"} | citations=${r.citationsCount} | latency=${r.latencyMs}ms`
    );
  }
  console.log("----------------");
  console.log(`Summary: ${passed}/${total} passed, avg latency ${avgLatency.toFixed(0)} ms`);
}

runQaEval().catch((err) => {
  console.error("QA eval run failed:", err);
  process.exit(1);
});

