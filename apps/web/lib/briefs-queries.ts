import { query } from "./db/client";

export type BriefRow = {
  id: string;
  workspaceId: string;
  version: number;
  status: string;
  modelName: string;
  promptVersion: string;
  contentJson: unknown;
  createdAt: string;
};

export async function getLatestBriefForWorkspace(
  workspaceId: string
): Promise<BriefRow | null> {
  const { rows } = await query<BriefRow>(
    `
    select
      id,
      workspace_id as "workspaceId",
      version,
      status,
      model_name as "modelName",
      prompt_version as "promptVersion",
      content_json as "contentJson",
      created_at as "createdAt"
    from public.briefs
    where workspace_id = $1
    order by version desc
    limit 1
    `,
    [workspaceId]
  );
  return rows[0] ?? null;
}
