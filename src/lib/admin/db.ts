import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Read-only connection to Vantage as `gamecock_reader` (Vantage migration 006): it can
// SELECT only site_events_gamecock (our events, internal traffic already excluded) and
// the system-wide ingest-health ledger. Lazy so `next build` needs no database.
const g = globalThis as unknown as { gcAdminPool?: Pool };

function pool(): Pool {
  if (g.gcAdminPool) return g.gcAdminPool;
  const url = process.env.VANTAGE_READ_URL;
  if (!url) throw new Error("VANTAGE_READ_URL is not set");
  const remote = !/localhost|127\.0\.0\.1/.test(url);
  // Supabase's pooler chain reads as self-signed to Node; encrypt without CA checks (same as Vantage).
  g.gcAdminPool = new Pool({ connectionString: url, max: 3, ssl: remote ? { rejectUnauthorized: false } : undefined });
  return g.gcAdminPool;
}

export async function q<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(sql, params)).rows;
}
