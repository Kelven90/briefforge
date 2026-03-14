import { query } from "./db/client";
import { getJobByIdAndWorkspace } from "./jobs-queries";
import { enqueueIndexingJob } from "./queue";
import type { IndexingJobPayload } from "@briefforge/core";

/**
 * Resets a failed job to queued and re-enqueues it to Redis.
 * Only allowed when status is 'failed' and sourceId is not null.
 */
export async function retryJob(
  userId: string,
  workspaceId: string,
  jobId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const workspaceCheck = await query<{ id: string }>(
    `select id from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [workspaceId, userId]
  );
  if (!workspaceCheck.rows[0]) {
    return { ok: false, error: "Workspace not found" };
  }

  const job = await getJobByIdAndWorkspace(jobId, workspaceId);
  if (!job) {
    return { ok: false, error: "Job not found" };
  }
  if (job.status !== "failed") {
    return { ok: false, error: "Only failed jobs can be retried" };
  }
  if (!job.sourceId) {
    return { ok: false, error: "Job has no source; cannot retry" };
  }

  await query(
    `update public.jobs set status = 'queued', started_at = null, completed_at = null where id = $1 and workspace_id = $2`,
    [jobId, workspaceId]
  );

  const payload: IndexingJobPayload = {
    jobId: job.id,
    workspaceId: job.workspaceId,
    sourceId: job.sourceId,
    jobType: job.jobType as IndexingJobPayload["jobType"]
  };
  await enqueueIndexingJob(payload);

  return { ok: true };
}
