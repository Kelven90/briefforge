-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create type source_status as enum ('uploaded', 'parsing', 'indexed', 'failed', 'blocked');
create type source_trust_level as enum ('trusted', 'flagged', 'blocked');

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  status source_status not null default 'uploaded',
  trust_level source_trust_level not null default 'trusted',
  created_at timestamptz not null default now()
);

-- Chunks
create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chunk_text text not null,
  chunk_index integer not null,
  token_count integer not null default 0,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists chunks_workspace_id_idx on public.chunks (workspace_id);
create index if not exists chunks_source_id_idx on public.chunks (source_id);
create index if not exists chunks_embedding_idx on public.chunks using ivfflat (embedding vector_cosine_ops);

create type if not exists brief_status as enum ('draft', 'reviewed', 'approved');

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version integer not null,
  status brief_status not null default 'draft',
  model_name text not null,
  prompt_version text not null,
  content_json jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists briefs_workspace_version_uidx
  on public.briefs (workspace_id, version);

create type if not exists groundedness_status as enum ('unknown', 'grounded', 'partially_grounded', 'unsupported');

create table if not exists public.answer_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  question text not null,
  answer_text text not null,
  citations_json jsonb not null,
  groundedness_status groundedness_status not null default 'unknown',
  unsupported_claims_count integer not null default 0,
  latency_ms integer not null default 0,
  token_input integer not null default 0,
  token_output integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create type job_type as enum ('parse', 'chunk', 'embed', 'reindex', 'eval');
create type job_status as enum ('queued', 'running', 'completed', 'failed');

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_id uuid references public.sources (id) on delete set null,
  job_type job_type not null,
  status job_status not null default 'queued',
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists jobs_workspace_id_idx on public.jobs (workspace_id);
create index if not exists jobs_status_idx on public.jobs (status);

create type eval_type as enum ('qa', 'brief', 'guardrail');

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  eval_type eval_type not null,
  score_json jsonb not null,
  created_at timestamptz not null default now()
);

