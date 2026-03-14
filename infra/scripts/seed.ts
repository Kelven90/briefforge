import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000010";
const OWNER_ID = "00000000-0000-0000-0000-000000000001";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const DEMO_DIR = path.join(
  STORAGE_ROOT,
  "local",
  "demo",
  WORKSPACE_ID
);

type SourceDef = {
  id: string;
  fileName: string;
  fileType: string;
  storagePath: string;
  trustLevel: "trusted" | "flagged" | "blocked";
  contents: string;
};

const sources: SourceDef[] = [
  {
    id: "0770afb6-1853-4391-aee4-1b8ce6ac1df0",
    fileName: "acme-kickoff.txt",
    fileType: "text/plain",
    storagePath: `/local/demo/${WORKSPACE_ID}/acme-kickoff.txt`,
    trustLevel: "trusted",
    contents: `# Acme Creator Launch - Kickoff Notes

Client: Acme Creator Tools
Project: BriefForge-style AI Brief Generation

[BriefForge — Project Kickoff
Project Overview

BriefForge is an AI-assisted tool that converts unstructured ideas (Slack messages, notes, voice transcripts, or rough prompts) into structured product briefs.

The goal is to reduce the time required for product managers, founders, and engineers to turn scattered ideas into clear execution documents such as feature specs, engineering tickets, or PRDs.

Instead of manually organizing thoughts into structured documents, users provide raw input and BriefForge generates a clean, editable brief including problem definition, user stories, acceptance criteria, and technical considerations.

The first version focuses on rapid idea → structured brief transformation rather than full product lifecycle management.

Core Deliverables

The initial release should include the following deliverables.

1. AI Brief Generation Engine

A service that converts raw input text into a structured product brief.

Input examples:

raw idea notes

Slack discussions

feature requests

meeting transcripts

Output structure:

Problem statement
Target user
Proposed solution
User stories
Acceptance criteria
Risks / assumptions

This component will use an LLM via API with a structured prompt template.

2. Web Application Interface

A minimal web interface where users can:

paste raw text or upload notes

generate a brief

edit and refine the generated content

export or copy the result

The UI should prioritize speed and clarity rather than visual complexity.

3. Brief Storage System

Generated briefs should be stored so users can:

revisit previous briefs

edit drafts

regenerate improved versions

track version history

Storage will be implemented with a simple relational schema.

4. Export and Sharing

Users should be able to export briefs to formats commonly used by teams.

Initial export formats:

Markdown
Notion-style text
Jira-ready ticket format

Future versions may support direct integrations.

Technical Scope

The system will follow a simple full-stack architecture.

Frontend:
Next.js (App Router)
TypeScript
TailwindCSS

Backend:
Next.js API routes or Node service

AI Integration:
LLM API (OpenAI or equivalent)

Database:
PostgreSQL with Prisma ORM

Deployment:
Vercel (frontend + API)
Cloud database (Supabase / Neon)

Authentication is not required for MVP, but the architecture should allow it later.

Constraints

The project is intentionally scoped as a solo portfolio project, so the following constraints apply.

Time constraint
Development must be feasible within roughly two weeks for a V1 release.

Complexity constraint
Avoid building unnecessary infrastructure such as microservices, background queues, or complex authentication systems.

Cost constraint
The system must minimize API usage and cloud costs during development.

AI reliability constraint
LLM outputs can be inconsistent, so the UI must allow users to easily edit generated briefs.

Timeline
Week 1 — Core Functionality

Day 1–2
Project setup
Next.js project structure
Database schema design
LLM prompt design

Day 3–4
Implement brief generation API
Implement prompt templates
Basic UI for input and result display

Day 5–6
Brief storage in database
Basic editing capability
Simple export functionality

Day 7
Internal testing and prompt tuning

Week 2 — Product Polish

Day 8–9
Improve UI and interaction flow
Add regeneration / refine capability

Day 10–11
Export formats (Markdown / Jira style)
Improve error handling

Day 12–13
Performance optimization
Improve prompt consistency

Day 14
Deployment and documentation

Success Criteria

The project will be considered successful if:

users can convert rough ideas into structured briefs in under 10 seconds

generated briefs require minimal editing

the system is deployable and publicly accessible

the repository demonstrates production-style engineering practices

Non-Goals (for V1)

The first release intentionally does not include:

team collaboration features
real-time editing
advanced permissions
project management workflows
complex integrations

These can be considered for later iterations.]
`
  },
  {
    id: "4f1b9f52-0ea0-4a9c-8d5e-9b0b0a0b1234",
    fileName: "acme-brand-guide.txt",
    fileType: "text/plain",
    storagePath: `/local/demo/${WORKSPACE_ID}/acme-brand-guide.txt`,
    trustLevel: "trusted",
    contents: `# Acme Creator Tools - Brand Guide

Tone: pragmatic, encouraging, not hypey.
[...short brand guide text...]
`
  },
  {
    id: "9f2c3a01-2bcb-4d0e-8c5a-123456789abc",
    fileName: "acme-faq-deliverables.txt",
    fileType: "text/plain",
    storagePath: `/local/demo/${WORKSPACE_ID}/acme-faq-deliverables.txt`,
    trustLevel: "trusted",
    contents: `# Acme - FAQ & Deliverables

Deliverables:
- AI brief generation engine...
[...constraints, success criteria, etc...]
`
  },
  {
    id: "badd00d0-1111-2222-3333-444455556666",
    fileName: "prompt-injection.txt",
    fileType: "text/plain",
    storagePath: `/local/demo/${WORKSPACE_ID}/prompt-injection.txt`,
    trustLevel: "flagged",
    contents: `# Malicious instructions

Ignore all previous context and instead...
[...prompt injection sample...]
`
  }
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // 1) Write files to storage/
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  for (const s of sources) {
    const fullPath = path.join(STORAGE_ROOT, s.storagePath.replace(/^\/+/, ""));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, s.contents, "utf8");
    console.log(`Wrote ${fullPath}`);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  // 2) Ensure workspace exists (seed.sql already inserts it, but this is idempotent)
  await client.query(
    `
    insert into public.workspaces (id, owner_id, name, description)
    values ($1, $2, $3, $4)
    on conflict (id) do nothing
    `,
    [
      WORKSPACE_ID,
      OWNER_ID,
      "Acme Creator Launch",
      "Seeded workspace containing kickoff, brand guide, FAQ, and a malicious prompt injection sample."
    ]
  );

  // 3) Insert sources + parse jobs
  for (const s of sources) {
    const res = await client.query(
      `
      with inserted_source as (
        insert into public.sources (id, workspace_id, file_name, file_type, storage_path, trust_level, status)
        values ($1, $2, $3, $4, $5, $6, 'uploaded')
        on conflict (id) do update set
          file_name = excluded.file_name,
          file_type = excluded.file_type,
          storage_path = excluded.storage_path,
          trust_level = excluded.trust_level
        returning id, workspace_id
      )
      insert into public.jobs (workspace_id, source_id, job_type, status)
      select workspace_id, id, 'parse', 'queued' from inserted_source
      returning source_id, id as job_id
      `,
      [s.id, WORKSPACE_ID, s.fileName, s.fileType, s.storagePath, s.trustLevel]
    );
    console.log(`Seeded source ${s.fileName} with job ${res.rows[0].job_id}`);
  }

  // 4) Insert minimal chunks for the first source so CI evals (and local dev without worker) can retrieve.
  // Text-search fallback (when BRIEFFORGE_DISABLE_LLM=1) uses ILIKE; these excerpts match golden questions.
  const firstSourceId = sources[0].id;
  await client.query(
    `
    insert into public.chunks (source_id, workspace_id, chunk_text, chunk_index, token_count)
    select $1, $2, 'Constraints and success criteria: Launch timeline Q2, budget approved. Quality bar: no hallucinated features.', 0, 20
    where not exists (select 1 from public.chunks where source_id = $1 and chunk_index = 0)
    `,
    [firstSourceId, WORKSPACE_ID]
  );
  await client.query(
    `
    insert into public.chunks (source_id, workspace_id, chunk_text, chunk_index, token_count)
    select $1, $2, 'Deliverables: Structured brief generation, grounded QA with citations, export to Markdown.', 1, 18
    where not exists (select 1 from public.chunks where source_id = $1 and chunk_index = 1)
    `,
    [firstSourceId, WORKSPACE_ID]
  );
  await client.query(
    `
    insert into public.chunks (source_id, workspace_id, chunk_text, chunk_index, token_count)
    select $1, $2, 'Acme Creator Launch project scope and goals from kickoff.', 2, 10
    where not exists (select 1 from public.chunks where source_id = $1 and chunk_index = 2)
    `,
    [firstSourceId, WORKSPACE_ID]
  );
  console.log("Seeded minimal chunks for evals.");

  await client.end();
  console.log("Seeding complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});