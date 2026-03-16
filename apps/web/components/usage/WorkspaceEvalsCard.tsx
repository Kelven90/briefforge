"use client";

import { useState } from "react";
import type { EvaluationRow } from "../../lib/evals-queries";

type Props = {
  evaluations: EvaluationRow[];
};

export function WorkspaceEvalsCard({ evaluations }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  if (evaluations.length === 0) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Evals (QA &amp; brief)</h2>
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-300 hover:bg-slate-800"
              aria-label="What is the evals section?"
            >
              i
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        {showInfo && (
          <p className="text-[10px] text-slate-400">
            This section shows results from automated eval runs that hit the same QA and brief
            endpoints as the UI.
          </p>
        )}
        {!collapsed && (
          <p className="text-xs text-slate-400">
            No eval runs recorded yet. From the repo root, run{" "}
            <code className="font-mono">pnpm evals</code> to exercise QA and brief endpoints.
          </p>
        )}
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

  const lastRunLabel = evaluations[0]?.createdAt
    ? new Date(evaluations[0].createdAt).toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short"
      })
    : "—";

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Evals (QA &amp; brief)</h2>
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-300 hover:bg-slate-800"
              aria-label="What is the evals section?"
            >
              i
            </button>
          </div>
          <span className="text-[10px] text-slate-400">Last run {lastRunLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="h-6 rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {showInfo && (
        <p className="mb-1 text-[10px] text-slate-400">
          This section shows results from automated eval runs that hit the same QA and brief
          endpoints as the UI.
        </p>
      )}
      {!collapsed && (
        <>
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
          <p className="mt-2 text-[10px] text-slate-500">
            Evals call the same endpoints as the UI using seeded Acme data to catch regressions in
            grounding and brief structure.
          </p>
        </>
      )}
    </section>
  );
}

