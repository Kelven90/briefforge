import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6">
      <div className="space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">
          BriefForge
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
          Turn messy client inputs into grounded, reviewable briefs.
        </h1>
        <p className="max-w-2xl text-balance text-sm text-slate-300 md:text-base">
          Upload kickoff transcripts, brand guides, FAQs, and evolving requirements. BriefForge
          indexes them asynchronously, retrieves evidence, and helps you ship structured
          briefs with citations, guardrails, and metrics.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/signin"
            className="inline-flex items-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-sky-400"
          >
            Sign in as demo
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            Enter dashboard
          </Link>
          <Link
            href="https://github.com/your-username/briefforge"
            className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            View code on GitHub
          </Link>
        </div>
        <div className="mt-6 grid gap-4 text-xs text-slate-400 md:grid-cols-3">
          <div>
            <p className="font-medium text-slate-200">Grounded, not just chatty</p>
            <p>Answers and briefs are backed by citations into your client materials.</p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Async indexing pipeline</p>
            <p>Uploads fan out into parse, chunk, embed, and reindex jobs.</p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Eval- and metrics-aware</p>
            <p>Track latency, tokens, cost estimates, and lightweight eval scores.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
