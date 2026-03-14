"use client";

import { useState } from "react";

type BriefSection = {
  id: string;
  title: string;
  content: string;
  citations: { chunkId: string; sourceId: string }[];
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

type BriefPanelProps = {
  workspaceId: string;
};

type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      brief: BriefContent;
      latencyMs: number;
    };

export function BriefPanel({ workspaceId }: BriefPanelProps) {
  const [state, setState] = useState<BriefState>({ status: "idle" });

  async function handleGenerate() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/briefs/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      const data = await res.json();
      setState({
        status: "done",
        brief: data.content,
        latencyMs: data.latencyMs ?? 0
      });
    } catch (err: any) {
      setState({ status: "error", message: err.message ?? "Unknown error" });
    }
  }

  const disabled = state.status === "loading";

  return (
    <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Structured brief</h2>
          <p className="text-xs text-slate-400">
            Generates a draft brief backed by citations into this workspace.
          </p>
        </div>
        {state.status === "done" && (
          <span className="text-xs text-slate-400">
            Latency: {state.latencyMs.toFixed(0)} ms
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={disabled}
        className="inline-flex items-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {disabled ? "Generating..." : "Generate brief"}
      </button>
      {state.status === "error" && (
        <p className="text-xs text-red-400">{state.message}</p>
      )}
      {state.status === "done" && (
        <BriefSections brief={state.brief} />
      )}
    </section>
  );
}

function BriefSections({ brief }: { brief: BriefContent }) {
  const sections: { label: string; items: BriefSection[] }[] = [
    { label: "Goals", items: brief.goals },
    { label: "Target audience", items: brief.targetAudience },
    { label: "Deliverables", items: brief.deliverables },
    { label: "Constraints", items: brief.constraints },
    { label: "Timeline & risks", items: brief.timelineRisks },
    { label: "Open questions", items: brief.openQuestions }
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Project
        </p>
        <p className="text-sm font-medium text-slate-100">{brief.projectName}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <div key={section.label} className="space-y-2 rounded-md border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-100">{section.label}</p>
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-400">
                {section.items.reduce((acc, s) => acc + s.citations.length, 0)} citations
              </span>
            </div>
            {section.items.length === 0 ? (
              <p className="text-xs text-slate-500">No content generated.</p>
            ) : (
              <ul className="space-y-2 text-xs text-slate-200">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <p className="font-medium text-slate-100">{item.title}</p>
                    <p className="text-slate-300">{item.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

