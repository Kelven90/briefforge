import { z } from "zod";

export const EvalTypeEnum = z.enum(["qa", "brief", "guardrail"]);

export const EvaluationScoreSchema = z.object({
  citationCoverage: z.number().min(0).max(1).optional(),
  schemaCompliance: z.number().min(0).max(1).optional(),
  unsupportedClaimRate: z.number().min(0).max(1).optional(),
  groundedness: z.number().min(0).max(1).optional(),
  notes: z.string().optional()
});

export const EvaluationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  evalType: EvalTypeEnum,
  scoreJson: EvaluationScoreSchema,
  createdAt: z.string().datetime()
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

