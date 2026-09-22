import { DB } from "../../../lib/platform";
import { getClubAdmin } from "../../admin-auth";
import { calculateMembershipExpiry, expireDueMemberships, getMembershipSettings } from "../../../lib/membership";
import { writeAudit } from "../../../lib/audit";
import { emailMemberPaymentDecision } from "../../../lib/account-emails";
const env = { DB };

export const dynamic="force-dynamic";
const clean=(v:unknown,n=200)=>typeof v==="string"?v.trim().slice(0,n):"";
const error=(message:string,status=400)=>Response.json({error:message},{status});

export async function GET(){
 const admin=await getClubAdmin();
 if(!admin||!["executive","membership"].includes(admin.role))return error("Membership administrator access required.",403);
 try{
  await expireDueMemberships();
  const [payments,settings]=await Promise.all([
   env.DB.prepare("SELECT p.id,p.member_id AS memberId,m.first_name AS firstName,m.last_name AS lastName,p.amount,p.reference,p.receipt_name AS receiptName,p.status,p.note,p.created_at AS createdAt,p.reviewed_at AS reviewedAt,p.reviewed_by AS reviewedBy FROM payments p JOIN members m ON m.id=p.member_id ORDER BY p.created_at DESC").all(),
   getMembershipSettings(),
  ]);
  return Response.json({payments:payments.results,settings},{headers:{"Cache-Control":"no-store"}});
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
   const payment=await db.prepare("SELECT member_id AS memberId,status,amount FROM payments WHERE id=?").bind(id).first() as {memberId:string;status:string;amount:number}|null;
   if(!payment||payment.status!=="submitted")return error("Payment is no longer awaiting review.",409);
   const member=await db.prepare("SELECT id,email,first_name AS firstName,last_name AS lastName,status,expires_at AS expiresAt FROM members WHERE id=?").bind(payment.memberId).first() as {id:string;email:string;firstName:string;lastName:string;status:string;expiresAt:string}|null;
   if(!member)return error("Member record not found.",404);

   const statements=[db.prepare("UPDATE payments SET status=?,note=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status='submitted'").bind(status,note,now,admin.email,id)];
   let expiresAt=member.expiresAt;
   if(status==="approved"){
    expiresAt=calculateMembershipExpiry(await getMembershipSettings(),new Date());
    statements.push(db.prepare("UPDATE members SET status='active',expires_at=? WHERE id=?").bind(expiresAt,payment.memberId));
   }
   await db.batch(statements);
   await writeAudit(admin,status==="approved"?"payment_approved":"payment_rejected","payment",id,{status:"submitted",amount:payment.amount},{status,note,reviewedBy:admin.email},note);
   if(status==="approved")await writeAudit(admin,"membership_activated","member",payment.memberId,member,{status:"active",expiresAt},"Activated after approved payment");
   await emailMemberPaymentDecision(member,status as "approved"|"rejected",payment.amount,expiresAt,note);
   return Response.json({ok:true,expiresAt});
  }

  if(action==="expiry-settings"){
   const before=await getMembershipSettings();
   const validityDays=Number(v.membershipValidityDays),reminderDays=Number(v.expiryReminderDays),fee=Number(v.membershipFee);
   const seasonName=clean(v.seasonName,60),seasonStartDate=clean(v.seasonStartDate,10),seasonEndDate=clean(v.seasonEndDate,10);
   const registrationOpen=Boolean(v.registrationOpen);
   if(!Number.isInteger(validityDays)||validityDays<1||validityDays>3650)return error("Membership validity must be between 1 and 3650 days.");
   if(!Number.isInteger(reminderDays)||reminderDays<0||reminderDays>validityDays)return error("Reminder days must be between 0 and the membership validity period.");
   if(!Number.isInteger(fee)||fee<0||fee>100000)return error("Enter a valid membership fee.");
   if(!seasonName)return error("Season name is required.");
   if(!/^\d{4}-\d{2}-\d{2}$/.test(seasonStartDate)||!/^\d{4}-\d{2}-\d{2}$/.test(seasonEndDate)||seasonEndDate<seasonStartDate)return error("Choose valid season start and end dates.");
   await db.prepare("INSERT INTO club_settings (id,membership_validity_days,expiry_reminder_days,updated_at,season_name,season_start_date,season_end_date,membership_fee,registration_open) VALUES (1,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET membership_validity_days=excluded.membership_validity_days,expiry_reminder_days=excluded.expiry_reminder_days,updated_at=excluded.updated_at,season_name=excluded.season_name,season_start_date=excluded.season_start_date,season_end_date=excluded.season_end_date,membership_fee=excluded.membership_fee,registration_open=excluded.registration_open")
    .bind(validityDays,reminderDays,now,seasonName,seasonStartDate,seasonEndDate,fee,registrationOpen?1:0).run();
   const after=await getMembershipSettings();
   await writeAudit(admin,"membership_settings_changed","settings","club_settings",before,after,"Season and expiry settings updated");
   return Response.json({ok:true,settings:after});
  }

  return error("Unknown action.");
 }catch(e){console.error(e);return error("Could not save. Please try again.",500)}
}
