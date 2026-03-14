import { query } from "./db/client";

export type JobRow = {
  id: string;
  workspaceId: string;
  sourceId: string | null;
  sourceFileName: string | null;
  jobType: string;
  status: string;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export async function listRecentJobsForWorkspace(
  workspaceId: string,
  limit = 10
): Promise<JobRow[]> {
  const { rows } = await query<JobRow>(
    `
      select
        j.id,
        j.workspace_id as "workspaceId",
        j.source_id as "sourceId",
        s.file_name as "sourceFileName",
        j.job_type as "jobType",
        j.status,
        j.attempts,
        j.started_at as "startedAt",
        j.completed_at as "completedAt",
        j.created_at as "createdAt"
      from public.jobs j
      left join public.sources s on s.id = j.source_id
      where j.workspace_id = $1
      order by j.created_at desc
      limit $2
    `,
    [workspaceId, limit]
  );
  return rows;
}

export type JobForRetry = {
  id: string;
  workspaceId: string;
  sourceId: string | null;
  jobType: string;
  status: string;
};

export async function getJobByIdAndWorkspace(
  jobId: string,
  workspaceId: string
): Promise<JobForRetry | null> {
  const { rows } = await query<JobForRetry>(
    `
      select
        id,
        workspace_id as "workspaceId",
        source_id as "sourceId",
        job_type as "jobType",
        status
      from public.jobs
      where id = $1 and workspace_id = $2
      limit 1
    `,
    [jobId, workspaceId]
  );
  return rows[0] ?? null;
}

