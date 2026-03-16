import { NextRequest } from "next/server";
import { query } from "../../../lib/db/client";
import { requireUser } from "../../../lib/api/auth";

export type EvidenceResponse = {
  chunk: { id: string; chunkText: string; chunkIndex: number; tokenCount: number };
  source: { id: string; fileName: string; fileType: string; trustLevel: string };
};

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const chunkId = req.nextUrl.searchParams.get("chunkId");
  if (!chunkId) {
    return new Response(JSON.stringify({ error: "chunkId required" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { rows } = await query<{
    chunkId: string;
    chunkText: string;
    chunkIndex: number;
    tokenCount: number;
    sourceId: string;
    fileName: string;
    fileType: string;
    trustLevel: string;
    workspaceId: string;
  }>(
    `
    select
      c.id as "chunkId",
      c.chunk_text as "chunkText",
      c.chunk_index as "chunkIndex",
      c.token_count as "tokenCount",
      s.id as "sourceId",
      s.file_name as "fileName",
      s.file_type as "fileType",
      s.trust_level as "trustLevel",
      c.workspace_id as "workspaceId"
    from public.chunks c
    join public.sources s on s.id = c.source_id
    where c.id = $1
    limit 1
    `,
    [chunkId]
  );

  const row = rows[0];
  if (!row) {
    return new Response(JSON.stringify({ error: "Chunk not found" }), {
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

  const body: EvidenceResponse = {
    chunk: {
      id: row.chunkId,
      chunkText: row.chunkText,
      chunkIndex: row.chunkIndex,
      tokenCount: row.tokenCount
    },
    source: {
      id: row.sourceId,
      fileName: row.fileName,
      fileType: row.fileType,
      trustLevel: row.trustLevel
    }
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
