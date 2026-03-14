import { NextRequest } from "next/server";
import { requireUser } from "../../../lib/api/auth";
import { createWorkspaceForUser, listWorkspacesForUser } from "../../../lib/workspaces";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const workspaces = await listWorkspacesForUser(auth.user.id);
  return new Response(JSON.stringify({ workspaces }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);

  try {
    const workspace = await createWorkspaceForUser(auth.user.id, body);
    return new Response(JSON.stringify({ workspace }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid body", issues: error.issues }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    console.error("Failed to create workspace", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

