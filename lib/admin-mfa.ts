import { cookies } from "next/headers";
import { DB } from "./platform";
import { hashAdminSecret, ADMIN_SESSION_COOKIE } from "../app/admin-auth";

export const MFA_CHALLENGE_COOKIE = "tr_admin_mfa_challenge";
export const ADMIN_IDLE_MS = 5 * 60 * 1000;
const CHALLENGE_MS = 10 * 60 * 1000;
const encoder = new TextEncoder();
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function securityKeyMaterial() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Administrator MFA needs a strong AUTH_SECRET.");
  return secret;
}

async function encryptionKey() {
  const material = encoder.encode("township-rollers-admin-totp-v1:" + securityKeyMaterial());
  const bytes = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
}
function fromBase64(text: string) {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function newTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let buffer = 0, bits = 0, out = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(buffer >>> (bits -= 5)) & 31];
    }
  }
  if (bits > 0) out += alphabet[(buffer << (5 - bits)) & 31];
  return out;
}
function decodeBase32(input: string) {
  let buffer = 0, bits = 0;
  const bytes: number[] = [];
  for (const c of input.toUpperCase().replace(/=+$/, "")) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw new Error("Invalid TOTP secret.");
    buffer = (buffer << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits -= 8)) & 255);
    }
  }
  return Uint8Array.from(bytes);
}
export async function encryptTotpSecret(secret: string, email: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(email.toLowerCase()) },
    await encryptionKey(), encoder.encode(secret)
  );
  return toBase64(iv) + ":" + toBase64(new Uint8Array(encrypted));
}
export async function decryptTotpSecret(ciphertext: string, email: string) {
  const [nonce, body] = ciphertext.split(":");
  if (!nonce || !body) throw new Error("Invalid encrypted authenticator setup.");
  const iv = fromBase64(nonce);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(email.toLowerCase()) },
    await encryptionKey(), fromBase64(body)
  );
  return new TextDecoder().decode(plaintext);
}
async function totpAt(secret: string, step: number) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, BigInt(step));
  const key = await crypto.subtle.importKey("raw", decodeBase32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
  const offset = result[result.length - 1] & 15;
  const number = (((result[offset] & 127) << 24) | (result[offset + 1] << 16) | (result[offset + 2] << 8) | result[offset + 3]) % 1000000;
  return String(number).padStart(6, "0");
}
function equalSixDigits(a: string, b: string) {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < 6; i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}
export async function verifyTotp(secret: string, code: string, lastUsedStep = -1) {
  if (!/^\d{6}$/.test(code)) return null;
  const nowStep = Math.floor(Date.now() / 30000);
  for (const step of [nowStep - 1, nowStep, nowStep + 1]) {
    if (step <= lastUsedStep) continue;
    if (equalSixDigits(await totpAt(secret, step), code)) return step;
  }
  return null;
}
export function provisioningUri(email: string, secret: string) {
  const label = encodeURIComponent("Township Rollers FC:" + email);
  return "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" +
    encodeURIComponent("Township Rollers FC") + "&algorithm=SHA1&digits=6&period=30";
}
export function newRecoveryCodes() {
  return Array.from({ length: 8 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const code = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return code.match(/.{1,4}/g)!.join("-");
  });
}
export async function recoveryHash(email: string, code: string) {
  return hashAdminSecret("trfc-recovery-v1:" + email.toLowerCase() + ":" + code.replace(/[\s-]/g, "").toUpperCase());
}
export async function isMfaLocked(email: string) {
  const attempt = await DB.prepare("SELECT locked_until AS lockedUntil FROM admin_mfa_attempts WHERE email=?")
    .bind(email.toLowerCase()).first() as { lockedUntil: string } | null;
  return !!attempt?.lockedUntil && attempt.lockedUntil > new Date().toISOString();
}
export async function issueMfaChallenge(email: string) {
  const now = new Date(), expiry = new Date(now.getTime() + CHALLENGE_MS);
  const token = randomToken(), tokenHash = await hashAdminSecret(token), lower = email.toLowerCase();
  await DB.prepare("DELETE FROM admin_mfa_challenges WHERE email=? OR expires_at<=?").bind(lower, now.toISOString()).run();
  await DB.prepare("INSERT INTO admin_mfa_challenges (token_hash,email,expires_at,created_at) VALUES (?,?,?,?)")
    .bind(tokenHash, lower, expiry.toISOString(), now.toISOString()).run();
  const jar = await cookies();
  jar.set(MFA_CHALLENGE_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiry });
  jar.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}
