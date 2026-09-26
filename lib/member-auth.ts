import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { DB } from "./platform";

const scrypt = promisify(scryptCallback);
export const MEMBER_SESSION_COOKIE = "trfc_member_session";

export async function passwordDigest(password: string, salt: string) {
  return (await scrypt(password, salt, 64) as Buffer).toString("hex");
}
export async function newPasswordRecord(password: string) {
  const salt = randomBytes(24).toString("hex");
  return { salt, hash: await passwordDigest(password, salt) };
}
export async function passwordMatches(password: string, salt: string, expected: string) {
  if (!salt || !expected) return false;
  const actual = Buffer.from(await passwordDigest(password, salt), "hex");
  const saved = Buffer.from(expected, "hex");
  return actual.length === saved.length && timingSafeEqual(actual, saved);
}
export function sessionTokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export async function createMemberSession(memberId: string) {
  const token = randomBytes(32).toString("base64url"), now = new Date(), expires = new Date(Date.now()+5*60*1000);
  await DB.prepare("INSERT INTO member_sessions (token_hash,member_id,expires_at,created_at) VALUES (?,?,?,?)").bind(sessionTokenHash(token),memberId,expires.toISOString(),now.toISOString()).run();
  return {token,expires};
}
export async function getMemberSession() {
  const token=(await cookies()).get(MEMBER_SESSION_COOKIE)?.value;
  if(!token)return null;
  return DB.prepare("SELECT m.id,m.email,m.first_name AS firstName,m.last_name AS lastName,m.password_must_change AS passwordMustChange FROM member_sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?").bind(sessionTokenHash(token),new Date().toISOString()).first<{id:string;email:string;firstName:string;lastName:string;passwordMustChange:boolean}>();
}
