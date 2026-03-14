-- Add created_at to jobs for ordering and observability
alter table if exists public.jobs
  add column if not exists created_at timestamptz not null default now();

create index if not exists jobs_created_at_idx on public.jobs (created_at desc);

