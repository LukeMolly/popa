import { cookies } from "next/headers";
import { DB } from "../../../lib/platform";
import { ADMIN_SESSION_COOKIE, hashAdminSecret } from "../../admin-auth";
import { ADMIN_IDLE_MS } from "../../../lib/admin-mfa";
import { isTrustedWrite, writeDenied } from "../../../lib/request-security";

export const dynamic = "force-dynamic";
// Only deliberate client-side activity calls this endpoint; background data polling
// must never extend the administrator session.
export async function POST(request: Request) {
  if (!isTrustedWrite(request)) return writeDenied();
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return Response.json({ error: "Administrator session expired." }, { status: 401 });
  const now = new Date(), expires = new Date(now.getTime() + ADMIN_IDLE_MS);
  const row = await DB.prepare(
    "UPDATE admin_sessions s SET expires_at=? FROM admin_users a " +
    "WHERE s.email=a.email AND a.active=1 AND s.token_hash=? AND s.expires_at>? " +
    "AND s.mfa_verified_at<>'' RETURNING s.email"
  ).bind(expires.toISOString(), await hashAdminSecret(token), now.toISOString()).first();
  if (!row) {
    jar.set(ADMIN_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return Response.json({ error: "Administrator session expired." }, { status: 401 });
  }
  jar.set(ADMIN_SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
