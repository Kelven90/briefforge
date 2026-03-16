"use client";

import { useEffect, useState } from "react";
import type { JobRow } from "../../lib/jobs-queries";
import type { SourceRow } from "../../lib/sources-queries";
import { JobsCardWithFilters } from "../jobs/JobsCardWithFilters";
import { SourcesTableWithTimeline } from "../sources/SourcesTableWithTimeline";

type Props = {
  workspaceId: string;
  initialJobs: JobRow[];
  sources: SourceRow[];
};

export function WorkspaceJobsAndSources({
  workspaceId,
  initialJobs,
  sources
}: Props) {
  const [jobs, setJobs] = useState<JobRow[]>(initialJobs);

  useEffect(() => {
    let cancelled = false;

    async function fetchJobs() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/jobs`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
      } catch {
        // ignore transient errors
      }
    }

    fetchJobs();
    const id = setInterval(fetchJobs, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [workspaceId]);

  return (
    <>
      <SourcesTableWithTimeline sources={sources} jobs={jobs} />
      <JobsCardWithFilters jobs={jobs} workspaceId={workspaceId} />
    </>
  );
}

