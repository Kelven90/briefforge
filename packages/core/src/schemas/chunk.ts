import { z } from "zod";

export const ChunkSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  chunkText: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  tokenCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime()
  // Embedding vector is stored in Postgres; retrieval endpoints will not return raw vectors.
});

export type Chunk = z.infer<typeof ChunkSchema>;

