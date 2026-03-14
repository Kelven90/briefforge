import { z } from "zod";

export const BriefSectionCitationSchema = z.object({
  chunkId: z.string().uuid(),
  sourceId: z.string().uuid()
});

export const BriefSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  citations: z.array(BriefSectionCitationSchema)
});

export const BriefContentSchema = z.object({
  projectName: z.string(),
  goals: z.array(BriefSectionSchema),
  targetAudience: z.array(BriefSectionSchema),
  deliverables: z.array(BriefSectionSchema),
  constraints: z.array(BriefSectionSchema),
  timelineRisks: z.array(BriefSectionSchema),
  openQuestions: z.array(BriefSectionSchema)
});

export const BriefStatusEnum = z.enum(["draft", "reviewed", "approved"]);

export const BriefSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  version: z.number().int().positive(),
  status: BriefStatusEnum,
  modelName: z.string(),
  promptVersion: z.string(),
  contentJson: BriefContentSchema,
  createdAt: z.string().datetime()
});

export type Brief = z.infer<typeof BriefSchema>;
export type BriefContent = z.infer<typeof BriefContentSchema>;