export async function readMfaChallenge() {
  const token = (await cookies()).get(MFA_CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  const row = await DB.prepare("SELECT email,failed_attempts AS failedAttempts FROM admin_mfa_challenges WHERE token_hash=? AND expires_at>? AND failed_attempts<5")
    .bind(await hashAdminSecret(token), new Date().toISOString()).first() as { email: string; failedAttempts: number } | null;
  if (!row || await isMfaLocked(row.email)) return null;
  const admin = await DB.prepare("SELECT email FROM admin_users WHERE email=? AND active=1").bind(row.email).first();
  return admin ? row : null;
}
export async function recordMfaFailure() {
  const token = (await cookies()).get(MFA_CHALLENGE_COOKIE)?.value;
  if (!token) return;
  const hash = await hashAdminSecret(token);
  const challenge = await DB.prepare("UPDATE admin_mfa_challenges SET failed_attempts=failed_attempts+1 WHERE token_hash=? RETURNING email")
    .bind(hash).first() as { email: string } | null;
  if (!challenge) return;
  // Account-level limit prevents bypassing per-challenge limits by repeatedly
  // entering a valid PIN or restarting a Google OAuth challenge.
  const now = new Date(), cutoff = new Date(now.getTime() - 15 * 60 * 1000);
  const lockUntil = new Date(now.getTime() + 15 * 60 * 1000);
  await DB.prepare(
    "INSERT INTO admin_mfa_attempts (email,failed_count,locked_until,updated_at) VALUES (?,1,'',?) " +
    "ON CONFLICT (email) DO UPDATE SET " +
    "failed_count=CASE WHEN admin_mfa_attempts.updated_at<? THEN 1 ELSE admin_mfa_attempts.failed_count+1 END," +
    "locked_until=CASE WHEN admin_mfa_attempts.updated_at<? THEN '' WHEN admin_mfa_attempts.failed_count+1>=5 THEN ? ELSE '' END," +
    "updated_at=excluded.updated_at"
  ).bind(challenge.email, now.toISOString(), cutoff.toISOString(), cutoff.toISOString(), lockUntil.toISOString()).run();
}
export async function completeMfaSignIn(email: string) {
  const token = (await cookies()).get(MFA_CHALLENGE_COOKIE)?.value;
  if (!token) throw new Error("Authentication challenge expired.");
  const challengeHash = await hashAdminSecret(token);
  const deleted = await DB.prepare("DELETE FROM admin_mfa_challenges WHERE token_hash=? AND email=? AND expires_at>? AND failed_attempts<5 RETURNING email")
    .bind(challengeHash, email, new Date().toISOString()).first();
  if (!deleted) throw new Error("Authentication challenge expired.");
  const now = new Date(), expiresAt = new Date(now.getTime() + ADMIN_IDLE_MS);
  const sessionToken = randomToken();
  await DB.prepare("INSERT INTO admin_sessions (token_hash,email,expires_at,created_at,mfa_verified_at) VALUES (?,?,?,?,?)")
    .bind(await hashAdminSecret(sessionToken), email, expiresAt.toISOString(), now.toISOString(), now.toISOString()).run();
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, sessionToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: expiresAt });
  jar.set(MFA_CHALLENGE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  await DB.prepare("DELETE FROM admin_mfa_attempts WHERE email=?").bind(email).run();
}
