import { notFound } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth/session";
import { getWorkspaceForUser } from "../../../../lib/workspaces";
import { listSourcesForWorkspace } from "../../../../lib/sources-queries";
import { listRecentJobsForWorkspace } from "../../../../lib/jobs-queries";
import { listRecentAnswerRunsForWorkspace } from "../../../../lib/answer-runs-queries";
import { listRecentEvaluationsForWorkspace } from "../../../../lib/evals-queries";
import { QaPanel } from "../../../../components/qa/QaPanel";
import { BriefPanel } from "../../../../components/brief/BriefPanel";
import { SourceUploadPanel } from "../../../../components/source/SourceUploadPanel";
import { WorkspaceJobsAndSources } from "../../../../components/workspace/WorkspaceJobsAndSources";
import { WorkspaceUsageCard } from "../../../../components/usage/WorkspaceUsageCard";
import { WorkspaceEvalsCard } from "../../../../components/usage/WorkspaceEvalsCard";

type PageProps = {
  params: { workspaceId: string };
};

export default async function WorkspaceDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const userId = (user as { id?: string } | null)?.id;
  if (!userId) {
    notFound();
  }

  const workspace = await getWorkspaceForUser(userId, params.workspaceId);
  if (!workspace) {
    notFound();
  }

  const [sources, jobs, answerRuns, evaluations] = await Promise.all([
    listSourcesForWorkspace(workspace.id),
    listRecentJobsForWorkspace(workspace.id, 24),
    listRecentAnswerRunsForWorkspace(workspace.id, 8),
    listRecentEvaluationsForWorkspace(workspace.id, 4)
  ]);

  const isSeededDemo =
    workspace.id === "00000000-0000-0000-0000-000000000010";

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">
            {isSeededDemo ? "Demo workspace" : "Workspace"}
          </p>
          <h1 className="text-xl font-semibold text-slate-50">
            {isSeededDemo ? "BriefForge demo: Acme launch" : workspace.name}
          </h1>
          {workspace.description && (
            <p className="mt-1 text-xs text-slate-400 max-w-xl">{workspace.description}</p>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="space-y-4">
          <SourceUploadPanel workspaceId={workspace.id} />
          <WorkspaceJobsAndSources
            workspaceId={workspace.id}
            initialJobs={jobs}
            sources={sources}
          />
        </section>

        <div className="space-y-4">
          <QaPanel workspaceId={workspace.id} />
          <BriefPanel workspaceId={workspace.id} />
          <WorkspaceUsageCard answerRuns={answerRuns} workspaceId={workspace.id} />
          <WorkspaceEvalsCard evaluations={evaluations} />
        </div>
      </div>
    </main>
  );
}
