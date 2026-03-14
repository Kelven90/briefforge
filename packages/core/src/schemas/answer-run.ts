import { z } from "zod";

export const AnswerCitationSchema = z.object({
  chunkId: z.string().uuid(),
  sourceId: z.string().uuid()
});

export const GroundednessStatusEnum = z.enum(["unknown", "grounded", "partially_grounded", "unsupported"]);

export const AnswerRunSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  question: z.string(),
  answerText: z.string(),
  citationsJson: z.array(AnswerCitationSchema),
  groundednessStatus: GroundednessStatusEnum,
  unsupportedClaimsCount: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  tokenInput: z.number().int().nonnegative(),
  tokenOutput: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  createdAt: z.string().datetime()
});

export type AnswerRun = z.infer<typeof AnswerRunSchema>;

