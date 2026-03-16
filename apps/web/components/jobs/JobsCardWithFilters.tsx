"use client";

import { useMemo, useState } from "react";
import type { JobRow } from "../../lib/jobs-queries";
import { JobRetryButton } from "./JobRetryButton";

type JobsCardWithFiltersProps = {
  jobs: JobRow[];
  workspaceId: string;
};

function formatDate(iso: string) {
  try {
    // Use a fixed locale so server and client render the same string.
    return new Date(iso).toLocaleString("en-GB", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return iso;
  }
}

type PipelineSummary = {
  parseStatus: string | null;
  chunkStatus: string | null;
  embedStatus: string | null;
  attempts: number;
  hasFailure: boolean;
  inFlight: boolean;
};

type SourcePipeline = {
  sourceId: string;
  fileName: string | null;
  summary: PipelineSummary;
  jobs: JobRow[];
};

function summarizePipeline(jobs: JobRow[]): PipelineSummary {
  const stages: Record<string, { status: string | null; attempts: number }> = {
    parse: { status: null, attempts: 0 },
    chunk: { status: null, attempts: 0 },
    embed: { status: null, attempts: 0 }
  };

  let hasFailure = false;
  let inFlight = false;

  for (const job of jobs) {
    if (job.jobType in stages) {
      stages[job.jobType].attempts += 1;
      stages[job.jobType].status = job.status;
    }
    if (job.status === "failed") hasFailure = true;
    if (job.status === "queued" || job.status === "running") inFlight = true;
  }

  const attempts =
    stages.parse.attempts + stages.chunk.attempts + stages.embed.attempts;

  return {
    parseStatus: stages.parse.status,
    chunkStatus: stages.chunk.status,
    embedStatus: stages.embed.status,
    attempts,
    hasFailure,
    inFlight
  };
}

function describeStage(status: string | null): string {
  if (!status) return "—";
  if (status === "completed") return "✓";
  if (status === "running") return "●";
  if (status === "queued") return "…";
  if (status === "failed") return "✕";
  return status;
}

type Filter = "all" | "failures" | "in_flight";

function JobStatusBadge({ status }: { status: string }) {
  const base = "rounded-full px-1.5 py-0.5 text-[9px] font-medium";
  if (status === "completed") {
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Completed</span>;
  }
  if (status === "running") {
    return <span className={`${base} bg-sky-500/15 text-sky-300`}>Running</span>;
  }
  if (status === "failed") {
    return <span className={`${base} bg-red-500/15 text-red-300`}>Failed</span>;
  }
  if (status === "queued") {
    return <span className={`${base} bg-amber-500/15 text-amber-300`}>Queued</span>;
  }
  return <span className={`${base} bg-slate-500/15 text-slate-300`}>{status}</span>;
}

function StageChip({
  label,
  status
}: {
  label: string;
  status: string | null;
}) {
  const base =
    "rounded-full px-1.5 py-0.5 text-[9px] font-medium border border-slate-700 bg-slate-900/80";
  let color = "text-slate-300";
  if (status === "completed") color = "text-emerald-300 border-emerald-600/50";
  else if (status === "running") color = "text-sky-300 border-sky-600/60";
  else if (status === "queued") color = "text-amber-300 border-amber-600/60";
  else if (status === "failed") color = "text-red-300 border-red-600/60";

  return <span className={`${base} ${color}`}>{label}</span>;
}

export function JobsCardWithFilters({ jobs, workspaceId }: JobsCardWithFiltersProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState(true);
  const [selected, setSelected] = useState<SourcePipeline | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const pipelines = useMemo(() => {
    const bySource = new Map<string, JobRow[]>();

    for (const job of jobs) {
      if (!job.sourceId) continue; // skip jobs not tied to a source
      const existing = bySource.get(job.sourceId) ?? [];
      existing.push(job);
      bySource.set(job.sourceId, existing);
    }

    const result: SourcePipeline[] = [];
    for (const [sourceId, sourceJobs] of bySource) {
      const sorted = [...sourceJobs].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const summary = summarizePipeline(sorted);
      result.push({
        sourceId,
        fileName: sorted[0]?.sourceFileName ?? null,
        summary,
        jobs: sorted
      });
    }

    return result;
  }, [jobs]);

  const filtered = pipelines.filter((p) => {
    if (filter === "all") return true;
    if (filter === "failures") return p.summary.hasFailure;
    if (filter === "in_flight") return p.summary.inFlight;
    return true;
  });

  return (
    <>
      <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Jobs (indexing pipeline)</h2>
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-300 hover:bg-slate-800"
              aria-label="What is the indexing jobs section?"
            >
              i
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label={collapsed ? "Expand jobs" : "Collapse jobs"}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
            {!collapsed && (
              <>
                <span className="text-[10px] text-slate-500">Show:</span>
                {(["all", "in_flight", "failures"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      filter === f
                        ? "bg-sky-500/20 text-sky-300"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {f === "all" ? "All" : f === "in_flight" ? "In flight" : "Recent failures"}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
        {showInfo && (
          <p className="text-[10px] text-slate-400">
            This section shows parse → chunk → embed jobs per source so you can see which stage of
            the indexing pipeline is running, stuck, or failing.
          </p>
        )}
        {!collapsed && (
          <>
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400">
                {filter === "all"
                  ? "No jobs yet. Upload a source to enqueue parse → chunk → embed."
                  : filter === "failures"
                    ? "No failed pipelines."
                    : "No pipelines in progress."}
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-800">
                <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-3 py-2 font-medium text-slate-300">Source</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Pipeline</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Retries</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Latest status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, idx) => {
                      const latestJob = p.jobs[p.jobs.length - 1];
                      return (
                        <tr
                          key={p.sourceId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelected(p)}
                          onKeyDown={(e) =>
                            (e.key === "Enter" || e.key === " ") && setSelected(p)
                          }
                          className={`cursor-pointer ${
                            idx % 2 === 0
                              ? "bg-slate-950/60 hover:bg-slate-800/60"
                              : "bg-slate-950/40 hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="max-w-xs px-3 py-2 text-slate-100">
                            <span className="line-clamp-2">
                              {p.fileName ?? "Untitled source"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[10px] text-slate-300">
                            <span className="inline-flex gap-1">
                              <StageChip label="Parse" status={p.summary.parseStatus} />
                              <StageChip label="Chunk" status={p.summary.chunkStatus} />
                              <StageChip label="Embed" status={p.summary.embedStatus} />
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {Math.max(0, (p.summary.attempts || 0) - 3)}
                          </td>
                          <td className="px-3 py-2">
                            {latestJob ? (
                              <JobStatusBadge status={latestJob.status} />
                            ) : (
                              <span className="text-[10px] text-slate-400">No jobs yet</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[60vh] flex-col border-t border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Jobs for {selected.fileName ?? "Untitled source"}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {selected.jobs.length === 0 ? (
              <p className="text-xs text-slate-400">No jobs recorded for this source.</p>
            ) : (
              <ul className="space-y-2 text-[11px]">
                {selected.jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-slate-800 bg-slate-900/60 px-3 py-2"
                  >
                    <span className="font-medium text-slate-200">{job.jobType}</span>
                    <JobStatusBadge status={job.status} />
                    <span className="text-slate-400">
                      Started: {job.startedAt ? formatDate(job.startedAt) : "—"}
                    </span>
                    <span className="text-slate-400">
                      Completed: {job.completedAt ? formatDate(job.completedAt) : "—"}
                    </span>
                    <span className="text-slate-500">Attempts: {job.attempts}</span>
                    {job.status === "failed" && job.sourceId && (
                      <span className="ml-auto">
                        <JobRetryButton jobId={job.id} workspaceId={workspaceId} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
