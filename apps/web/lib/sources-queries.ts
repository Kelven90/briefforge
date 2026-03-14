import { query } from "./db/client";

export type SourceRow = {
  id: string;
  workspaceId: string;
  fileName: string;
  fileType: string;
  status: string;
  trustLevel: string;
  createdAt: string;
};

export async function listSourcesForWorkspace(workspaceId: string): Promise<SourceRow[]> {
  const { rows } = await query<SourceRow>(
    `
      select
        id,
        workspace_id as "workspaceId",
        file_name as "fileName",
        file_type as "fileType",
        status,
        trust_level as "trustLevel",
        created_at as "createdAt"
      from public.sources
      where workspace_id = $1
      order by created_at desc
    `,
    [workspaceId]
  );
  return rows;
}

