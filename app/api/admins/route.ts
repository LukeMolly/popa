import { env } from "cloudflare:workers";
import { getClubAdmin, hashAdminPin } from "../../admin-auth";
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
        ...rows.results,
      ],
    });
  } catch (error) {
    console.error(error);
    return fail("Administrator list is unavailable.", 500);
  }
}
export async function POST(request: Request) {
  const current = await executive();
  if (!current) return fail("Executive administrator access required.", 403);
  try {
    const data = await request.json() as Record<string, unknown>;
    const action = clean(data.action, 20), email = clean(data.email).toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid administrator email address.");
    if (email === ownerEmail) return fail("The Executive Access Administrator account is permanent.", 409);
    if (action === "delete") {
      const result = await env.DB.prepare("DELETE FROM admin_users WHERE email=?").bind(email).run();
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
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return fail("Could not save the administrator.", 500);
  }
}
