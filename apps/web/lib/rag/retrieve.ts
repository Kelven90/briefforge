import { z } from "zod";
import { query } from "../db/client";
import { openai } from "../ai/client";
import { isLlmDisabled } from "../ai/toggle";

const RetrieveInputSchema = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().min(1),
  // Allow larger fan-out for brief generation; endpoints can still cap their own defaults.
  topK: z.number().int().positive().max(64).default(8)
});

export type RetrieveInput = z.infer<typeof RetrieveInputSchema>;

export const RetrievedChunkSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  chunkText: z.string(),
  score: z.number()
});

export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;

export async function retrieveRelevantChunks(input: RetrieveInput): Promise<RetrievedChunk[]> {
  const { workspaceId, question, topK } = RetrieveInputSchema.parse(input);

  // If LLMs are disabled, fall back to a cheap text search over chunks.
  if (isLlmDisabled()) {
    const { rows } = await query<RetrievedChunk & { score: number }>(
      `
        select
          c.id,
          c.source_id as "sourceId",
          c.chunk_text as "chunkText",
          0 as score
        from public.chunks c
        join public.sources s on s.id = c.source_id
        where c.workspace_id = $1
          and s.trust_level != 'blocked'
          and c.chunk_text ilike '%' || $2 || '%'
        order by c.created_at desc
        limit $3
      `,
      [workspaceId, question, topK]
    );

    return rows.map((row) =>
      RetrievedChunkSchema.parse({
        id: row.id,
        sourceId: row.sourceId,
        chunkText: row.chunkText,
        score: row.score
      })
    );
  }

  const embedModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  const embeddingResp = await openai!.embeddings.create({
    model: embedModel,
    input: question
  });

  const embedding = embeddingResp.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Failed to compute query embedding");
  }

  // pgvector expects inputs as a vector literal like `[1,2,3]`, not a JSON array.
  const embeddingLiteral = `[${embedding.join(",")}]`;

  // pgvector cosine distance: smaller is more similar, so we order ascending.
  const { rows } = await query<RetrievedChunk & { distance: number }>(
    `
      select
        c.id,
        c.source_id as "sourceId",
        c.chunk_text as "chunkText",
        (c.embedding <=> $1::vector) as distance
      from public.chunks c
      join public.sources s on s.id = c.source_id
      where c.workspace_id = $2
        and s.trust_level != 'blocked'
        and c.embedding is not null
      order by c.embedding <=> $1::vector
      limit $3
    `,
    [embeddingLiteral, workspaceId, topK]
  );

  return rows.map((row) =>
    RetrievedChunkSchema.parse({
      id: row.id,
      sourceId: row.sourceId,
      chunkText: row.chunkText,
      score: row.distance
    })
  );
}

