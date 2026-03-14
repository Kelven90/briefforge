import { notFound } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth/session";
import { getWorkspaceForUser } from "../../../../lib/workspaces";
import { listSourcesForWorkspace } from "../../../../lib/sources-queries";
import { listRecentJobsForWorkspace } from "../../../../lib/jobs-queries";
import { listRecentAnswerRunsForWorkspace } from "../../../../lib/answer-runs-queries";
import { listRecentEvaluationsForWorkspace } from "../../../../lib/evals-queries";
import { QaPanel } from "../../../../components/qa/QaPanel";
import { BriefPanel } from "../../../../components/brief/BriefPanel";
import { SourceUploadPanel } from "../../../../components/source/SourceUploadPanel";
import { JobRetryButton } from "../../../../components/jobs/JobRetryButton";

type PageProps = {
  params: { workspaceId: string };
};

export default async function WorkspaceDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const userId = (user as { id?: string } | null)?.id;
  if (!userId) {
    notFound();
  }

  const workspace = await getWorkspaceForUser(userId, params.workspaceId);
  if (!workspace) {
    notFound();
  }

  const [sources, jobs, answerRuns, evaluations] = await Promise.all([
    listSourcesForWorkspace(workspace.id),
    listRecentJobsForWorkspace(workspace.id, 8),
    listRecentAnswerRunsForWorkspace(workspace.id, 8),
    listRecentEvaluationsForWorkspace(workspace.id, 4)
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Workspace</p>
          <h1 className="text-xl font-semibold text-slate-50">{workspace.name}</h1>
          {workspace.description && (
            <p className="mt-1 text-xs text-slate-400 max-w-xl">{workspace.description}</p>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-4">
          <SourceUploadPanel workspaceId={workspace.id} />
          <JobsCard jobs={jobs} workspaceId={workspace.id} />
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Sources</h2>
              <span className="text-xs text-slate-400">{sources.length} files</span>
            </div>
            {sources.length === 0 ? (
              <p className="text-xs text-slate-400">
                No sources yet. In the seeded demo, this list will include kickoff, brand guide,
                FAQ, and a malicious prompt injection sample.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-800">
                <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-3 py-2 font-medium text-slate-300">File</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Type</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Status</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Trust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s, idx) => (
                      <tr
                        key={s.id}
                        className={idx % 2 === 0 ? "bg-slate-950/60" : "bg-slate-950/40"}
                      >
                        <td className="px-3 py-2 text-slate-100">{s.fileName}</td>
                        <td className="px-3 py-2 text-slate-300">{s.fileType}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-2">
                          <TrustBadge trust={s.trustLevel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <QaPanel workspaceId={workspace.id} />
          <BriefPanel workspaceId={workspace.id} />
          <WorkspaceUsageCard answerRuns={answerRuns} />
          <WorkspaceEvalsCard evaluations={evaluations} />
        </div>
      </div>
    </main>
  );
}

function JobsCard({
  jobs,
  workspaceId
}: {
  jobs: Awaited<ReturnType<typeof listRecentJobsForWorkspace>>;
  workspaceId: string;
}) {
  return (
    <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Jobs (indexing pipeline)</h2>
        <span className="text-xs text-slate-400">{jobs.length} recent</span>
      </div>
      {jobs.length === 0 ? (
        <p className="text-xs text-slate-400">No jobs yet. Upload a source to enqueue parse → chunk → embed.</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-800">
          <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-300">Type</th>
                <th className="px-3 py-2 font-medium text-slate-300">Status</th>
                <th className="px-3 py-2 font-medium text-slate-300">Source</th>
                <th className="px-3 py-2 font-medium text-slate-300">Started</th>
                <th className="px-3 py-2 font-medium text-slate-300">Completed</th>
                <th className="px-3 py-2 font-medium text-slate-300">Attempts</th>
                <th className="px-3 py-2 font-medium text-slate-300">Retry</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr
                  key={job.id}
                  className={idx % 2 === 0 ? "bg-slate-950/60" : "bg-slate-950/40"}
                >
                  <td className="px-3 py-2 text-slate-100">{job.jobType}</td>
                  <td className="px-3 py-2">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {job.sourceFileName ?? (job.sourceId ? "—" : "—")}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {job.startedAt ? formatDate(job.startedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {job.completedAt ? formatDate(job.completedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{job.attempts}</td>
                  <td className="px-3 py-2">
                    {job.status === "failed" && job.sourceId ? (
                      <JobRetryButton jobId={job.id} workspaceId={workspaceId} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function JobStatusBadge({ status }: { status: string }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (status === "completed") {
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Completed</span>;
  }
  if (status === "running") {
    return <span className={`${base} bg-sky-500/15 text-sky-300`}>Running</span>;
  }
  if (status === "failed") {
    return <span className={`${base} bg-red-500/15 text-red-300`}>Failed</span>;
  }
  return <span className={`${base} bg-slate-500/15 text-slate-300`}>{status}</span>;
}

function WorkspaceUsageCard({
  answerRuns
}: {
  answerRuns: Awaited<ReturnType<typeof listRecentAnswerRunsForWorkspace>>;
}) {
  if (answerRuns.length === 0) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-100">Usage</h2>
        <p className="text-xs text-slate-400">
          No answers yet for this workspace. Ask a grounded question to start tracking latency and
          token usage.
        </p>
      </section>
    );
  }

  const totalInput = answerRuns.reduce((acc, r) => acc + r.tokenInput, 0);
  const totalOutput = answerRuns.reduce((acc, r) => acc + r.tokenOutput, 0);
  const avgLatency =
    answerRuns.reduce((acc, r) => acc + r.latencyMs, 0) / Math.max(answerRuns.length, 1);
  const totalCost = answerRuns.reduce(
    (acc, r) => acc + Number(r.estimatedCost ?? 0),
    0
  );

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Usage (recent answers)</h2>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <span>{answerRuns.length} runs</span>
          <span>avg latency {avgLatency.toFixed(0)} ms</span>
          <span>
            tokens in {totalInput} / out {totalOutput}
          </span>
          <span>est. cost ${totalCost ? totalCost.toFixed(4) : "0.0000"}</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-800">
        <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
          <thead className="bg-slate-950">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-300">Question</th>
              <th className="px-3 py-2 font-medium text-slate-300">Groundedness</th>
              <th className="px-3 py-2 font-medium text-slate-300">Latency</th>
              <th className="px-3 py-2 font-medium text-slate-300">Tokens</th>
              <th className="px-3 py-2 font-medium text-slate-300">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {answerRuns.map((r, idx) => (
              <tr
                key={r.id}
                className={idx % 2 === 0 ? "bg-slate-950/60" : "bg-slate-950/40"}
              >
                <td className="max-w-xs px-3 py-2 text-slate-100">
                  <span className="line-clamp-2">{r.question}</span>
                </td>
                <td className="px-3 py-2">
                  <UsageGroundednessBadge
                    status={r.groundednessStatus}
                    unsupported={r.unsupportedClaimsCount}
                  />
                </td>
                <td className="px-3 py-2 text-slate-300">{r.latencyMs.toFixed(0)} ms</td>
                <td className="px-3 py-2 text-slate-300">
                  in {r.tokenInput} / out {r.tokenOutput}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {Number(r.estimatedCost ?? 0)
                    ? `$${Number(r.estimatedCost).toFixed(4)}`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkspaceEvalsCard({
  evaluations
}: {
  evaluations: Awaited<ReturnType<typeof listRecentEvaluationsForWorkspace>>;
}) {
  if (evaluations.length === 0) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-100">Evals</h2>
        <p className="text-xs text-slate-400">
          No eval runs recorded yet. From the repo root, run <code className="font-mono">pnpm
          evals</code> to exercise QA and brief endpoints.
        </p>
      </section>
    );
  }

  const latestQa = evaluations.find((e) => e.evalType === "qa");
  const latestBrief = evaluations.find((e) => e.evalType === "brief");

  const qaSummary = latestQa?.scoreJson?.summary as
    | { passed: number; total: number; avgLatencyMs: number }
    | undefined;
  const briefSummary = latestBrief?.scoreJson?.summary as
    | { passed: number; total: number; avgLatencyMs: number }
    | undefined;

  return (
    <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Evals</h2>
        <span className="text-[10px] text-slate-400">
          Last run {evaluations[0]?.createdAt ? new Date(evaluations[0].createdAt).toLocaleString() : "—"}
        </span>
      </div>
      <div className="space-y-1 text-xs text-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">QA</span>
          <span className="text-slate-200">
            {qaSummary
              ? `${qaSummary.passed}/${qaSummary.total} passed · avg ${qaSummary.avgLatencyMs.toFixed(
                  0
                )} ms`
              : "No runs"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Briefs</span>
          <span className="text-slate-200">
            {briefSummary
              ? `${briefSummary.passed}/${briefSummary.total} passed · avg ${briefSummary.avgLatencyMs.toFixed(
                  0
                )} ms`
              : "No runs"}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">
        Evals call the same endpoints as the UI using seeded Acme data to catch regressions in
        grounding and brief structure.
      </p>
    </section>
  );
}

function UsageGroundednessBadge({
  status,
  unsupported
}: {
  status: string;
  unsupported: number;
}) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (status === "grounded") {
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-300`}>
        Grounded
      </span>
    );
  }
  if (status === "unsupported") {
    return (
      <span className={`${base} bg-red-500/15 text-red-300`}>
        Unsupported{unsupported ? ` ~${unsupported}` : ""}
      </span>
    );
  }
  if (status === "partially_grounded") {
    return (
      <span className={`${base} bg-amber-500/15 text-amber-300`}>
        Partial{unsupported ? ` ~${unsupported}` : ""}
      </span>
    );
  }
  return <span className={`${base} bg-slate-500/15 text-slate-300`}>—</span>;
}

function StatusBadge({ status }: { status: string }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (status === "indexed") {
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Indexed</span>;
  }
  if (status === "parsing") {
    return <span className={`${base} bg-sky-500/15 text-sky-300`}>Parsing</span>;
  }
  if (status === "failed") {
    return <span className={`${base} bg-red-500/15 text-red-300`}>Failed</span>;
  }
  if (status === "blocked") {
    return <span className={`${base} bg-amber-500/15 text-amber-300`}>Blocked</span>;
  }
  return <span className={`${base} bg-slate-500/15 text-slate-300`}>{status}</span>;
}

function TrustBadge({ trust }: { trust: string }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (trust === "trusted") {
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Trusted</span>;
  }
  if (trust === "flagged") {
    return <span className={`${base} bg-amber-500/15 text-amber-300`}>Flagged</span>;
  }
  if (trust === "blocked") {
    return <span className={`${base} bg-red-500/15 text-red-300`}>Blocked</span>;
  }
  return <span className={`${base} bg-slate-500/15 text-slate-300`}>{trust}</span>;
}

