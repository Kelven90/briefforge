"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  workspaceId: string;
};

type State =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success" };

export function SourceUploadPanel({ workspaceId }: Props) {
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileName.trim() || !content.trim()) {
      setState({ status: "error", message: "File name and content are required." });
      return;
    }
    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/sources/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          fileName,
          fileType: "text/plain",
          content
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      setState({ status: "success" });
      setFileName("");
      setContent("");
      router.refresh();
    } catch (err: any) {
      setState({ status: "error", message: err.message ?? "Unknown error" });
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Add source</h2>
          <p className="text-xs text-slate-400">
            Paste plain text to create a new source and kick off indexing.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="fileName" className="text-xs font-medium text-slate-200">
            File name
          </label>
          <input
            id="fileName"
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="client-notes.txt"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-sky-500/40 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="content" className="text-xs font-medium text-slate-200">
            Content
          </label>
          <textarea
            id="content"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste transcript, brief, or notes here..."
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none ring-sky-500/40 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <button
            type="submit"
            disabled={state.status === "submitting"}
            className="inline-flex items-center rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {state.status === "submitting" ? "Uploading..." : "Upload & index"}
          </button>
          {state.status === "success" && (
            <p className="text-[10px] text-emerald-400">Source added and parse job queued.</p>
          )}
          {state.status === "error" && (
            <p className="text-[10px] text-red-400">{state.message}</p>
          )}
        </div>
      </form>
    </div>
  );
}

