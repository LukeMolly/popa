import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import pg from "pg";

const useSupabase = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production";
const url = useSupabase
  ? process.env.SUPABASE_DATABASE_URL
  : process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  if (useSupabase) throw new Error("Vercel deployment requires SUPABASE_DATABASE_URL; refusing Neon fallback.");
  console.warn("Skipping PostgreSQL migration because DATABASE_URL/POSTGRES_URL is not configured for this deployment.");
  process.exit(0);
}
const client = useSupabase ? new pg.Client({ connectionString: url }) : null;
if (client) await client.connect();
const sql = client ? { query: (statement, values) => client.query(statement, values) } : neon(url);
try {
const source = await readFile(new URL("../db/postgres.sql", import.meta.url), "utf8");

for (const statement of source.split(/;\s*(?:\n|$)/).map((value) => value.trim()).filter(Boolean)) {
  await sql.query(statement, []);
}

const administrators = [
  ["botlhelucas@gmail.com", "Botlhe Lucas", "executive", "17d811cb-5139-47ab-b8c3-858118213bd5", "a891397e43eb21cae2fffe8f60db0c62cac0b77c1590483d8d6484361d7c9b8f"],
  ["lucasmoleele@gmail.com", "Lucas Moleele", "membership", "3dfb761b-a895-41f2-ad90-6f534e49d596", "cfbb8a078104facf839e3c05065613791ad044f8f72efa1a3d5cc4fb9a22fa8f"],
];

for (const [email, name, role, pinSalt, pinHash] of administrators) {
  const now = new Date().toISOString();
  await sql.query(
    "INSERT INTO admin_users (email,name,role,active,pin_salt,pin_hash,created_at,updated_at) VALUES ($1,$2,$3,1,$4,$5,$6,$6) " + (useSupabase ? "ON CONFLICT(email) DO NOTHING" : "ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=1,pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash,updated_at=excluded.updated_at"),
    [email, name, role, pinSalt, pinHash, now],
  );
}

console.log("PostgreSQL schema is ready.");
} finally {
  if (client) await client.end();
}