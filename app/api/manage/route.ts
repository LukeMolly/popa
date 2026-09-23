import { randomBytes } from "node:crypto";
import { DB } from "../../../lib/platform";
import { getClubAdmin } from "../../admin-auth";
import { newPasswordRecord } from "../../../lib/member-auth";
import { writeAudit } from "../../../lib/audit";
import { calculateMembershipExpiry, getMembershipSettings } from "../../../lib/membership";
import { emailMemberStatusChange, emailMemberTemporaryCode } from "../../../lib/account-emails";
import { notifyMembershipStatus } from "../../../lib/member-notifications";
const env = { DB };

export const dynamic = "force-dynamic";
const clean=(x:unknown,n=200)=>typeof x==="string"?x.trim().slice(0,n):"";
const fail=(message:string,status=400)=>Response.json({error:message},{status});
const tempCode=()=>{
 const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 const bytes=randomBytes(4);
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
};

export async function POST(request:Request){
 const admin=await getClubAdmin();
 if(!admin||!["executive","membership"].includes(admin.role))return fail("Membership administrator access required.",403);
 try{
  const data=await request.json() as Record<string,unknown>,db=env.DB,now=new Date().toISOString();

  if(data.action==="member"){
   const first=clean(data.firstName,80),last=clean(data.lastName,80),email=clean(data.email,160).toLowerCase(),phone=clean(data.phone,30);
   if(!first||!last)return fail("First and last names are required.");
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Enter a valid email address.");
   if(phone&&!/^\+?[0-9][0-9\s-]{6,19}$/.test(phone))return fail("Enter a valid mobile number.");
   const settings=await getMembershipSettings(),id="TRFC-"+crypto.randomUUID().slice(0,8).toUpperCase(),token=crypto.randomUUID();
   const expiresAt=clean(data.expiresAt,10)||calculateMembershipExpiry(settings,new Date());
   await db.prepare("INSERT INTO members (id,first_name,last_name,phone,email,status,expires_at,token,created_at) VALUES (?,?,?,?,?,'pending',?,?,?)")
    .bind(id,first,last,phone,email,expiresAt,token,now).run();
   await writeAudit(admin,"member_created","member",id,undefined,{firstName:first,lastName:last,email,phone,status:"pending",expiresAt},"Created by administrator");
   return Response.json({id});
  }

  if(data.action==="kyc-update"){
   const id=clean(data.id,30),first=clean(data.firstName,80),last=clean(data.lastName,80),email=clean(data.email,160).toLowerCase(),phone=clean(data.phone,30),idNumber=clean(data.idNumber,80),dateOfBirth=clean(data.dateOfBirth,10),placeOfBirth=clean(data.placeOfBirth,120),membershipLocation=clean(data.membershipLocation,120),gender=clean(data.gender,40);
   if(!id||!first||!last)return fail("Member, first name and last name are required.");
   if(email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return fail("Enter a valid email address.");
   if(phone&&!/^\\+?[0-9][0-9\\s-]{6,19}$/.test(phone))return fail("Enter a valid mobile number.");
   if(dateOfBirth&&(!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateOfBirth)||Number.isNaN(Date.parse(dateOfBirth+"T00:00:00Z"))))return fail("Enter a valid date of birth.");
   const before=await db.prepare("SELECT first_name AS firstName,last_name AS lastName,email,phone,id_number AS idNumber,date_of_birth AS dateOfBirth,place_of_birth AS placeOfBirth,membership_location AS membershipLocation,gender FROM members WHERE id=?").bind(id).first();
   if(!before)return fail("Member not found.",404);
   await db.prepare("UPDATE members SET first_name=?,last_name=?,email=?,phone=?,id_number=?,date_of_birth=?,place_of_birth=?,membership_location=?,gender=? WHERE id=?").bind(first,last,email,phone,idNumber||null,dateOfBirth||null,placeOfBirth||null,membershipLocation||null,gender||null,id).run();
   await writeAudit(admin,"member_kyc_updated","member",id,before,{firstName:first,lastName:last,email,phone,idNumber,dateOfBirth,placeOfBirth,membershipLocation,gender},"KYC corrected by membership administrator");
   return Response.json({ok:true});
  }

  if(data.action==="archive"){
   const id=clean(data.id,30);
   const before=await db.prepare("SELECT id,status FROM members WHERE id=?").bind(id).first() as {id:string;status:string}|null;
   if(!before)return fail("Member not found.",404);
   await db.batch([db.prepare("UPDATE members SET status='archived' WHERE id=?").bind(id),db.prepare("DELETE FROM member_sessions WHERE member_id=?").bind(id)]);
   await writeAudit(admin,"member_archived","member",id,before,{status:"archived"},"Member archived; record retained");
   return Response.json({ok:true});
  }

  if(data.action==="restore"){
   const id=clean(data.id,30);
   const before=await db.prepare("SELECT id,status FROM members WHERE id=?").bind(id).first() as {id:string;status:string}|null;
   if(!before)return fail("Member not found.",404);
   if(before.status!=="archived")return fail("Only archived members can be restored.");
   await db.prepare("UPDATE members SET status='pending' WHERE id=?").bind(id).run();
   await writeAudit(admin,"member_restored","member",id,before,{status:"pending"},"Archived member restored to pending");
   return Response.json({ok:true});
  }

  if(data.action==="delete"){
   if(admin.role!=="executive")return fail("Executive administrator access required to permanently delete a member.",403);
   const id=clean(data.id,30),reason=clean(data.reason,300);
   if(!id||!reason)return fail("Member and deletion reason are required.");
   const before=await db.prepare("SELECT id,first_name AS firstName,last_name AS lastName,email,phone,status FROM members WHERE id=?").bind(id).first();
   if(!before)return fail("Member not found.",404);
   await db.batch([
    db.prepare("DELETE FROM member_sessions WHERE member_id=?").bind(id),
    db.prepare("DELETE FROM member_login_attempts WHERE email IN (SELECT email FROM members WHERE id=?)").bind(id),
    db.prepare("DELETE FROM password_recovery_requests WHERE member_id=?").bind(id),
    db.prepare("DELETE FROM email_verification_tokens WHERE member_id=?").bind(id),
    db.prepare("DELETE FROM member_notification_messages WHERE notification_id IN (SELECT id FROM member_notifications WHERE member_id=?)").bind(id),
    db.prepare("DELETE FROM member_notifications WHERE member_id=?").bind(id),
    db.prepare("UPDATE promos SET member_id=NULL,status='available' WHERE member_id=?").bind(id),
    db.prepare("DELETE FROM payments WHERE member_id=?").bind(id),
    db.prepare("DELETE FROM members WHERE id=?").bind(id)
   ]);
   await writeAudit(admin,"member_deleted","member",id,before,undefined,"Executive deletion: "+reason);
   return Response.json({ok:true});
  }

  if(data.action==="status"){
   const id=clean(data.id,30),status=clean(data.status,20);
   if(!["active","pending","expired","suspended"].includes(status))return fail("Invalid status.");
   const member=await db.prepare("SELECT id,email,first_name AS firstName,last_name AS lastName,status,expires_at AS expiresAt FROM members WHERE id=?").bind(id).first() as {id:string;email:string;firstName:string;lastName:string;status:string;expiresAt:string}|null;
   if(!member)return fail("Member not found.",404);
   let expiresAt=member.expiresAt;
   if(status==="active"&&(!expiresAt||expiresAt<new Date().toISOString().slice(0,10)))expiresAt=calculateMembershipExpiry(await getMembershipSettings(),new Date());
   await db.prepare("UPDATE members SET status=?,expires_at=? WHERE id=?").bind(status,expiresAt,id).run();
   await writeAudit(admin,"membership_status_changed","member",id,member,{status,expiresAt},"Manual status change");
   if(member.email)await emailMemberStatusChange(member,status,expiresAt);
   await notifyMembershipStatus(id,status,expiresAt);
   return Response.json({ok:true,expiresAt});
  }

  if(data.action==="expiry"){
   const id=clean(data.id,30),expiresAt=clean(data.expiresAt,10);
   if(!id||!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)||Number.isNaN(Date.parse(expiresAt+"T00:00:00Z")))return fail("Choose a valid expiry date.");
   const member=await db.prepare("SELECT status,expires_at AS expiresAt FROM members WHERE id=?").bind(id).first() as {status:string;expiresAt:string}|null;
   if(!member)return fail("Member not found.",404);
   await db.prepare("UPDATE members SET expires_at=? WHERE id=?").bind(expiresAt,id).run();
   await writeAudit(admin,"membership_expiry_changed","member",id,member,{status:member.status,expiresAt},"Manual expiry change");
   return Response.json({ok:true});
  }

  if(data.action==="password-reset"){
   const id=clean(data.id,30);
   const member=await db.prepare("SELECT id,email,first_name AS firstName,last_name AS lastName FROM members WHERE id=?").bind(id).first() as {id:string;email:string;firstName:string;lastName:string}|null;
   if(!member)return fail("Member not found.",404);
   const code=tempCode(),record=await newPasswordRecord(code);
   await db.batch([
    db.prepare("UPDATE members SET password_salt=?,password_hash=?,password_must_change=TRUE WHERE id=?").bind(record.salt,record.hash,id),
    db.prepare("DELETE FROM member_sessions WHERE member_id=?").bind(id),
    db.prepare("UPDATE password_recovery_requests SET status='resolved',resolved_at=?,resolved_by=? WHERE member_id=? AND status='pending'").bind(now,admin.email,id)
   ]);
   await writeAudit(admin,"password_reset_issued","member",id,undefined,{temporaryCodeIssued:true},"Temporary code issued; code value is not stored in audit log");
   await emailMemberTemporaryCode(member,code);
   return Response.json({ok:true,temporaryCode:code});
  }

  return fail("Unknown action.");
 }catch(e){
  console.error(e);
  const text=String(e).toLowerCase();
  if(text.includes("unique")||text.includes("23505"))return fail("That email or identity is already registered.",409);
  return fail("Could not save. Please try again.",500);
 }
}
