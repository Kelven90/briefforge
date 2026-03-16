import "dotenv/config";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const evalToken = process.env.BRIEFFORGE_EVAL_TOKEN ?? "local-eval";

async function assertOk(response: Response, description: string) {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${description} failed with ${response.status}: ${body}`);
  }
}

async function main() {
  // 1. List workspaces
  const workspacesRes = await fetch(new URL("/api/workspaces", baseUrl).toString(), {
    headers: {
      "x-internal-eval-token": evalToken
    }
  });
  await assertOk(workspacesRes, "List workspaces");
  const workspacesData = (await workspacesRes.json()) as { workspaces: { id: string }[] };
  if (!workspacesData.workspaces?.length) {
    throw new Error("Smoke test: expected at least one workspace");
  }
  const workspaceId = workspacesData.workspaces[0].id;

  // 2. QA endpoint
  const qaRes = await fetch(new URL("/api/qa/ask", baseUrl).toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-eval-token": evalToken
    },
    body: JSON.stringify({
      workspaceId,
      question: "What constraints does Acme have around launch timelines?"
    })
  });
  await assertOk(qaRes, "QA endpoint");
  const qaData = (await qaRes.json()) as {
    answerText: string;
    citations?: { chunkId: string; sourceId: string }[];
  };
  if (!qaData.answerText) {
    throw new Error("Smoke test: QA endpoint returned empty answerText");
  }

  // 3. Brief generation endpoint
  const briefRes = await fetch(new URL("/api/briefs/generate", baseUrl).toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-eval-token": evalToken
    },
    body: JSON.stringify({
      workspaceId,
      question: "Generate a high-level brief for this workspace"
    })
  });
  await assertOk(briefRes, "Brief generation endpoint");
  const briefData = (await briefRes.json()) as {
    content?: { projectName?: string };
  };
  if (!briefData.content || !briefData.content.projectName) {
    throw new Error("Smoke test: brief endpoint returned invalid content");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Smoke test failed:", err);
  process.exit(1);
});

