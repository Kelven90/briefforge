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
      groundednessStatus: "unknown" | "grounded" | "partially_grounded" | "unsupported";
      unsupportedClaimsCount: number;
    }
  | { status: "error"; message: string };

export function QaPanel({ workspaceId }: QaPanelProps) {
  const [question, setQuestion] = useState("");
  const [answerState, setAnswerState] = useState<AnswerState>({ status: "idle" });
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [showGroundednessInfo, setShowGroundednessInfo] = useState(false);

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
        latencyMs: data.latencyMs ?? 0,
        groundednessStatus: data.groundednessStatus ?? "unknown",
        unsupportedClaimsCount: data.unsupportedClaimsCount ?? 0
      });
    } catch (err: any) {
      setAnswerState({ status: "error", message: err.message ?? "Unknown error" });
    }
  }

  return (
    <section className="relative space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Grounded Q&amp;A</h2>
        {answerState.status === "done" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">
              Latency: {answerState.latencyMs.toFixed(0)} ms
            </span>
            <button
              type="button"
              onClick={() => setShowGroundednessInfo((open) => !open)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded-full"
            >
              <GroundednessBadge
                status={answerState.groundednessStatus}
                unsupported={answerState.unsupportedClaimsCount}
              />
            </button>
          </div>
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

      {showGroundednessInfo && (
        <GroundednessInfoModal
          status={answerState.status === "done" ? answerState.groundednessStatus : "unknown"}
          unsupported={answerState.status === "done" ? answerState.unsupportedClaimsCount : 0}
          onClose={() => setShowGroundednessInfo(false)}
        />
      )}
    </section>
  );
}

function GroundednessBadge({
  status,
  unsupported
}: {
  status: "unknown" | "grounded" | "partially_grounded" | "unsupported";
  unsupported: number;
}) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (status === "grounded") {
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-300`}>
        Grounded{unsupported ? ` • unsupported ~${unsupported}` : ""}
      </span>
    );
  }
  if (status === "unsupported") {
    return (
      <span className={`${base} bg-red-500/15 text-red-300`}>
        Unsupported{unsupported ? ` • ~${unsupported} tokens` : ""}
      </span>
    );
  }
  if (status === "partially_grounded") {
    return (
      <span className={`${base} bg-amber-500/15 text-amber-300`}>
        Partially grounded{unsupported ? ` • ~${unsupported}` : ""}
      </span>
    );
  }
  return (
    <span className={`${base} bg-slate-500/15 text-slate-300`}>
      Groundedness: unknown
    </span>
  );
}

type GroundednessInfoModalProps = {
  status: "unknown" | "grounded" | "partially_grounded" | "unsupported";
  unsupported: number;
  onClose: () => void;
};

function GroundednessInfoModal({ status, unsupported, onClose }: GroundednessInfoModalProps) {
  let title = "Groundedness";
  let body =
    "Groundedness compares the answer text to the retrieved evidence chunks to estimate how much of the answer is supported.";

  if (status === "grounded") {
    title = "Grounded";
    body =
      "Most of this answer closely matches phrases that appear in the retrieved source chunks. It should be well supported by the evidence shown below.";
  } else if (status === "partially_grounded") {
    title = "Partially grounded";
    body =
      "Parts of this answer match the retrieved chunks, but some tokens do not appear in any evidence. Treat the novel pieces as less certain and double‑check them against the sources.";
  } else if (status === "unsupported") {
    title = "Unsupported";
    body =
      "Very little of this answer matches the retrieved chunks. It may contain hallucinations or details that are not backed by the current evidence.";
  }

  const unsupportedNote =
    unsupported > 0
      ? `Roughly ${unsupported} answer tokens did not appear in any retrieved chunk. This is a heuristic count, not a perfect measure of correctness.`
      : "For this answer, the heuristic did not flag any unsupported tokens.";

  return (
    <div className="absolute right-0 top-8 z-40 w-72 rounded-lg border border-slate-800 bg-slate-950 p-3 shadow-xl">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 text-[10px] text-slate-500 hover:text-slate-200"
        aria-label="Close groundedness explanation"
      >
        ×
      </button>
      <h3 className="mb-1 pr-4 text-xs font-semibold text-slate-100">{title}</h3>
      <p className="mb-1 text-[11px] text-slate-200">{body}</p>
      <p className="text-[11px] text-slate-400">
        The badge is based on a simple token overlap heuristic between the answer and its retrieved
        chunks. {unsupportedNote}
      </p>
    </div>
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

