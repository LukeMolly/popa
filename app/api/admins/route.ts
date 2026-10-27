import { DB } from "../../../lib/platform";
const env = { DB };
import { getClubAdmin, hashAdminPin } from "../../admin-auth";
import { isTrustedWrite, writeDenied } from "../../../lib/request-security";
export const dynamic = "force-dynamic";
const ownerEmail = "botlhelucas@gmail.com";
const clean = (value: unknown, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
async function executive() {
  const admin = await getClubAdmin();
  return admin?.role === "executive" ? admin : null;
}
export async function GET() {
  const current = await executive();
  if (!current) return fail("Executive administrator access required.", 403);
  try {
    const rows = await env.DB.prepare("SELECT email,name,role,active,created_at AS createdAt FROM admin_users ORDER BY role,name,email").all();
    return Response.json({
      current,
      administrators: [
        { email: ownerEmail, name: "Botlhe Lucas", role: "executive", active: 1, permanent: true },
        ...rows.results.filter(row => String(row.email).toLowerCase() !== ownerEmail),
      ],
    });
  } catch (error) {
    console.error(error);
    return fail("Administrator list is unavailable.", 500);
  }
}
export async function POST(request: Request) {
  if (!isTrustedWrite(request)) return writeDenied();
  const current = await executive();
  if (!current) return fail("Executive administrator access required.", 403);
  try {
    const data = await request.json() as Record<string, unknown>;
    const action = clean(data.action, 40), email = clean(data.email).toLowerCase();
    if (action === "rotate-executive-pin") {
      if (current.email.toLowerCase() !== ownerEmail) return fail("Only the permanent executive can rotate this PIN.", 403);
      const oldPin = clean(data.oldPin, 6);
      const newPin = clean(data.newPin, 6);
      if (!/^\d{6}$/.test(oldPin) || !/^\d{6}$/.test(newPin)) return fail("Enter the current and new six-digit PINs.");
      if (oldPin === newPin || /^([0-9])\1{5}$/.test(newPin) || ["123456","654321","012345","123123"].includes(newPin)) return fail("Choose a different, less predictable six-digit PIN.");
      const existing = await env.DB.prepare("SELECT pin_salt AS pinSalt,pin_hash AS pinHash FROM admin_users WHERE email=? AND role='executive' AND active=1").bind(ownerEmail).first() as {pinSalt:string;pinHash:string}|null;
      if (!existing || !existing.pinHash || (await hashAdminPin(oldPin,existing.pinSalt)) !== existing.pinHash) return fail("Current executive PIN is incorrect.", 403);
      const now = new Date().toISOString();
      const salt = crypto.randomUUID(), pinHash = await hashAdminPin(newPin,salt);
      await env.DB.prepare("UPDATE admin_users SET pin_salt=?,pin_hash=?,updated_at=? WHERE email=? AND role='executive'").bind(salt,pinHash,now,ownerEmail).run();
      await env.DB.prepare("DELETE FROM admin_sessions WHERE email=?").bind(ownerEmail).run();
      return Response.json({ ok: true });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid administrator email address.");
    if (email === ownerEmail) return fail("The Executive Access Administrator account is permanent.", 409);
    if (action === "delete") {
      const result = await env.DB.prepare("DELETE FROM admin_users WHERE email=?").bind(email).run();
      if (result.meta.changes) {
        await env.DB.prepare("DELETE FROM admin_sessions WHERE email=?").bind(email).run();
        // Removing an administrator also revokes the enrolled authenticator and recovery credentials.
        await env.DB.prepare("DELETE FROM admin_mfa_challenges WHERE email=?").bind(email).run();
        await env.DB.prepare("DELETE FROM admin_mfa_recovery WHERE email=?").bind(email).run();
        await env.DB.prepare("DELETE FROM admin_mfa_attempts WHERE email=?").bind(email).run();
        await env.DB.prepare("DELETE FROM admin_mfa WHERE email=?").bind(email).run();
      }
      return result.meta.changes ? Response.json({ ok: true }) : fail("Administrator not found.", 404);
    }
    if (action !== "save") return fail("Unknown action.");
    const name = clean(data.name, 100), role = clean(data.role, 30), pin = clean(data.pin, 6), active = data.active === false ? 0 : 1;
    if (!name) return fail("Enter the administrator's name.");
    if (!["coach", "membership", "operations"].includes(role)) return fail("Choose Coach, Membership or Operations administrator.");
    if (!/^\d{6}$/.test(pin)) return fail("Create a six-digit administrator PIN.");
    const now = new Date().toISOString();
    const salt=crypto.randomUUID(),pinHash=await hashAdminPin(pin,salt);
    await env.DB.prepare("INSERT INTO admin_users (email,name,role,active,pin_salt,pin_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,active=excluded.active,pin_salt=excluded.pin_salt,pin_hash=excluded.pin_hash,updated_at=excluded.updated_at").bind(email,name,role,active,salt,pinHash,now,now).run();
    // A new PIN, role or deactivation invalidates existing admin cookies.
    await env.DB.prepare("DELETE FROM admin_sessions WHERE email=?").bind(email).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return fail("Could not save the administrator.", 500);
  }
}
