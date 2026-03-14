import { z } from "zod";
import { query } from "./db/client";
import type { Workspace } from "@briefforge/core";

const CreateWorkspaceInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional()
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInput>;

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const { rows } = await query<Workspace>(
    `
      select id, owner_id as "ownerId", name, description, created_at as "createdAt"
      from public.workspaces
      where owner_id = $1
      order by created_at desc
    `,
    [userId]
  );
  return rows;
}

export async function getWorkspaceForUser(userId: string, workspaceId: string): Promise<Workspace | null> {
  const { rows } = await query<Workspace>(
    `
      select id, owner_id as "ownerId", name, description, created_at as "createdAt"
      from public.workspaces
      where id = $1 and owner_id = $2
      limit 1
    `,
    [workspaceId, userId]
  );
  return rows[0] ?? null;
}

export async function createWorkspaceForUser(userId: string, input: unknown): Promise<Workspace> {
  const parsed = CreateWorkspaceInput.parse(input);

  const { rows } = await query<Workspace>(
    `
      insert into public.workspaces (owner_id, name, description)
      values ($1, $2, $3)
      returning id, owner_id as "ownerId", name, description, created_at as "createdAt"
    `,
    [userId, parsed.name, parsed.description ?? null]
  );

  return rows[0];
}

