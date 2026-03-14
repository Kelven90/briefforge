import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/api/auth";
import { getWorkspaceForUser } from "../../../../lib/workspaces";

type RouteContext = {
  params: { id: string };
};

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const workspace = await getWorkspaceForUser(auth.user.id, context.params.id);
  if (!workspace) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ workspace }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

