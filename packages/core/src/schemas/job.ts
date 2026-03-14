import { z } from "zod";

export const JobTypeEnum = z.enum(["parse", "chunk", "embed", "reindex", "eval"]);

export const JobStatusEnum = z.enum(["queued", "running", "completed", "failed"]);

export const JobSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  sourceId: z.string().uuid().nullable(),
  jobType: JobTypeEnum,
  status: JobStatusEnum,
  attempts: z.number().int().nonnegative(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable()
});

export type Job = z.infer<typeof JobSchema>;

