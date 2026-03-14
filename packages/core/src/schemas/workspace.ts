import { z } from "zod";

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  createdAt: z.string().datetime()
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

