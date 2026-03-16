import { NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/api/auth";
import { getWorkspaceForUser } from "../../../../../lib/workspaces";
import { listRecentJobsForWorkspace } from "../../../../../lib/jobs-queries";

type RouteContext = {
  params: { id: string };
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const workspace = await getWorkspaceForUser(auth.user.id, params.id);
  if (!workspace) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  const jobs = await listRecentJobsForWorkspace(workspace.id, 48);

  return new Response(JSON.stringify({ jobs }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

