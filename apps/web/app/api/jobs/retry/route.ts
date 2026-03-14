import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "../../../../lib/api/auth";
import { retryJob } from "../../../../lib/jobs-retry";

const BodySchema = z.object({
  workspaceId: z.string().uuid(),
  jobId: z.string().uuid()
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", issues: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const result = await retryJob(auth.user.id, parsed.data.workspaceId, parsed.data.jobId);

  if (!result.ok) {
    const status = result.error === "Workspace not found" || result.error === "Job not found" ? 404 : 400;
    return new Response(JSON.stringify({ error: result.error }), {
      status,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
