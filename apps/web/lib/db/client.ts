import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __briefforgeDbPool: Pool | undefined;
}

function getPool(): Pool {
  if (global.__briefforgeDbPool) {
    return global.__briefforgeDbPool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  if (process.env.NODE_ENV !== "production") {
    global.__briefforgeDbPool = pool;
  }
  return pool;
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return { rows: result.rows as T[] };
}

export { getPool as pool };

