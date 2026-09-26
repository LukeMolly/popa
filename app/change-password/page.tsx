import { redirect } from "next/navigation";
import { DB } from "../../lib/platform";
import { getMemberSession } from "../../lib/member-auth";
import ChangePasswordClient from "./change-password-client";
import "../member-login/member-login.css";
import "../member-login/password-form.css";

export default async function ChangePasswordPage(){
 const member=await getMemberSession();
 if(!member)redirect("/member-login");
 const contact=await DB.prepare("SELECT phone,phone_verified_at AS phoneVerifiedAt FROM members WHERE id=?").bind(member.id).first<{phone:string;phoneVerifiedAt:string}>();
 return <main className="member-login-page"><section className="member-login-stage">
  <div className="member-login-art" aria-hidden="true"><div><span>ACCOUNT SECURITY</span><strong>POPA POPA</strong><p>Securely customize your private membership PIN.</p></div></div>
  <section className="member-login-card"><p className="eyebrow">PIN SECURITY</p><h1>{member.passwordMustChange?"Create your new PIN":"Customize your PIN"}</h1><p>{member.passwordMustChange?"Create a private 4-character PIN to continue.":"We will verify your registered mobile number before changing your 4-character PIN."}</p>
   <ChangePasswordClient phone={contact?.phone||""} requireOtp={!member.passwordMustChange} phoneVerified={Boolean(contact?.phoneVerifiedAt)}/>
  </section>
 </section></main>;
}
