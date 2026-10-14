import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("Set DATABASE_URL before running the migration.");
const sql = neon(url);
const source = await readFile(new URL("../db/postgres.sql", import.meta.url), "utf8");
for (const statement of source.split(/;\s*(?:\n|$)/).map((value) => value.trim()).filter(Boolean)) {
  await sql.query(statement, []);
}
// Deployment migrations never overwrite PINs or assign default member passwords.
// Provision administrators through a secure, authorised setup procedure.
console.log("PostgreSQL schema is ready; existing credentials were preserved.");
