import { NextRequest } from "next/server";
import { z } from "zod";

import { query } from "../../../../lib/db/client";
import { requireUser } from "../../../../lib/api/auth";

const BodySchema = z.object({
  workspaceId: z.string().uuid(),
  evalType: z.enum(["qa", "brief", "guardrail"]),
  summary: z.object({
    passed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    avgLatencyMs: z.number().nonnegative()
  }),
  cases: z.array(z.record(z.any())).optional()
});

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser(req);
  if (!user) {
    return response;
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Invalid body", details: err?.message }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { workspaceId, evalType, summary, cases } = body;

  await query(
    `
    insert into public.evaluations (workspace_id, eval_type, score_json)
    values ($1, $2, $3)
    `,
    [workspaceId, evalType, { summary, cases }]
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

