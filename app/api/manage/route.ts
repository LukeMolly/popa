import { DB } from "../../../lib/platform";
const env = { DB };
import { isClubAdmin } from "../../admin-auth";
export const dynamic = "force-dynamic";
const clean = (x:unknown,n=200) => typeof x==="string" ? x.trim().slice(0,n) : "";
const fail = (message:string,status=400) => Response.json({error:message},{status});
export async function POST(request:Request) {
  if (!(await isClubAdmin(["executive","membership"]))) return fail("Membership administrator access required.",403);
  try {
    const data = await request.json() as Record<string,unknown>, db=env.DB, now=new Date().toISOString();
    if(data.action==="member") {
      const first=clean(data.firstName,80),last=clean(data.lastName,80);
      if(!first||!last) return fail("First and last names are required.");
      const id="TRFC-"+crypto.randomUUID().slice(0,8).toUpperCase();
      const token=crypto.randomUUID();
      await db.prepare("INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id,first,last,clean(data.phone,30),clean(data.email,160),"pending",clean(data.expiresAt,10),token,now).run();
      return Response.json({id});
    }
    if(data.action==="status") {
      const id=clean(data.id,30),status=clean(data.status,20);
      if(!["active","pending","expired","suspended"].includes(status)) return fail("Invalid status.");
      const result=await db.prepare("UPDATE members SET status=? WHERE id=?").bind(status,id).run();
      return result.meta.changes ? Response.json({ok:true}) : fail("Member not found.",404);
    }
    if(data.action==="expiry") {
      const id=clean(data.id,30),expiresAt=clean(data.expiresAt,10);
      if(!id||!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)||Number.isNaN(Date.parse(expiresAt+"T00:00:00Z"))) return fail("Choose a valid expiry date.");
      const result=await db.prepare("UPDATE members SET expires_at=? WHERE id=?").bind(expiresAt,id).run();
      return result.meta.changes ? Response.json({ok:true}) : fail("Member not found.",404);
    }
    if(data.action==="member-notification") {
      const memberId=clean(data.memberId,30),body=clean(data.body,1000),title=clean(data.title,120)||"Membership notification";
      if(!memberId||!body) return fail("Enter a notification message.");
      const member=await db.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first();
      if(!member) return fail("Member not found.",404);
      await db.prepare("INSERT INTO member_notifications (member_id,title,body,created_at) VALUES (?,?,?,?)").bind(memberId,title,body,now).run();
      return Response.json({ok:true});
    }
    if(data.action==="promos") {
      const campaign=clean(data.campaign,100),raw=clean(data.codes,20000);
      const codes=[...new Set(raw.split(/[\s,;]+/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
      if(!campaign||!codes.length) return fail("Enter a campaign and at least one code.");
      if(codes.length>500 || codes.some(s=>s.length>64||!/^[A-Z0-9_-]+$/.test(s))) return fail("Use up to 500 alphanumeric codes, with hyphens or underscores.");
      const statements=codes.map(code=>db.prepare("INSERT OR IGNORE INTO promos (code,campaign,status,created_at) VALUES (?,?,'available',?)").bind(code,campaign,now));
      const results=await db.batch(statements);
      return Response.json({added:results.filter(x=>x.meta.changes).length,duplicates:results.filter(x=>!x.meta.changes).length});
    }
    if(data.action==="assign") {
      const code=clean(data.code,64),memberId=clean(data.memberId,30);
      const member=await db.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first();
      if(!member) return fail("Select a valid member.");
      const result=await db.prepare("UPDATE promos SET member_id=?,status='assigned' WHERE code=? AND status='available'").bind(memberId,code).run();
      return result.meta.changes ? Response.json({ok:true}) : fail("Code already assigned or unavailable.",409);
    }
    if(data.action==="update") {
      const title=clean(data.title,150),body=clean(data.body,3000);
      if(!title||!body) return fail("Title and message are required.");
      await db.prepare("INSERT INTO updates (title,body,created_at) VALUES (?,?,?)").bind(title,body,now).run();
      return Response.json({ok:true});
    }
    return fail("Unknown action.");
  } catch(e) {console.error(e);return fail("Could not save. Please try again.",500)}
}
