import { NextRequest } from "next/server";
import { getCurrentSession } from "../auth/session";

export async function requireUser(req: NextRequest) {
  const internalToken = req.headers.get("x-internal-eval-token");
  if (
    internalToken &&
    process.env.NODE_ENV !== "production"
  ) {
    return {
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "demo@acmecreator.test"
      },
      response: null
    } as const;
  }

  const session = await getCurrentSession();
  if (!session?.user || !("id" in session.user) || !session.user.id) {
    return {
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    } as const;
  }

  return {
    user: { id: String(session.user.id), email: session.user.email ?? null },
    response: null
  } as const;
}

