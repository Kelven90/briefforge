"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("credentials", {
      code,
      redirect: true,
      callbackUrl: "/dashboard"
    });
    if (result?.error) {
      setError("Invalid access code. Use 'demo' for the seeded demo user.");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="space-y-6 rounded-lg border border-slate-800 bg-slate-950/60 p-6">
        <h1 className="text-xl font-semibold text-slate-50">Sign in</h1>
        <p className="text-sm text-slate-300">
          This demo uses a single seeded user. Enter the access code{" "}
          <span className="font-mono text-sky-400">demo</span> to continue as the Acme Creator
          Launch workspace owner.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="code" className="text-xs font-medium text-slate-200">
              Access code
            </label>
            <input
              id="code"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 placeholder:text-slate-500 focus:border-sky-500 focus:ring-2"
              placeholder="demo"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Signing in..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

