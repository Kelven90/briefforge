import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "../../../../lib/db/client";
import { requireUser } from "../../../../lib/api/auth";

const BodySchema = z.object({
  status: z.enum(["draft", "reviewed", "approved"])
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { briefId: string } }
) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const briefId = params.briefId;
  if (!briefId) {
    return new Response(JSON.stringify({ error: "briefId required" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const json = await req.json().catch(() => null);
    body = BodySchema.parse(json);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body; status must be draft, reviewed, or approved" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { rows } = await query<{ workspaceId: string }>(
    `select workspace_id as "workspaceId" from public.briefs where id = $1 limit 1`,
    [briefId]
  );
  const brief = rows[0];
  if (!brief) {
    return new Response(JSON.stringify({ error: "Brief not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  const workspaceCheck = await query<{ id: string }>(
    `select id from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [brief.workspaceId, auth.user.id]
  );
  if (!workspaceCheck.rows[0]) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }

  await query(
    `update public.briefs set status = $1 where id = $2`,
    [body.status, briefId]
  );

  return new Response(JSON.stringify({ ok: true, status: body.status }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
