import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { query } from "../../../../../lib/db/client";
import { requireUser } from "../../../../../lib/api/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { sourceId: string } }
) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const sourceId = params.sourceId;
  if (!sourceId) {
    return new Response(JSON.stringify({ error: "sourceId required" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { rows } = await query<{
    storagePath: string;
    workspaceId: string;
    fileName: string;
  }>(
    `
    select storage_path as "storagePath", workspace_id as "workspaceId", file_name as "fileName"
    from public.sources where id = $1 limit 1
    `,
    [sourceId]
  );

  const row = rows[0];
  if (!row) {
    return new Response(JSON.stringify({ error: "Source not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  const workspaceCheck = await query<{ id: string }>(
    `select id from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [row.workspaceId, auth.user.id]
  );
  if (!workspaceCheck.rows[0]) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" }
    });
  }

  const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");
  const absolutePath = path.join(storageRoot, row.storagePath.replace(/^\/+/, ""));

  let content: string;
  try {
    content = await fs.readFile(absolutePath, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return new Response(JSON.stringify({ error: "File not found on disk" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
    throw err;
  }

  return new Response(content, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-source-file-name": encodeURIComponent(row.fileName)
    }
  });
}
