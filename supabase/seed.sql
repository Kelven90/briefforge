insert into public.users (id, email, name)
values (
  '00000000-0000-0000-0000-000000000001',
  'demo@acmecreator.test',
  'Demo User'
)
on conflict (id) do nothing;

insert into public.workspaces (id, owner_id, name, description)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Acme Creator Launch',
  'Seeded workspace containing kickoff, brand guide, FAQ, and a malicious prompt injection sample.'
)
on conflict (id) do nothing;

-- Sources, chunks, and golden eval data will be seeded via a TypeScript script in infra/scripts.

