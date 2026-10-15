import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readEnvironment } from "./env";
let pool: Pool | undefined;
export function getPool(): Pool {
  if (!pool)
    pool = new Pool({
      connectionString: readEnvironment().databaseUrl,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
  return pool;
}
export function database(pool: Pool) {
  return drizzle(pool);
}
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
