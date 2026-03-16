import { NextRequest } from "next/server";
import { getLatestBriefForWorkspace } from "../../../../../../lib/briefs-queries";
import { requireUser } from "../../../../../../lib/api/auth";
import { query } from "../../../../../../lib/db/client";

type RouteContext = {
  params: { id: string };
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const workspaceId = params.id;
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: "workspaceId required" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const workspaceCheck = await query<{ id: string }>(
    `select id from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [workspaceId, auth.user.id]
  );
  if (!workspaceCheck.rows[0]) {
    return new Response(JSON.stringify({ error: "Workspace not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  const brief = await getLatestBriefForWorkspace(workspaceId);
  if (!brief) {
    return new Response(JSON.stringify({ brief: null }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response(
    JSON.stringify({
      brief: {
        id: brief.id,
        workspaceId: brief.workspaceId,
        version: brief.version,
        status: brief.status,
        modelName: brief.modelName,
        promptVersion: brief.promptVersion,
        content: brief.contentJson,
        createdAt: brief.createdAt
      }
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

