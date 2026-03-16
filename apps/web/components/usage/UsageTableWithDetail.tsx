"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AnswerRunRow } from "../../lib/answer-runs-queries";

type UsageTableWithDetailProps = {
  answerRuns: AnswerRunRow[];
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

function GroundednessBadge({ status, unsupported }: { status: string; unsupported: number }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (status === "grounded") {
    return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Grounded</span>;
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

export function UsageTableWithDetail({ answerRuns, workspaceId }: UsageTableWithDetailProps) {
  const [selectedRun, setSelectedRun] = useState<AnswerRunRow | null>(null);
  const [latestBrief, setLatestBrief] = useState<{
    version: number;
    status: string;
    content: unknown;
    createdAt: string;
  } | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const openDetail = useCallback(
    (run: AnswerRunRow) => {
      setSelectedRun(run);
      setLatestBrief(null);
      setBriefLoading(true);
      fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/briefs/latest`)
        .then((res) => (res.ok ? res.json() : { brief: null }))
        .then((data: { brief: typeof latestBrief } | null) => {
          if (data?.brief) {
            setLatestBrief({
              version: data.brief.version,
              status: data.brief.status,
              content: data.brief.content,
              createdAt: data.brief.createdAt
            });
          }
        })
        .finally(() => setBriefLoading(false));
    },
    [workspaceId]
  );

  const totalInput = answerRuns.reduce((acc, r) => acc + r.tokenInput, 0);
  const totalOutput = answerRuns.reduce((acc, r) => acc + r.tokenOutput, 0);
  const avgLatency =
    answerRuns.reduce((acc, r) => acc + r.latencyMs, 0) / Math.max(answerRuns.length, 1);
  const totalCost = answerRuns.reduce(
    (acc, r) => acc + Number(r.estimatedCost ?? 0),
    0
  );

  const citations = (run: AnswerRunRow): { chunkId: string; sourceId: string }[] => {
    const raw = run.citationsJson;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && "length" in raw) return raw as any;
    return [];
  };

  return (
    <>
      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Usage &amp; latency</h2>
          <div className="flex gap-3 text-[10px] text-slate-400">
            <span>{answerRuns.length} runs</span>
            <span>avg latency {avgLatency.toFixed(0)} ms</span>
            <span>tokens in {totalInput} / out {totalOutput}</span>
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
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(r)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openDetail(r)}
                  className={`cursor-pointer ${idx % 2 === 0 ? "bg-slate-950/60 hover:bg-slate-800/60" : "bg-slate-950/40 hover:bg-slate-800/40"}`}
                >
                  <td className="max-w-xs px-3 py-2 text-slate-100">
                    <span className="line-clamp-2">{r.question}</span>
                  </td>
                  <td className="px-3 py-2">
                    <GroundednessBadge
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

      {selectedRun && (
        <UsageDetailDrawer
          run={selectedRun}
          latestBrief={latestBrief}
          briefLoading={briefLoading}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </>
  );
}

type UsageDetailDrawerProps = {
  run: AnswerRunRow;
  latestBrief: { version: number; status: string; content: unknown; createdAt: string } | null;
  briefLoading: boolean;
  onClose: () => void;
};

function UsageDetailDrawer({ run, latestBrief, briefLoading, onClose }: UsageDetailDrawerProps) {
  const citationsList = Array.isArray(run.citationsJson)
    ? (run.citationsJson as { chunkId: string; sourceId: string }[])
    : [];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col border-t border-slate-800 bg-slate-950 shadow-xl">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-100">Answer &amp; brief record</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="space-y-4">
          <div>
            <h4 className="mb-1 text-[10px] font-medium uppercase text-slate-500">
              Question
            </h4>
            <p className="text-sm text-slate-200">{run.question}</p>
          </div>
          <div>
            <h4 className="mb-1 text-[10px] font-medium uppercase text-slate-500">Answer</h4>
            <div className="prose prose-invert max-w-prose text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {run.answerText}
              </ReactMarkdown>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
            <span>Latency: {run.latencyMs} ms</span>
            <span>Tokens: in {run.tokenInput} / out {run.tokenOutput}</span>
            <span>Est. cost: ${Number(run.estimatedCost ?? 0).toFixed(4)}</span>
            <span>
              <GroundednessBadge
                status={run.groundednessStatus}
                unsupported={run.unsupportedClaimsCount}
              />
            </span>
            <span>Citations: {citationsList.length}</span>
            <span>{formatDate(run.createdAt)}</span>
          </div>
          {citationsList.length > 0 && (
            <div>
              <h4 className="mb-1 text-[10px] font-medium uppercase text-slate-500">
                Citations
              </h4>
              <ul className="flex flex-wrap gap-1 text-[10px] text-slate-400">
                {citationsList.map((c, i) => (
                  <li
                    key={`${c.chunkId}-${i}`}
                    className="rounded-full border border-slate-700 px-2 py-0.5"
                  >
                    {c.chunkId.slice(0, 8)}… / {c.sourceId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-slate-800 pt-3">
            <h4 className="mb-1 text-[10px] font-medium uppercase text-slate-500">
              Latest brief for this workspace
            </h4>
            {briefLoading && (
              <p className="text-xs text-slate-400">Loading…</p>
            )}
            {!briefLoading && !latestBrief && (
              <p className="text-xs text-slate-400">No brief generated yet.</p>
            )}
            {!briefLoading && latestBrief && (
              <p className="text-[11px] text-slate-400">
                Latest brief: v{latestBrief.version} (generated {formatDate(latestBrief.createdAt)})
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
