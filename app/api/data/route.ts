import { DB } from "../../../lib/platform";
const env = { DB };
import { isClubAdmin } from "../../admin-auth";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isClubAdmin(["executive","membership"]))) return Response.json({error:"Membership administrator access required."},{status:403});
  try {
    const db = env.DB;
    const [m,p,u,n] = await Promise.all([
      db.prepare("SELECT id, first_name AS firstName, last_name AS lastName, phone, email, status, expires_at AS expiresAt, token, created_at AS createdAt FROM members ORDER BY created_at DESC").all(),
      db.prepare("SELECT code, campaign, member_id AS memberId, status, created_at AS createdAt FROM promos ORDER BY created_at DESC").all(),
      db.prepare("SELECT id, title, body, created_at AS createdAt FROM updates ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,member_id AS memberId,title,body,reply,replied_at AS repliedAt,created_at AS createdAt FROM member_notifications ORDER BY created_at DESC").all(),
    ]);
    return Response.json({members:m.results,promos:p.results,updates:u.results,notifications:n.results});
  } catch(e) { console.error(e); return Response.json({error:"Membership data is unavailable. Please try again."},{status:500}); }
}
