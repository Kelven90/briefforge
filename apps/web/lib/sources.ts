import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { query } from "./db/client";
import type { Source, Job, IndexingJobPayload } from "@briefforge/core";
import { enqueueIndexingJob } from "./queue";

const CreateSourceInput = z.object({
  workspaceId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  fileType: z.string().min(1).max(100),
  // In a real deployment this would be filled after uploading to S3/Supabase Storage.
  storagePath: z.string().min(1).max(1000).optional(),
  // Optional inline content for simple text uploads; when present we write it to storageRoot + storagePath.
  content: z.string().optional()
});

export type CreateSourceInput = z.infer<typeof CreateSourceInput>;

function detectTrustLevel(fileName: string, content?: string | null): "trusted" | "flagged" {
  const text = `${fileName}\n${content ?? ""}`.toLowerCase();
  const suspiciousPhrases = [
    "ignore previous instructions",
    "you are chatgpt",
    "act as",
    "system prompt",
    "jailbreak",
    "prompt injection",
    "do anything now",
    "override your instructions"
  ];
  const looksSuspicious = suspiciousPhrases.some((phrase) => text.includes(phrase));
  return looksSuspicious ? "flagged" : "trusted";
}

export async function createSourceAndEnqueueParseJob(
  ownerId: string,
  input: unknown
): Promise<{ source: Source; job: Job; queueJob: IndexingJobPayload }> {
  const parsed = CreateSourceInput.parse(input);

  // Ensure workspace belongs to current user
  const workspaceCheck = await query<{ id: string }>(
    `select id from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [parsed.workspaceId, ownerId]
  );
  if (!workspaceCheck.rows[0]) {
    throw Object.assign(new Error("Workspace not found"), { statusCode: 404 });
  }

  const storagePath =
    parsed.storagePath ?? `/local/uploads/${parsed.workspaceId}/${Date.now()}-${parsed.fileName}`;

  // If content is provided, write it to disk so the worker can read it.
  if (parsed.content) {
    const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");
    const absolutePath = path.join(
      storageRoot,
      storagePath.replace(/^\/+/, "")
    );
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(absolutePath, parsed.content, "utf8");
  }

  const trustLevel = detectTrustLevel(parsed.fileName, parsed.content ?? null);

  const { rows } = await query<Source & { job_id: string }>(
    `
      with inserted_source as (
        insert into public.sources (workspace_id, file_name, file_type, storage_path, trust_level)
        values ($1, $2, $3, $4, $5)
        returning id, workspace_id as "workspaceId", file_name as "fileName",
                  file_type as "fileType", storage_path as "storagePath",
                  status, trust_level as "trustLevel", created_at as "createdAt"
      ),
      inserted_job as (
        insert into public.jobs (workspace_id, source_id, job_type, status)
        select "workspaceId", id, 'parse', 'queued' from inserted_source
        returning id
      )
      select s.*, j.id as job_id
      from inserted_source s
      cross join inserted_job j
    `,
    [parsed.workspaceId, parsed.fileName, parsed.fileType, storagePath, trustLevel]
  );

  const row = rows[0];

  const job: Job = {
    id: row.job_id,
    workspaceId: row.workspaceId,
    sourceId: row.id,
    jobType: "parse",
    status: "queued",
    attempts: 0,
    startedAt: null,
    completedAt: null
  };

  const queueJob: IndexingJobPayload = {
    jobId: job.id,
    workspaceId: job.workspaceId,
    sourceId: job.sourceId!,
    jobType: job.jobType
  };

  // Fire-and-forget enqueue to Redis; if this fails, the DB job row still allows manual retry.
  await enqueueIndexingJob(queueJob);

  const { job_id, ...sourceRest } = row as any;

  return {
    source: sourceRest,
    job,
    queueJob
  };
}

