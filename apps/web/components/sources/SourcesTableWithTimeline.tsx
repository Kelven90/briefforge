"use client";

import { useMemo, useState } from "react";
import type { JobRow } from "../../lib/jobs-queries";
import type { SourceRow } from "../../lib/sources-queries";

type SourcesTableWithTimelineProps = {
  sources: SourceRow[];
  jobs: JobRow[];
};

const JOB_ORDER = ["parse", "chunk", "embed"];

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
  const [open, setOpen] = useState(false);

  const base =
    "rounded-full px-2 py-0.5 text-[10px] font-medium border border-transparent transition";

  let label = trust;
  let classes = `${base} bg-slate-500/15 text-slate-300`;
  let explanation =
    "Trust level is unknown for this source. It has not been automatically classified.";

  if (trust === "trusted") {
    label = "Trusted";
    classes = `${base} bg-emerald-500/15 text-emerald-300 border-emerald-600/40`;
    explanation =
      "This file does not look like a prompt injection and is treated as normal evidence.";
  } else if (trust === "flagged") {
    label = "Flagged";
    classes = `${base} bg-amber-500/15 text-amber-300 border-amber-600/40`;
    explanation =
      "This file contains phrases that look like prompt injection or instructions to override the model.";
  } else if (trust === "blocked") {
    label = "Blocked";
    classes = `${base} bg-red-500/15 text-red-300 border-red-600/40`;
    explanation =
      "This source is blocked from retrieval and should not be used as evidence for answers.";
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={classes}
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-56 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 shadow-xl">
          <p className="mb-0.5 font-semibold text-slate-100">Trust level: {label}</p>
          <p className="text-[10px] text-slate-300">{explanation}</p>
        </div>
      )}
    </span>
  );
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
  if (status === "queued") {
    return <span className={`${base} bg-amber-500/15 text-amber-300`}>Queued</span>;
  }
  return <span className={`${base} bg-slate-500/15 text-slate-300`}>{status}</span>;
}

function StageDot({
  label,
  status
}: {
  label: string;
  status: string | null;
}) {
  let color = "bg-slate-600";
  if (status === "completed") color = "bg-emerald-400";
  else if (status === "running") color = "bg-sky-400";
  else if (status === "queued") color = "bg-amber-400";
  else if (status === "failed") color = "bg-red-400";

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

type PipelineSummary = {
  parseStatus: string | null;
  chunkStatus: string | null;
  embedStatus: string | null;
  attempts: number;
};

function summarizePipeline(jobs: JobRow[]): PipelineSummary {
  const stages: Record<string, { status: string | null; attempts: number }> = {
    parse: { status: null, attempts: 0 },
    chunk: { status: null, attempts: 0 },
    embed: { status: null, attempts: 0 }
  };

  for (const job of jobs) {
    if (job.jobType in stages) {
      stages[job.jobType].attempts += 1;
      stages[job.jobType].status = job.status;
    }
  }

  const attempts =
    stages.parse.attempts + stages.chunk.attempts + stages.embed.attempts;

  return {
    parseStatus: stages.parse.status,
    chunkStatus: stages.chunk.status,
    embedStatus: stages.embed.status,
    attempts
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

export function SourcesTableWithTimeline({ sources, jobs }: SourcesTableWithTimelineProps) {
  const [selectedSource, setSelectedSource] = useState<SourceRow | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const jobsBySource = useMemo(() => {
    const map = new Map<string, JobRow[]>();
    for (const job of jobs) {
      if (!job.sourceId) continue;
      const existing = map.get(job.sourceId) ?? [];
      existing.push(job);
      map.set(job.sourceId, existing);
    }
    return map;
  }, [jobs]);

  const jobsForSource = selectedSource
    ? (jobsBySource.get(selectedSource.id) ?? []).sort((a, b) => {
        const ai = JOB_ORDER.indexOf(a.jobType);
        const bi = JOB_ORDER.indexOf(b.jobType);
        if (ai !== bi) return ai - bi;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
    : [];

  return (
    <>
      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Sources</h2>
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-300 hover:bg-slate-800"
              aria-label="What is the sources section?"
            >
              i
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{sources.length} files</span>
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label={collapsed ? "Expand sources" : "Collapse sources"}
            >
              {collapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        </div>
        {showInfo && (
          <p className="text-[10px] text-slate-400">
            This section lists the files in your workspace and shows their indexing status and trust
            level for grounded Q&amp;A.
          </p>
        )}
        {!collapsed && (
          <>
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
                      <th className="px-3 py-2 font-medium text-slate-300">Indexing</th>
                      <th className="px-3 py-2 font-medium text-slate-300">Trust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s, idx) => (
                      <tr
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedSource(s)}
                        onKeyDown={(e) =>
                          (e.key === "Enter" || e.key === " ") && setSelectedSource(s)
                        }
                        className={`cursor-pointer ${idx % 2 === 0 ? "bg-slate-950/60 hover:bg-slate-800/60" : "bg-slate-950/40 hover:bg-slate-800/40"}`}
                      >
                        <td className="px-3 py-2 text-slate-100">{s.fileName}</td>
                        <td className="px-3 py-2 text-slate-300">{s.fileType}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-400">
                          {(() => {
                            const pipeline = summarizePipeline(jobsBySource.get(s.id) ?? []);
                            if (pipeline.attempts === 0) return "No jobs yet";
                            const retries = Math.max(0, pipeline.attempts - 3);
                            return (
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                  <StageDot label="Parse" status={pipeline.parseStatus} />
                                  <StageDot label="Chunk" status={pipeline.chunkStatus} />
                                  <StageDot label="Embed" status={pipeline.embedStatus} />
                                </div>
                                {/* {retries > 0 && (
                                  <p className="text-[9px] text-slate-500">
                                    Retries: {retries}
                                  </p>
                                )} */}
                              </div>
                            );
                          })()}
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
          </>
        )}
      </div>

      {selectedSource && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[50vh] flex-col border-t border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Jobs for {selectedSource.fileName}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedSource(null)}
              className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {jobsForSource.length === 0 ? (
              <p className="text-xs text-slate-400">No jobs recorded for this source yet.</p>
            ) : (
              <ul className="space-y-2">
                {jobsForSource.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px]"
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
