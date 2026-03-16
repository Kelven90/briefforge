"use client";

import { useState } from "react";
import type { AnswerRunRow } from "../../lib/answer-runs-queries";
import { UsageTableWithDetail } from "./UsageTableWithDetail";

type Props = {
  answerRuns: AnswerRunRow[];
  workspaceId: string;
};

export function WorkspaceUsageCard({ answerRuns, workspaceId }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  if (answerRuns.length === 0) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Usage &amp; latency</h2>
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-300 hover:bg-slate-800"
              aria-label="What is the usage section?"
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
            This section summarizes recent Q&amp;A runs: latency, tokens, and cost so you can see
            how the demo is behaving under real questions.
          </p>
        )}
        {!collapsed && (
          <p className="text-xs text-slate-400">
            No answers yet for this workspace. Ask a grounded question to start tracking latency and
            token usage.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Usage &amp; latency</h2>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-300 hover:bg-slate-800"
            aria-label="What is the usage section?"
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
        <p className="mb-1 text-[10px] text-slate-400">
          This section summarizes recent Q&amp;A runs: latency, tokens, and cost so you can see how
          the demo is behaving under real questions.
        </p>
      )}
      {!collapsed && (
        <UsageTableWithDetail answerRuns={answerRuns} workspaceId={workspaceId} />
      )}
    </section>
  );
}

