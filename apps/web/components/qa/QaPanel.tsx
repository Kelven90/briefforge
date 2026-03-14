"use client";

import { useState } from "react";

type Citation = {
  chunkId: string;
  sourceId: string;
};

type QaPanelProps = {
  workspaceId: string;
};

type AnswerState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "done";
      answerText: string;
      citations: Citation[];
      latencyMs: number;
    }
  | { status: "error"; message: string };

export function QaPanel({ workspaceId }: QaPanelProps) {
  const [question, setQuestion] = useState("");
  const [answerState, setAnswerState] = useState<AnswerState>({ status: "idle" });
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setAnswerState({ status: "loading" });
    try {
      const res = await fetch("/api/qa/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, question })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Request failed");
      }
      const data = await res.json();
      setAnswerState({
        status: "done",
        answerText: data.answerText,
        citations: data.citations ?? [],
        latencyMs: data.latencyMs ?? 0
      });
    } catch (err: any) {
      setAnswerState({ status: "error", message: err.message ?? "Unknown error" });
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Grounded Q&amp;A</h2>
        {answerState.status === "done" && (
          <span className="text-xs text-slate-400">
            Latency: {answerState.latencyMs.toFixed(0)} ms
          </span>
        )}
      </div>
      <form onSubmit={handleAsk} className="space-y-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2"
          placeholder="Ask a question about this client's constraints, deliverables, or risks..."
        />
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={answerState.status === "loading"}
            className="inline-flex items-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {answerState.status === "loading" ? "Asking..." : "Ask with citations"}
          </button>
        </div>
      </form>

      {answerState.status === "error" && (
        <p className="text-xs text-red-400">{answerState.message}</p>
      )}

      {answerState.status === "done" && (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-slate-100">{answerState.answerText}</p>
          <div className="flex flex-wrap gap-2">
            {answerState.citations.map((c, idx) => (
              <button
                key={`${c.chunkId}-${idx}`}
                type="button"
                onClick={() => setSelectedCitation(c)}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:border-sky-500 hover:text-sky-300"
              >
                Evidence {idx + 1}
              </button>
            ))}
            {answerState.citations.length === 0 && (
              <span className="text-xs text-slate-400">No citations returned.</span>
            )}
          </div>
        </div>
      )}

      {selectedCitation && (
        <EvidenceDrawer
          workspaceId={workspaceId}
          citation={selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      )}
    </section>
  );
}

type EvidenceDrawerProps = {
  workspaceId: string;
  citation: Citation;
  onClose: () => void;
};

function EvidenceDrawer({ citation, onClose }: EvidenceDrawerProps) {
  // For MVP we just show the IDs; later we can call a dedicated evidence endpoint.
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-100">Evidence</p>
            <p className="text-[10px] text-slate-400">
              chunkId={citation.chunkId} • sourceId={citation.sourceId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:border-slate-500 hover:bg-slate-900"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-slate-400">
          In V1, this drawer will load the full chunk and source metadata to let reviewers inspect
          the original evidence.
        </p>
      </div>
    </div>
  );
}

