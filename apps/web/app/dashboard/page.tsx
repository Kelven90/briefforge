import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/session";
import { listWorkspacesForUser } from "../../lib/workspaces";

export default async function DashboardHomePage() {
  const user = await getCurrentUser();
  const userId = (user as { id?: string } | null)?.id;
  const workspaces = userId ? await listWorkspacesForUser(userId) : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">Dashboard</h1>
          <p className="mt-1 text-xs text-slate-400">
            Choose a workspace to explore sources, grounded QA, and briefs.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {user ? `Signed in as ${user.email ?? user.name ?? "demo user"}` : "Not signed in"}
        </div>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Workspaces</h2>
        </div>
        {workspaces.length === 0 ? (
          <p className="text-sm text-slate-300">
            No workspaces yet. The seeded demo workspace will be created by the seed script.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 text-sm">
            {workspaces.map((ws) => (
              <li
                key={ws.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/workspaces/${ws.id}`}
                      className="font-medium text-slate-100 hover:text-sky-400"
                    >
                      {ws.name}
                    </Link>
                    {ws.name === "Acme Creator Launch" && (
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                        Seeded demo
                      </span>
                    )}
                  </div>
                  {ws.description && (
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">{ws.description}</p>
                  )}
                </div>
                <Link
                  href={`/dashboard/workspaces/${ws.id}`}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:bg-slate-900"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

