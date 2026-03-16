"use client";

import { useEffect, useState } from "react";

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
      briefId: string;
      brief: BriefContent;
      latencyMs: number | null;
    };

export function BriefPanel({ workspaceId }: BriefPanelProps) {
  const [state, setState] = useState<BriefState>({ status: "idle" });
  const [collapsed, setCollapsed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  // Load latest brief on initial render so status is always visible/editable.
  useEffect(() => {
    let cancelled = false;
    async function loadLatest() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/briefs/latest`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.brief || cancelled) return;
        setState({
          status: "done",
          briefId: data.brief.id,
          brief: data.brief.content,
          latencyMs: null
        });
      } catch {
        // ignore on load
      }
    }
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
        briefId: data.id,
        brief: data.content,
        latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : null
      });
      setShowFeedback(false);
      setFeedbackText("");
    } catch (err: any) {
      setState({ status: "error", message: err.message ?? "Unknown error" });
    }
  }

  async function handleRegenerateWithFeedback() {
    if (!feedbackText.trim()) return;
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/briefs/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, feedback: feedbackText })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      const data = await res.json();
      setState({
        status: "done",
        briefId: data.id,
        brief: data.content,
        latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : null
      });
      setShowFeedback(false);
      setFeedbackText("");
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
            Pulls this workspace&apos;s sources into a single, reviewable project brief.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state.status === "done" && state.latencyMs != null && (
            <span className="text-xs text-slate-400">
              Latency: {state.latencyMs.toFixed(0)} ms
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label={collapsed ? "Expand brief" : "Collapse brief"}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled}
            className="inline-flex items-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {disabled ? "Generating..." : "Generate new brief"}
          </button>
          {state.status === "error" && (
            <p className="text-xs text-red-400">{state.message}</p>
          )}
          {state.status === "done" && (
            <>
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">Happy with this brief?</p>
                {!showFeedback ? (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFeedback(false);
                        setFeedbackText("");
                      }}
                      className="rounded border border-emerald-600/50 bg-emerald-500/10 px-2 py-0.5 text-emerald-300 hover:bg-emerald-500/20"
                    >
                      Looks good
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFeedback(true)}
                      className="rounded border border-slate-600/50 bg-slate-500/10 px-2 py-0.5 text-slate-300 hover:bg-slate-500/20"
                    >
                      Needs changes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <textarea
                      rows={2}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                      placeholder="What feels off or missing? This feedback will be used to improve the next draft."
                    />
                    <button
                      type="button"
                      disabled={!feedbackText.trim()}
                      onClick={handleRegenerateWithFeedback}
                      className="rounded bg-sky-500 px-2 py-1 text-[10px] font-medium text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Generate again with feedback
                    </button>
                  </div>
                )}
              </div>
              <BriefSections brief={state.brief} />
            </>
          )}
        </>
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

