import { getChatGPTUser } from "./chatgpt-auth";
import { DB } from "../lib/platform";
const env = { DB };
import { cookies } from "next/headers";

export type ClubAdminRole = "executive" | "membership" | "operations" | "coach";
export type ClubAdmin = { email: string; name: string; role: ClubAdminRole };
export const ADMIN_SESSION_COOKIE = "tr_admin_session";
const executiveEmail = "botlhelucas@gmail.com";
export async function hashAdminSecret(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function hashAdminPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 120000 }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function getClubAdmin(): Promise<ClubAdmin | null> {
  const user = await getChatGPTUser();
  if (user) {
    const email = user.email.toLowerCase();
    if (email === executiveEmail)
      return { email, name: user.fullName || user.displayName || "Botlhe Lucas", role: "executive" };
    try {
      const row = await env.DB.prepare("SELECT email,name,role FROM admin_users WHERE email=? AND active=1").bind(email).first() as ClubAdmin | null;
      if (row && ["executive", "membership", "operations", "coach"].includes(row.role)) return row;
    } catch (error) { console.error("Administrator lookup failed", error); }
  }
  try {
    const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return null;
    const tokenHash = await hashAdminSecret(token);
    const row = await env.DB.prepare("SELECT a.email,a.name,a.role FROM admin_sessions s JOIN admin_users a ON a.email=s.email WHERE s.token_hash=? AND s.expires_at>? AND a.active=1").bind(tokenHash,new Date().toISOString()).first() as ClubAdmin | null;
    if (!row || !["executive", "membership", "operations", "coach"].includes(row.role)) return null;
    return row;
  } catch (error) {
    console.error("Administrator session lookup failed", error);
    return null;
  }
}
export async function isClubAdmin(roles?: ClubAdminRole[]) {
  const admin = await getClubAdmin();
  return !!admin && (!roles || roles.includes(admin.role));
}
