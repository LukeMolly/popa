import { DB } from "../../../lib/platform";
const env = { DB };
import { getClubAdmin } from "../../admin-auth";
import { PAYMENT_METHOD_CODES, paymentMethodLabel } from "../../../lib/payment-methods";
import { isTrustedWrite, writeDenied } from "../../../lib/request-security";
export const dynamic = "force-dynamic";
const clean = (x:unknown,n=200) => typeof x==="string" ? x.trim().slice(0,n) : "";
const fail = (message:string,status=400) => Response.json({error:message},{status});
export async function POST(request:Request) {
  if (!isTrustedWrite(request)) return writeDenied();
  const admin = await getClubAdmin();
  if (!admin || !["executive","membership"].includes(admin.role)) return fail("Membership administrator access required.",403);
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
    if(data.action==="offline-pop-approve") {
      const memberId=clean(data.id,30);
      const method=clean(data.method,30).toLowerCase();
      const methodDetail=clean(data.methodDetail,120);
      const proofChannel=clean(data.proofChannel,30).toLowerCase();
      const reference=clean(data.reference,100);
      const note=clean(data.note,300);
      const channels:Record<string,string>={
        whatsapp:"WhatsApp",
        bank_statement:"bank statement",
        in_person:"physical receipt / in-person verification",
        other:"other verified evidence"
      };
      if(!memberId) return fail("Choose a valid member.");
      if(!PAYMENT_METHOD_CODES.some(code=>code===method)) return fail("Choose a valid bank or payment method.");
      if(method==="other" && methodDetail.length<2) return fail("Describe the other payment method.");
      if(!Object.hasOwn(channels,proofChannel)) return fail("Choose how the offline payment evidence was verified.");
      if(reference.length<3) return fail("Enter a payment reference or receipt number (at least 3 characters).");
      // Member-scoped ID prevents repeated offline payment records, including simultaneous requests.
      const paymentId="offline-"+memberId;
      const paymentNote="Offline POP verified via "+channels[proofChannel]+"; payment method: "+paymentMethodLabel(method,methodDetail)+(note?"; note: "+note:"");
      // A single PostgreSQL statement records the P200 payment only if it
      // activates an eligible pending member. A concurrent retry cannot
      // activate the same member twice. Existing payment rows are never replaced.
      const result=await db.prepare(
        "WITH activated AS ("+
        " UPDATE members m SET status='active',expires_at=CASE WHEN m.status='pending' THEN '2027-07-31' ELSE m.expires_at END"+
        " WHERE m.id=? AND m.status IN ('pending','active') AND m.risk_status='none'"+
        " AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.member_id=m.id)"+
        " RETURNING m.id,m.expires_at"+
        "), recorded AS ("+
        " INSERT INTO payments (id,member_id,amount,receipt_key,receipt_name,receipt_type,reference,status,note,created_at,reviewed_at,reviewed_by,payment_method,payment_method_detail)"+
        " SELECT ?,a.id,200,'','','',?,'approved',?,?,?,?,?,? FROM activated a"+
        " ON CONFLICT (id) DO NOTHING RETURNING id"+
        ") SELECT (SELECT COUNT(*) FROM recorded)::int AS recorded,"+
        " (SELECT expires_at FROM activated LIMIT 1) AS expires_at"
      ).bind(memberId,paymentId,reference,paymentNote,now,now,admin.email,method,method==="other"?methodDetail:"").first() as {recorded:number;expires_at:string|null}|null;
      if(Number(result?.recorded)!==1) return fail("Offline approval was not recorded. The member may be active, flagged for review, or already have a payment record. Refresh the registry.",409);
      return Response.json({ok:true,paymentId,status:"active",paymentStatus:"approved",expiresAt:result?.expires_at||""});
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
      // Insert the whole batch atomically with PostgreSQL conflict handling.
      // Existing codes remain untouched, preserving their assignments.
      const result=await db.prepare(
        "INSERT INTO promos (code,campaign,status,created_at) " +
        "SELECT submitted.code,?,'available',? " +
        "FROM jsonb_array_elements_text(?::jsonb) AS submitted(code) " +
        "WHERE TRUE ON CONFLICT (code) DO NOTHING RETURNING code"
      ).bind(campaign,now,JSON.stringify(codes)).run();
      const added=result.meta.changes;
      return Response.json({added,duplicates:codes.length-added});
    }
    if(data.action==="assign") {
      const code=clean(data.code,64),memberId=clean(data.memberId,30);
      const member=await db.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first();
      if(!member) return fail("Select a valid member.");
      const result=await db.prepare("UPDATE promos SET member_id=?,status='assigned' WHERE code=? AND status='available'").bind(memberId,code).run();
      return result.meta.changes ? Response.json({ok:true}) : fail("Code already assigned or unavailable.",409);
    }
    return fail("Unknown action.");
  } catch(e) {console.error(e);return fail("Could not save. Please try again.",500)}
}
