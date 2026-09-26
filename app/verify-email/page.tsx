import { writeAudit } from "../../lib/audit";
import { sendVerificationCompleteEmails, verifyEmailToken } from "../../lib/email-verification";
import "../member-login/member-login.css";

export const dynamic="force-dynamic";

export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const {token}=await searchParams;
 if(!token)return <main className="member-login-page"><section className="member-login-stage"><section className="member-login-card"><p className="eyebrow">EMAIL VERIFICATION</p><h1>Verification link missing</h1><p>Open the verification link from your Township Rollers email, or request a new one from the member login screen.</p><a className="member-login-primary" href="/member-login">Member login</a></section></section></main>;

 const result=await verifyEmailToken(token);
 if(!result.ok || !result.member){
  const message=!result.ok && result.reason==="expired"?"This verification link has expired.":"This verification link is invalid or has already been used.";
  return <main className="member-login-page"><section className="member-login-stage"><section className="member-login-card"><p className="eyebrow">EMAIL VERIFICATION</p><h1>Verification could not be completed</h1><p>{message}</p><a className="member-login-primary" href="/member-login">Request a new verification email</a></section></section></main>;
 }

 const member=result.member;
 if(!result.alreadyVerified){
  await writeAudit({email:member.email,name:member.firstName+" "+member.lastName,role:"member"},"email_verified","member",member.memberId,undefined,{emailVerified:true},"Member verified email address");
  await sendVerificationCompleteEmails({id:member.memberId,email:member.email,firstName:member.firstName,lastName:member.lastName});
 }

 return <main className="member-login-page"><section className="member-login-stage"><section className="member-login-card"><p className="eyebrow">EMAIL VERIFIED</p><h1>Your email is verified</h1><p>{result.alreadyVerified?"This email address was already verified.":"Your Township Rollers membership email has been verified successfully."}</p><p>You can now sign in. Your membership will remain pending until the membership office approves your payment.</p><a className="member-login-primary" href="/member-login">Continue to member login</a></section></section></main>;
}
