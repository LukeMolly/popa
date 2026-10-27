import { DB } from "../../../lib/platform";
import { isTrustedWrite, writeDenied } from "../../../lib/request-security";
import {
  completeMfaSignIn, decryptTotpSecret, encryptTotpSecret, newRecoveryCodes,
  newTotpSecret, provisioningUri, readMfaChallenge, recordMfaFailure,
  recoveryHash, verifyTotp,
} from "../../../lib/admin-mfa";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: noStore });

type AdminMfa = {
  secretCiphertext: string; pendingCiphertext: string;
  pendingExpiresAt: string; lastUsedStep: number; enabledAt: string;
};
async function readConfig(email: string) {
  return DB.prepare("SELECT secret_ciphertext AS secretCiphertext,pending_ciphertext AS pendingCiphertext,pending_expires_at AS pendingExpiresAt,last_used_step AS lastUsedStep,enabled_at AS enabledAt FROM admin_mfa WHERE email=?")
    .bind(email).first() as Promise<AdminMfa | null>;
}

export async function GET() {
  try {
    const challenge = await readMfaChallenge();
    if (!challenge) return fail("Sign-in verification has expired. Sign in again.", 401);
    const existing = await readConfig(challenge.email);
    if (existing?.enabledAt && existing.secretCiphertext) return Response.json({ mode: "verify" }, { headers: noStore });

    const now = new Date();
    let secret: string;
    if (existing?.pendingCiphertext && existing.pendingExpiresAt > now.toISOString()) {
      secret = await decryptTotpSecret(existing.pendingCiphertext, challenge.email);
    } else {
      secret = newTotpSecret();
      const encrypted = await encryptTotpSecret(secret, challenge.email);
      const expires = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      await DB.prepare(
        "INSERT INTO admin_mfa (email,pending_ciphertext,pending_expires_at) VALUES (?,?,?) " +
        "ON CONFLICT (email) DO UPDATE SET pending_ciphertext=excluded.pending_ciphertext,pending_expires_at=excluded.pending_expires_at"
      ).bind(challenge.email, encrypted, expires).run();
    }
    return Response.json({
      mode: "enroll",
      provisioningUri: provisioningUri(challenge.email, secret),
      secret,
    }, { headers: noStore });
  } catch (error) {
    console.error("Administrator MFA configuration failed", error);
    return fail("Authenticator setup is temporarily unavailable.", 503);
  }
}

export async function POST(request: Request) {
  if (!isTrustedWrite(request)) return writeDenied();
  try {
    const challenge = await readMfaChallenge();
    if (!challenge) return fail("Sign-in verification has expired or too many attempts were made.", 401);
    const body = await request.json() as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim().slice(0, 80) : "";
    const existing = await readConfig(challenge.email);
    if (!existing) return fail("Open authenticator setup first.", 409);

    if (!existing.enabledAt) {
      if (!existing.pendingCiphertext || existing.pendingExpiresAt <= new Date().toISOString()) {
        return fail("Authenticator setup has expired. Start setup again.", 409);
      }
      const secret = await decryptTotpSecret(existing.pendingCiphertext, challenge.email);
      const step = await verifyTotp(secret, code);
      if (step === null) {
        await recordMfaFailure();
        return fail("Invalid authenticator code. Check the six-digit code and your phone's time.", 401);
      }
      const codes = newRecoveryCodes();
      // Recovery codes are stored only as hashes and are returned once.
      await DB.prepare(
        "UPDATE admin_mfa SET secret_ciphertext=pending_ciphertext,pending_ciphertext='',pending_expires_at='',enabled_at=?,last_used_step=? " +
        "WHERE email=? AND enabled_at=''"
      ).bind(new Date().toISOString(), step, challenge.email).run();
      for (const recoveryCode of codes) {
        await DB.prepare("INSERT INTO admin_mfa_recovery (email,code_hash,created_at) VALUES (?,?,?)")
          .bind(challenge.email, await recoveryHash(challenge.email, recoveryCode), new Date().toISOString()).run();
      }
      await completeMfaSignIn(challenge.email);
      return Response.json({ ok: true, recoveryCodes: codes }, { headers: noStore });
    }

    let accepted = false;
    if (/^\d{6}$/.test(code)) {
      const secret = await decryptTotpSecret(existing.secretCiphertext, challenge.email);
      const step = await verifyTotp(secret, code, Number(existing.lastUsedStep));
      if (step !== null) {
        const updated = await DB.prepare("UPDATE admin_mfa SET last_used_step=? WHERE email=? AND last_used_step<? RETURNING email")
          .bind(step, challenge.email, step).first();
        accepted = !!updated;
      }
    } else if (/^[0-9a-fA-F-]{24,32}$/.test(code)) {
      const deleted = await DB.prepare("DELETE FROM admin_mfa_recovery WHERE email=? AND code_hash=? RETURNING email")
        .bind(challenge.email, await recoveryHash(challenge.email, code)).first();
      accepted = !!deleted;
    }
    if (!accepted) {
      await recordMfaFailure();
      return fail("Invalid or previously used authenticator/recovery code.", 401);
    }
    await completeMfaSignIn(challenge.email);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Administrator MFA verification failed", error);
    return fail("Could not verify the authenticator code.", 503);
  }
}
