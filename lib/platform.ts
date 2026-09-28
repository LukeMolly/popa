import { neon } from "@neondatabase/serverless";
import { Pool, PoolClient } from "pg";
import { del, put } from "@vercel/blob";

type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number };
export type DatabaseContext = { memberId?: string | null; adminRole?: string | null };

function connectionString() {
  if (process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production") {
    const value = process.env.SUPABASE_DATABASE_URL;
    if (!value) throw new Error("Vercel deployment requires SUPABASE_DATABASE_URL; refusing Neon fallback.");
    return value;
  }
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URL;
  if (!value) throw new Error("Database URL is not configured.");
  return value;
}
let supabasePool: Pool | undefined;
function usesSupabase() {
  return process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && !!process.env.SUPABASE_DATABASE_URL);
}
function pool() {
  supabasePool ??= new Pool({ connectionString: connectionString(), max: 2, idleTimeoutMillis: 10000 });
  return supabasePool;
}
function queryDatabase(query: string, values: unknown[]): Promise<QueryResult> {
  const url = connectionString();
  if (usesSupabase()) return pool().query(query, values) as Promise<QueryResult>;
  const sql = neon(url, { fullResults: true });
  return sql.query(query, values) as Promise<QueryResult>;
}
function postgresQuery(query: string) {
  let index = 0;
  return query
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\bAS\s+([a-z][a-zA-Z0-9]*)/g, (_match, alias: string) =>
      /[A-Z]/.test(alias) ? `AS "${alias}"` : `AS ${alias}`,
    );
}
class Statement {
  private values: unknown[] = [];
  constructor(private readonly query: string, private readonly client?: PoolClient) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  private async execute(): Promise<QueryResult> {
    const query = postgresQuery(this.query);
    return this.client
      ? this.client.query(query, this.values) as Promise<QueryResult>
      : queryDatabase(query, this.values);
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> { const result = await this.execute(); return (result.rows[0] as T | undefined) ?? null; }
  async all<T = Record<string, unknown>>() { const result = await this.execute(); return { results: result.rows as T[] }; }
  async run() { const result = await this.execute(); return { meta: { changes: result.rowCount ?? result.rows.length } }; }
}
export const DB = {
  prepare(query: string) { return new Statement(query); },
  async batch(statements: Statement[]) { return Promise.all(statements.map((statement) => statement.run())); },

  // RLS-aware transaction. Identity is transaction-local so pooled connections
  // can never leak one member/admin context into another request.
  async withContext<T>(context: DatabaseContext, work: (db: { prepare(query: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }) => Promise<T>): Promise<T> {
    if (!usesSupabase()) return work({ prepare: (query: string) => new Statement(query), batch: (statements: Statement[]) => Promise.all(statements.map((statement) => statement.run())) });
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.member_id', $1, true), set_config('app.admin_role', $2, true)", [
        context.memberId || "",
        context.adminRole || "",
      ]);
      const result = await work({ prepare: (query: string) => new Statement(query, client), batch: (statements: Statement[]) => Promise.all(statements.map((statement) => statement.run())) });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
export async function uploadReceipt(pathname: string, body: ArrayBuffer, contentType: string) {
  const blob = await put(pathname, body, { access: "private", addRandomSuffix: true, contentType });
  return blob.url;
}
export async function deleteReceipt(url: string) { await del(url); }
export async function readReceipt(url: string) { return fetch(url, { cache: "no-store" }); }
