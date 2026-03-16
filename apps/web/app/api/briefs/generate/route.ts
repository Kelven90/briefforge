import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "../../../../lib/api/auth";
import { retrieveRelevantChunks } from "../../../../lib/rag/retrieve";
import { openai } from "../../../../lib/ai/client";
import { isLlmDisabled } from "../../../../lib/ai/toggle";
import { estimateChatCostUsd } from "../../../../lib/ai/cost";
import { BriefContentSchema } from "@briefforge/core";
import { generateBriefSystemPrompt, generateBriefUserPrompt, BRIEF_PROMPT_VERSION } from "@briefforge/prompts";
import { query } from "../../../../lib/db/client";

const GenerateBriefBodySchema = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().optional(),
  topK: z.number().int().positive().max(50).optional(),
  feedback: z.string().max(2000).optional()
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = GenerateBriefBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", issues: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { workspaceId, question, topK, feedback } = parsed.data;

  // Ensure workspace belongs to user and get name
  const workspaceRes = await query<{ id: string; name: string }>(
    `select id, name from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [workspaceId, auth.user.id]
  );
  const workspace = workspaceRes.rows[0];
  if (!workspace) {
    return new Response(JSON.stringify({ error: "Workspace not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  const started = Date.now();
  const chunks = await retrieveRelevantChunks({
    workspaceId,
    question: question ?? "Generate a client brief based on this workspace.",
    topK: topK ?? 24
  });

  const model = process.env.OPENAI_STRICT_MODEL ?? "gpt-4.1";

  let briefContent;
  let latencyMs = 0;
  let tokenInput = 0;
  let tokenOutput = 0;
  let estimatedCost = 0;

  if (isLlmDisabled()) {
    // Cheap, obviously stubbed brief built from retrieved chunks.
    const text = chunks.map((c) => c.chunkText).join("\n\n").slice(0, 2000);
    briefContent = BriefContentSchema.parse({
      projectName: `[LLM DISABLED] Stub brief for ${workspace.name}`,
      goals: [
        {
          id: "goal-1",
          title: "Summarized goals from chunks",
          content: text,
          citations: chunks.map((c) => ({ chunkId: c.id, sourceId: c.sourceId }))
        }
      ],
      targetAudience: [],
      deliverables: [],
      constraints: [],
      timelineRisks: [],
      openQuestions: []
    });
  } else {
    const evidenceText = chunks
      .map(
        (c, idx) =>
          `Chunk ${idx + 1} (chunkId=${c.id}, sourceId=${c.sourceId}):\n${c.chunkText}`
      )
      .join("\n\n");

    const systemPrompt = generateBriefSystemPrompt();
    const userPrompt = `
${generateBriefUserPrompt({
  workspaceName: workspace.name,
  question
})}

${feedback ? `Reviewer feedback on the previous draft (if any): ${feedback}\n` : ""}Context chunks:
${evidenceText}
`.trim();

    const completion = await openai!.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    latencyMs = Date.now() - started;

    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      briefContent = BriefContentSchema.parse(JSON.parse(raw));
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Model returned invalid BriefContent JSON",
          raw
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" }
        }
      );
    }

    const tokenUsage = completion.usage;
    tokenInput = tokenUsage?.prompt_tokens ?? 0;
    tokenOutput = tokenUsage?.completion_tokens ?? 0;
    estimatedCost = estimateChatCostUsd({
      model,
      promptTokens: tokenInput,
      completionTokens: tokenOutput
    });
  }

  // Determine next version number
  const versionRes = await query<{ max: number | null }>(
    `select max(version) as max from public.briefs where workspace_id = $1`,
    [workspaceId]
  );
  const nextVersion = (versionRes.rows[0]?.max ?? 0) + 1;

  const { rows } = await query<{ id: string }>(
    `
      insert into public.briefs (
        workspace_id,
        version,
        status,
        model_name,
        prompt_version,
        content_json
      )
      values ($1, $2, 'draft', $3, $4, $5::jsonb)
      returning id
    `,
    [workspaceId, nextVersion, model, BRIEF_PROMPT_VERSION, JSON.stringify(briefContent)]
  );

  const briefId = rows[0].id;

  return new Response(
    JSON.stringify({
      id: briefId,
      workspaceId,
      version: nextVersion,
      modelName: model,
      promptVersion: BRIEF_PROMPT_VERSION,
      content: briefContent,
      latencyMs,
      tokenInput,
      tokenOutput,
      estimatedCost
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
}

