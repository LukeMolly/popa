import { DB } from "../../../lib/platform";
const env = { DB };
import { getClubAdmin } from "../../admin-auth";

export const dynamic="force-dynamic";
const clean=(v:unknown,n=200)=>typeof v==="string"?v.trim().slice(0,n):"";
const error=(message:string,status=400)=>Response.json({error:message},{status});

export async function GET(){
 const admin=await getClubAdmin();
 if(!admin||!["executive","membership"].includes(admin.role))return error("Membership administrator access required.",403);
 try{
  const [payments,settings]=await Promise.all([
   env.DB.prepare("SELECT p.id,p.member_id AS memberId,m.first_name AS firstName,m.last_name AS lastName,p.amount,p.reference,p.receipt_name AS receiptName,p.status,p.note,p.created_at AS createdAt,p.reviewed_at AS reviewedAt FROM payments p JOIN members m ON m.id=p.member_id ORDER BY p.created_at DESC").all(),
   env.DB.prepare("SELECT membership_validity_days AS membershipValidityDays,expiry_reminder_days AS expiryReminderDays FROM club_settings WHERE id=1").first(),
  ]);
  return Response.json({payments:payments.results,settings:settings||{membershipValidityDays:334,expiryReminderDays:7}},{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error(e);return error("Membership office data unavailable.",500)}
}

export async function POST(request:Request){
 const admin=await getClubAdmin();
 if(!admin||!["executive","membership"].includes(admin.role))return error("Membership administrator access required.",403);
 try{
  const v=await request.json() as Record<string,unknown>,db=env.DB,now=new Date().toISOString();
  const action=clean(v.action,40);

  if(action==="review"){
   const id=clean(v.id,60),status=clean(v.status,20),note=clean(v.note,300);
   if(!["approved","rejected"].includes(status))return error("Choose approve or reject.");
   const payment=await db.prepare("SELECT member_id AS memberId,status FROM payments WHERE id=?").bind(id).first() as {memberId:string;status:string}|null;
   if(!payment||payment.status!=="submitted")return error("Payment is no longer awaiting review.",409);
   const statements=[db.prepare("UPDATE payments SET status=?,note=?,reviewed_at=? WHERE id=? AND status='submitted'").bind(status,note,now,id)];
   if(status==="approved"){
    statements.push(db.prepare("UPDATE members SET status='active',expires_at='2027-07-31' WHERE id=?").bind(payment.memberId));
   }
   await db.batch(statements);
   return Response.json({ok:true});
  }

  if(action==="expiry-settings"){
   const validityDays=Number(v.membershipValidityDays),reminderDays=Number(v.expiryReminderDays);
   if(!Number.isInteger(validityDays)||validityDays<1||validityDays>3650)return error("Membership validity must be between 1 and 3650 days.");
   if(!Number.isInteger(reminderDays)||reminderDays<0||reminderDays>validityDays)return error("Reminder days must be between 0 and the membership validity period.");
   await db.prepare("INSERT INTO club_settings (id,membership_validity_days,expiry_reminder_days,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET membership_validity_days=excluded.membership_validity_days,expiry_reminder_days=excluded.expiry_reminder_days,updated_at=excluded.updated_at").bind(validityDays,reminderDays,now).run();
   return Response.json({ok:true});
  }

  return error("Unknown action.");
 }catch(e){console.error(e);return error("Could not save. Please try again.",500)}
}
