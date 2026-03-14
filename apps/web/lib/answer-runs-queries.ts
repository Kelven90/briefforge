import { query } from "./db/client";

export type AnswerRunRow = {
  id: string;
  workspaceId: string;
  question: string;
  answerText: string;
  latencyMs: number;
  tokenInput: number;
  tokenOutput: number;
  // numeric(12,6) comes back as string from pg by default
  estimatedCost: string;
  createdAt: string;
};

export async function listRecentAnswerRunsForWorkspace(
  workspaceId: string,
  limit = 10
): Promise<AnswerRunRow[]> {
  const { rows } = await query<AnswerRunRow>(
    `
      select
        id,
        workspace_id as "workspaceId",
        question,
        answer_text as "answerText",
        latency_ms as "latencyMs",
        token_input as "tokenInput",
        token_output as "tokenOutput",
        estimated_cost as "estimatedCost",
        created_at as "createdAt"
      from public.answer_runs
      where workspace_id = $1
      order by created_at desc
      limit $2
    `,
    [workspaceId, limit]
  );
  return rows;
}

