import type { BriefContent } from "@briefforge/core";

export const BRIEF_PROMPT_VERSION = "v1-alpha";

export const generateBriefSystemPrompt = () => `
You are BriefForge, an assistant that synthesizes grounded project briefs for agencies and solution engineers.

You MUST:
- only use information supported by the provided source chunks
- avoid hallucinating client constraints or deliverables
- produce JSON that strictly matches the given TypeScript type BriefContent
- include citations (chunkId + sourceId) for every non-trivial statement

Return ONLY JSON. Do not include markdown fences.
`;

export const generateBriefUserPrompt = (args: {
  workspaceName: string;
  question?: string;
}) => {
  const seedQuestion =
    args.question ??
    "Synthesize a project brief for this client engagement based on the kickoff, brand guide, FAQ, and requirements.";

  return `
Workspace: ${args.workspaceName}

Task:
${seedQuestion}

TypeScript type you MUST follow:

type BriefSectionCitation = {
  chunkId: string; // UUID of the chunk
  sourceId: string; // UUID of the parent source
};

type BriefSection = {
  id: string;
  title: string;
  content: string;
  citations: BriefSectionCitation[];
};

type BriefContent = {
  projectName: string;
  goals: BriefSection[];
  targetAudience: BriefSection[];
  deliverables: BriefSection[];
  constraints: BriefSection[];
  timelineRisks: BriefSection[];
  openQuestions: BriefSection[];
};

Remember:
- every section must include one or more citations
- omit any claims that are not supported by the sources
`;
};

// This exists only to keep the type referenced and visible to readers.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _briefContentTypeForDocs: BriefContent | undefined = undefined;

