import { auth } from "../../../../auth";
import { DB } from "../../../../lib/platform";
import { isTrustedWrite, writeDenied } from "../../../../lib/request-security";
import { issueMfaChallenge, isMfaLocked } from "../../../../lib/admin-mfa";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!isTrustedWrite(request)) return writeDenied();
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Sign in to Google first." }, { status: 401 });
  const admin = await DB.prepare("SELECT email FROM admin_users WHERE email=? AND active=1")
    .bind(email).first();
  if (!admin) return Response.json({ error: "This Google account is not an authorised administrator." }, { status: 403 });
  if (await isMfaLocked(email)) return Response.json({ error: "Authenticator temporarily locked after incorrect codes. Try again in 15 minutes." }, { status: 429 });
  try {
    // Google identity verification is the first factor, not an administrator session.
    await DB.prepare("DELETE FROM admin_sessions WHERE email=?").bind(email).run();
    await issueMfaChallenge(email);
    return Response.json({ mfaRequired: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Google administrator MFA challenge failed", error);
    return Response.json({ error: "Administrator verification is unavailable." }, { status: 503 });
  }
}
