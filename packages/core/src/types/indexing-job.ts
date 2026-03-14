import { JobTypeEnum } from "../schemas/job";
import { z } from "zod";

export const IndexingJobPayloadSchema = z.object({
  jobId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  sourceId: z.string().uuid(),
  jobType: JobTypeEnum
});

export type IndexingJobPayload = z.infer<typeof IndexingJobPayloadSchema>;

