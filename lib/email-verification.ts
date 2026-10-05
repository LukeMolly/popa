import { createHash, randomBytes } from "node:crypto";
import { DB } from "./platform";
import { appBaseUrl, button, emailShell, getMembershipAdminEmails, sendEmail } from "./email";

function hashToken(token:string){return createHash("sha256").update(token).digest("hex")}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c))}

export async function issueEmailVerification(member:{id:string;email:string;firstName:string;lastName:string}){
 const raw=randomBytes(32).toString("hex"),tokenHash=hashToken(raw),now=new Date(),expires=new Date(now.getTime()+24*60*60*1000);
 await DB.prepare("UPDATE email_verification_tokens SET used_at=? WHERE member_id=? AND used_at=''").bind(now.toISOString(),member.id).run();
 await DB.prepare("INSERT INTO email_verification_tokens (id,member_id,token_hash,expires_at,used_at,created_at) VALUES (?,?,?,?,?,?)")
  .bind(crypto.randomUUID(),member.id,tokenHash,expires.toISOString(),"",now.toISOString()).run();
 const link=appBaseUrl()+"/verify-email?token="+encodeURIComponent(raw);
 const fullName=escapeHtml((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:member.email,
  template:"member_email_verification",
  subject:"Verify your Township Rollers membership email",
  text:"Hello "+member.firstName+", verify your Township Rollers membership email: "+link+" This link expires in 24 hours.",
  html:emailShell("Verify your email","<p>Hello <strong>"+fullName+"</strong>,</p><p>Your Township Rollers membership account has been created. Confirm this email address before signing in.</p>"+button(link,"Verify email address")+"<p>This link expires in <strong>24 hours</strong>. If you did not register, you can ignore this message.</p>")
 });
}

export async function verifyEmailToken(raw:string){
 const tokenHash=hashToken(raw),now=new Date();
 const record=await DB.prepare("SELECT t.id,t.member_id AS memberId,t.expires_at AS expiresAt,t.used_at AS usedAt,m.email,m.first_name AS firstName,m.last_name AS lastName,m.email_verified_at AS emailVerifiedAt FROM email_verification_tokens t JOIN members m ON m.id=t.member_id WHERE t.token_hash=? LIMIT 1")
  .bind(tokenHash).first<{id:string;memberId:string;expiresAt:string;usedAt:string;email:string;firstName:string;lastName:string;emailVerifiedAt:string}>();
 if(!record)return {ok:false,reason:"invalid" as const};
 if(record.emailVerifiedAt)return {ok:true,alreadyVerified:true,member:record};
 if(record.usedAt)return {ok:false,reason:"used" as const};
 if(new Date(record.expiresAt)<=now)return {ok:false,reason:"expired" as const};
 await DB.batch([
  DB.prepare("UPDATE members SET email_verified_at=? WHERE id=?").bind(now.toISOString(),record.memberId),
  DB.prepare("UPDATE email_verification_tokens SET used_at=? WHERE id=?").bind(now.toISOString(),record.id)
 ]);
 return {ok:true,alreadyVerified:false,member:record};
}

export async function sendVerificationCompleteEmails(member:{id:string;email:string;firstName:string;lastName:string}){
 const fullName=escapeHtml((member.firstName+" "+member.lastName).trim());
 const memberMail=sendEmail({
  to:member.email,
  template:"member_email_verified",
  subject:"Email verified — Township Rollers membership",
  text:"Your email has been verified. Your membership application remains pending until payment is approved.",
  html:emailShell("Email verified","<p>Hello <strong>"+fullName+"</strong>,</p><p>Your email address has been verified successfully.</p><p>Your membership application is currently <strong>pending payment verification</strong>. We will email you again when your membership status changes.</p>"+button(appBaseUrl()+"/member-login","Open member login"))
 });
 const admins=await getMembershipAdminEmails();
 const adminMail=admins.length?sendEmail({
  to:admins,
  template:"admin_member_email_verified",
  subject:"Member email verified: "+member.id,
  text:member.firstName+" "+member.lastName+" ("+member.id+") has verified their email address.",
  html:emailShell("Member email verified","<p><strong>"+fullName+"</strong> has verified their email address.</p><p>Membership ID: <strong>"+escapeHtml(member.id)+"</strong></p>"+button(appBaseUrl()+"/admin","Open membership dashboard"))
 }):Promise.resolve({ok:false,skipped:true});
 return Promise.allSettled([memberMail,adminMail]);
}

export async function notifyAdminsOfRegistration(member:{id:string;email:string;firstName:string;lastName:string;membershipLocation:string},amount:number){
 const admins=await getMembershipAdminEmails();
 if(!admins.length)return {ok:false,skipped:true};
 const fullName=escapeHtml((member.firstName+" "+member.lastName).trim());
 return sendEmail({
  to:admins,
  template:"admin_new_registration",
  subject:"New membership registration: "+member.id,
  text:"New registration received from "+member.firstName+" "+member.lastName+" ("+member.id+"). Payment proof amount P"+amount+".",
  html:emailShell("New membership registration","<p>A new membership application has been submitted.</p><p><strong>"+fullName+"</strong><br>Membership ID: <strong>"+escapeHtml(member.id)+"</strong><br>Email: "+escapeHtml(member.email)+"<br>Region: "+escapeHtml(member.membershipLocation)+"<br>Fee submitted: P"+amount+"</p>"+button(appBaseUrl()+"/office","Review payment submission"))
 });
}
