import { NextRequest } from "next/server";
import { requireUser } from "../../../../lib/api/auth";
import { createSourceAndEnqueueParseJob } from "../../../../lib/sources";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);

  try {
    const { source, job, queueJob } = await createSourceAndEnqueueParseJob(auth.user.id, body);
    return new Response(JSON.stringify({ source, job, queueJob }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
    if (error?.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid body", issues: error.issues }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }
    console.error("Failed to create source", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

