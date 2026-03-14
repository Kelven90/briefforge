"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
  workspaceId: string;
};

export function JobRetryButton({ jobId, workspaceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, jobId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Retry failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={loading}
      className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
    >
      {loading ? "…" : "Retry"}
    </button>
  );
}
