import { neon } from "@neondatabase/serverless";
import { del, put } from "@vercel/blob";

type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number };
function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
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
  constructor(private readonly query: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  private async execute(): Promise<QueryResult> {
    const sql = neon(connectionString(), { fullResults: true });
    return sql.query(postgresQuery(this.query), this.values) as Promise<QueryResult>;
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> { const result = await this.execute(); return (result.rows[0] as T | undefined) ?? null; }
  async all<T = Record<string, unknown>>() { const result = await this.execute(); return { results: result.rows as T[] }; }
  async run() { const result = await this.execute(); return { meta: { changes: result.rowCount ?? result.rows.length } }; }
}
export const DB = {
  prepare(query: string) { return new Statement(query); },
  async batch(statements: Statement[]) { return Promise.all(statements.map((statement) => statement.run())); },
};
export async function uploadReceipt(pathname: string, body: ArrayBuffer, contentType: string) {
  const blob = await put(pathname, body, { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
}
export async function deleteReceipt(url: string) { await del(url); }
export async function readReceipt(url: string) { return fetch(url, { cache: "no-store" }); }
