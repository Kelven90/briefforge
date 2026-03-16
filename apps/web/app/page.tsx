import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6">
      <div className="space-y-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">
          BriefForge demo
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
          Turn messy client inputs into grounded, reviewable briefs.
        </h1>
        <p className="max-w-2xl text-balance text-sm text-slate-300 md:text-base">
          This is a small, production‑ish demo. Upload kickoff transcripts, brand guides, FAQs, and
          evolving requirements; BriefForge indexes them, retrieves evidence, and turns them into a
          structured project brief you can actually review.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/signin"
            className="inline-flex items-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-sky-400"
          >
            Start demo workspace
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            I already have a workspace
          </Link>
          <Link
            href="https://github.com/Kelven90/briefforge"
            className="inline-flex items-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
          >
            View code on GitHub
          </Link>
        </div>
        <div className="mt-6 grid gap-8 text-xs text-slate-400 md:grid-cols-3">
          <div>
            <p className="font-medium text-slate-200">1. Grounded, not just chatty</p>
            <p>Answers and briefs are backed by citations into your own client materials.</p>
          </div>
          <div>
            <p className="font-medium text-slate-200">2. Async indexing pipeline</p>
            <p>Uploads fan out into parse, chunk, and embed jobs you can inspect per source.</p>
          </div>
          <div>
            <p className="font-medium text-slate-200">3. Eval‑ and metrics‑aware</p>
            <p>Track latency, tokens, estimated cost, and lightweight eval scores from the UI.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
