import { DB } from "../../../lib/platform";
const env = { DB };
import { isClubAdmin } from "../../admin-auth";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await isClubAdmin(["executive","membership"]))) return Response.json({error:"Membership administrator access required."},{status:403});
  try {
    const db = env.DB;
    const [m,p,n] = await Promise.all([
      db.prepare("SELECT m.id, m.first_name AS firstName, m.last_name AS lastName, m.phone, m.email, m.status, m.risk_status AS riskStatus, m.expires_at AS expiresAt, m.token, m.created_at AS createdAt, (SELECT p.status FROM payments p WHERE p.member_id=m.id ORDER BY p.created_at DESC LIMIT 1) AS paymentStatus FROM members m ORDER BY m.created_at DESC").all(),
      db.prepare("SELECT code, campaign, member_id AS memberId, status, created_at AS createdAt FROM promos ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,member_id AS memberId,title,body,reply,replied_at AS repliedAt,created_at AS createdAt FROM member_notifications ORDER BY created_at DESC").all(),
    ]);
    return Response.json({members:m.results,promos:p.results,notifications:n.results});
  } catch(e) { console.error(e); return Response.json({error:"Membership data is unavailable. Please try again."},{status:500}); }
}
