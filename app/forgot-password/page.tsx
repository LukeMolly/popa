import ForgotPasswordClient from "./forgot-password-client";
import "../member-login/member-login.css";
import "../member-login/password-form.css";

export default function ForgotPasswordPage(){
 return <main className="member-login-page">
  <section className="member-login-stage">
   <div className="member-login-art" aria-hidden="true"><div><span>ACCOUNT RECOVERY</span><strong>POPA POPA</strong><p>Recover access securely through the membership office.</p></div></div>
   <section className="member-login-card"><p className="eyebrow">PASSWORD RECOVERY</p><h1>Forgot your password?</h1><p>Enter your membership ID and registered email address.</p><ForgotPasswordClient/></section>
  </section>
 </main>;
}
