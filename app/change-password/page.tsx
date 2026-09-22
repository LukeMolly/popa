import { redirect } from "next/navigation";
import { getMemberSession } from "../../lib/member-auth";
import ChangePasswordClient from "./change-password-client";
import "../member-login/member-login.css";
import "../member-login/password-form.css";

export default async function ChangePasswordPage(){
  const member=await getMemberSession();
  if(!member)redirect("/member-login");
  if(!member.passwordMustChange)redirect("/account");
  return <main className="member-login-page"><section className="member-login-stage">
    <div className="member-login-art" aria-hidden="true"><div><span>ACCOUNT SECURITY</span><strong>POPA POPA</strong><p>Create your private membership password.</p></div></div>
    <section className="member-login-card"><p className="eyebrow">PASSWORD RESET</p><h1>Create your new password</h1><p>Enter a private 4-character alphanumeric password before opening your membership.</p><ChangePasswordClient/></section>
  </section></main>;
}
