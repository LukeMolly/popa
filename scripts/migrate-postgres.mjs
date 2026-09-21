import { readFile } from "node:fs/promises";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("Set DATABASE_URL before running the migration.");
const sql = neon(url);
const source = await readFile(new URL("../db/postgres.sql", import.meta.url), "utf8");
for (const statement of source.split(/;\s*(?:\n|$)/).map((value) => value.trim()).filter(Boolean)) {
  await sql.query(statement, []);
}
const legacyEmailLinks = [
  ["thato lucas moleele", "lucasmoleele@gmail.com"],
  ["botlhe lucas", "botlhelucas@gmail.com"],
];
for (const [fullName, email] of legacyEmailLinks) {
  await sql.query(
    "UPDATE members SET email = $1 WHERE lower(trim(first_name || ' ' || last_name)) = $2 AND (email = '' OR lower(email) = $1)",
    [email, fullName],
  );
}
const scrypt = promisify(scryptCallback);
const legacyMembers = await sql.query("SELECT id FROM members WHERE password_hash = '' OR password_salt = ''", []);
for (const member of legacyMembers) {
  const salt = randomBytes(24).toString("hex");
  const hash = (await scrypt("password", salt, 64)).toString("hex");
  await sql.query("UPDATE members SET password_salt = $1, password_hash = $2, password_must_change = TRUE WHERE id = $3 AND (password_hash = '' OR password_salt = '')", [salt, hash, member.id]);
}
console.log("PostgreSQL schema is ready.");
