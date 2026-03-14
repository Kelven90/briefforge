/**
 * Applies Supabase migrations in order via pg.
 * Usage: tsx infra/scripts/migrate.ts
 * Requires: DATABASE_URL
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../supabase/migrations");

const migrationFiles = ["0001_init.sql", "0002_jobs_created_at.sql"];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.error(`Migration file not found: ${filePath}`);
        process.exit(1);
      }
      const sql = fs.readFileSync(filePath, "utf8");
      try {
        await client.query(sql);
        console.log(`Applied ${file}`);
      } catch (err: any) {
        // If types or objects already exist (e.g. rerunning on a dev DB), log and continue.
        if (err?.code === "42710") {
          console.warn(`Skipping ${file} (objects already exist)`);
          continue;
        }
        throw err;
      }
    }
    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
