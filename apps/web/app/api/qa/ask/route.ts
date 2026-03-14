import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "../../../../lib/api/auth";
import { retrieveRelevantChunks } from "../../../../lib/rag/retrieve";
import { openai } from "../../../../lib/ai/client";
import { isLlmDisabled } from "../../../../lib/ai/toggle";
import { estimateChatCostUsd } from "../../../../lib/ai/cost";
import { AnswerCitationSchema } from "@briefforge/core";
import { query } from "../../../../lib/db/client";

const AskBodySchema = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().min(1),
  topK: z.number().int().positive().max(20).optional()
});

const QaModelAnswerSchema = z.object({
  answerText: z.string(),
  citations: z.array(AnswerCitationSchema)
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);

  const parsed = AskBodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body", issues: parsed.error.issues }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const { workspaceId, question, topK } = parsed.data;

  // Ensure workspace belongs to user
  const workspaceCheck = await query<{ id: string }>(
    `select id from public.workspaces where id = $1 and owner_id = $2 limit 1`,
    [workspaceId, auth.user.id]
  );
  if (!workspaceCheck.rows[0]) {
    return new Response(JSON.stringify({ error: "Workspace not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }

  const started = Date.now();
  const chunks = await retrieveRelevantChunks({
    workspaceId,
    question,
    topK: topK ?? 8
  });

  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";

  const contextText = chunks
    .map(
      (c, idx) =>
        `Chunk ${idx + 1} (chunkId=${c.id}, sourceId=${c.sourceId}):\n${c.chunkText}`
    )
    .join("\n\n");

  const systemPrompt = `
You are BriefForge. Answer the user's question using ONLY the provided chunks.

You MUST:
- not invent facts beyond what is supported by the chunks
- explicitly admit when the answer is not present
- return JSON with the following shape and nothing else:

{
  "answerText": string,
  "citations": Array<{ "chunkId": string, "sourceId": string }>
}

Every non-trivial statement in answerText should be backed by at least one citation.
Return ONLY JSON. No markdown fences. No additional keys.
`.trim();

  const userPrompt = `
Question:
${question}

Context chunks:
${contextText}
`.trim();
  let parsedAnswer: z.infer<typeof QaModelAnswerSchema>;
  let latencyMs = 0;
  let tokenInput = 0;
  let tokenOutput = 0;
  let estimatedCost = 0;

  if (isLlmDisabled()) {
    // Cheap, obviously stubbed answer using real retrieved chunks.
    const combined = chunks.map((c) => c.chunkText).join("\n\n");
    parsedAnswer = QaModelAnswerSchema.parse({
      answerText: `[LLM DISABLED] Using retrieved chunks only.\n\n${combined.slice(
        0,
        2000
      )}`,
      citations: chunks.map((c) => ({ chunkId: c.id, sourceId: c.sourceId }))
    });
  } else {
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
      parsedAnswer = QaModelAnswerSchema.parse(JSON.parse(raw));
    } catch (err) {
      return new Response(JSON.stringify({ error: "Model returned invalid JSON", raw }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
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

  const { rows } = await query<{ id: string }>(
    `
      insert into public.answer_runs (
        workspace_id,
        question,
        answer_text,
        citations_json,
        groundedness_status,
        unsupported_claims_count,
        latency_ms,
        token_input,
        token_output,
        estimated_cost
      )
      values ($1, $2, $3, $4::jsonb, 'unknown', 0, $5, $6, $7, $8)
      returning id
    `,
    [
      workspaceId,
      question,
      parsedAnswer.answerText,
      JSON.stringify(parsedAnswer.citations),
      latencyMs,
      tokenInput,
      tokenOutput,
      estimatedCost
    ]
  );

  const answerRunId = rows[0].id;

  return new Response(
    JSON.stringify({
      id: answerRunId,
      workspaceId,
      question,
      answerText: parsedAnswer.answerText,
      citations: parsedAnswer.citations,
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

