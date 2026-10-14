import { cookies } from "next/headers";
import { DB } from "../../../lib/platform";
import { MEMBER_SESSION_COOKIE, sessionTokenHash } from "../../../lib/member-auth";
import { isTrustedWrite, writeDenied } from "../../../lib/request-security";

// No new or existing member account can be used to sign in to the public site.
export async function POST() {
  return Response.json({ error: "Member login has been retired. Please use the KYC registration form or contact the membership admin." }, { status: 410 });
}

export async function DELETE(request: Request) {
  if (!isTrustedWrite(request)) return writeDenied();
  const store = await cookies();
  const token = store.get(MEMBER_SESSION_COOKIE)?.value;
  if (token) await DB.prepare("DELETE FROM member_sessions WHERE token_hash=?").bind(sessionTokenHash(token)).run();
  store.set(MEMBER_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
