import { Pool, type QueryResultRow } from "pg";

// One pool per server process. Created lazily so `next build` doesn't need a database.
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Add the database connection string to web/.env.");
    }
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    pool = new Pool({
      connectionString: url,
      // Local Docker needs no TLS. A hosted database would; most hosts' certificates aren't in Node's trust store.
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Postgres error raised by a trigger or constraint, shown to the user as a 400. */
export function dbErrorMessage(err: unknown): string | null {
  const e = err as { code?: string; message?: string };
  // P0001 = raise exception in a trigger; 23xxx = constraint violations.
  if (e?.code === "P0001" || e?.code?.startsWith("23")) return e.message ?? "Rejected by the database";
  return null;
}
