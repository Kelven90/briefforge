import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { z } from "zod";
import { BriefContentSchema } from "@briefforge/core";

const BriefGoldenSchema = z.array(
  z.object({
    id: z.string(),
    workspaceId: z.string().uuid(),
    question: z.string().optional(),
    minSectionsWithCitations: z.number().int().nonnegative().default(1)
  })
);

type BriefGolden = z.infer<typeof BriefGoldenSchema>[number];

type BriefEvalResult = {
  id: string;
  ok: boolean;
  sectionsWithCitations: number;
  latencyMs: number;
};

async function recordEvalSummary(
  results: BriefEvalResult[]
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/evals/record", baseUrl);
  const token = process.env.BRIEFFORGE_EVAL_TOKEN || "local-eval";

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const avgLatency =
    results.reduce((acc, r) => acc + r.latencyMs, 0) / Math.max(total, 1);

  const body = {
    workspaceId: "00000000-0000-0000-0000-000000000010",
    evalType: "brief" as const,
    summary: {
      passed,
      total,
      avgLatencyMs: avgLatency
    },
    cases: results
  };

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-eval-token": token
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      // eslint-disable-next-line no-console
      console.error("Failed to record brief eval summary:", text);
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("Error calling /api/evals/record for brief evals:", err?.message ?? err);
  }
}

async function callBriefEndpoint(input: { workspaceId: string; question?: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL("/api/briefs/generate", baseUrl);

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
    throw new Error(`Brief endpoint returned ${res.status}: ${text}`);
  }

  return (await res.json()) as {
    id: string;
    content: unknown;
    latencyMs: number;
  };
}

async function runBriefEval(): Promise<void> {
  const datasetPath = path.join(__dirname, "..", "datasets", "brief-golden.json");
  const raw = fs.readFileSync(datasetPath, "utf8");
  const golden = BriefGoldenSchema.parse(JSON.parse(raw));

  const results: BriefEvalResult[] = [];

  for (const item of golden) {
    try {
      const resp = await callBriefEndpoint({
        workspaceId: item.workspaceId,
        question: item.question
      });
      const content = BriefContentSchema.parse(resp.content);

      const sections = [
        ...content.goals,
        ...content.targetAudience,
        ...content.deliverables,
        ...content.constraints,
        ...content.timelineRisks,
        ...content.openQuestions
      ];

      const sectionsWithCitations = sections.filter(
        (s) => s.citations && s.citations.length > 0
      ).length;

      const ok = sectionsWithCitations >= item.minSectionsWithCitations;

      results.push({
        id: item.id,
        ok,
        sectionsWithCitations,
        latencyMs: resp.latencyMs ?? 0
      });
    } catch (err: any) {
      results.push({
        id: item.id,
        ok: false,
        sectionsWithCitations: 0,
        latencyMs: 0
      });
      console.error(`Brief eval case ${item.id} failed:`, err.message ?? err);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const avgLatency =
    results.reduce((acc, r) => acc + r.latencyMs, 0) / Math.max(total, 1);

  console.log("Brief eval results");
  console.log("==================");
  for (const r of results) {
    console.log(
      `- ${r.id}: ${r.ok ? "OK" : "FAIL"} | sectionsWithCitations=${r.sectionsWithCitations} | latency=${r.latencyMs}ms`
    );
  }
  console.log("----------------");
  console.log(`Summary: ${passed}/${total} passed, avg latency ${avgLatency.toFixed(0)} ms`);

  await recordEvalSummary(results);
}

runBriefEval().catch((err) => {
  console.error("Brief eval run failed:", err);
  process.exit(1);
});

