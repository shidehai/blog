import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(795232)");
    const namespace = await client.query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='author_cms') AS present",
    );
    if (!namespace.rows[0]?.present) await client.query("CREATE SCHEMA author_cms");
    await client.query(
      "CREATE TABLE IF NOT EXISTS author_cms.schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const folder = fileURLToPath(new URL("../migrations/", import.meta.url));
    for (const name of (await readdir(folder))
      .filter((name) => /^\d+.*\.sql$/.test(name))
      .sort()) {
      const source = await readFile(`${folder}/${name}`, "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM author_cms.schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(`迁移校验和不匹配：${name}`);
        continue;
      }
      await client.query(source);
      await client.query(
        "INSERT INTO author_cms.schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
