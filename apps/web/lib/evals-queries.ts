import { query } from "./db/client";

export type EvaluationRow = {
  id: string;
  workspaceId: string;
  evalType: "qa" | "brief" | "guardrail";
  scoreJson: any;
  createdAt: string;
};

export async function listRecentEvaluationsForWorkspace(
  workspaceId: string,
  limit: number
): Promise<EvaluationRow[]> {
  const { rows } = await query<EvaluationRow>(
    `
    select
      id,
      workspace_id as "workspaceId",
      eval_type as "evalType",
      score_json as "scoreJson",
      created_at as "createdAt"
    from public.evaluations
    where workspace_id = $1
    order by created_at desc
    limit $2
    `,
    [workspaceId, limit]
  );
  return rows;
}

