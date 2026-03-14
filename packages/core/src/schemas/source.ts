import { z } from "zod";

export const SourceStatusEnum = z.enum([
  "uploaded",
  "parsing",
  "indexed",
  "failed",
  "blocked"
]);

export const SourceTrustLevelEnum = z.enum([
  "trusted",
  "flagged",
  "blocked"
]);

export const SourceSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  fileType: z.string().min(1).max(100),
  storagePath: z.string().min(1).max(1000),
  status: SourceStatusEnum,
  trustLevel: SourceTrustLevelEnum,
  createdAt: z.string().datetime()
});

export type Source = z.infer<typeof SourceSchema>;

