import ForgotPinClient from "./forgot-pin-client";
import "../member-login/member-login.css";
import "../member-login/password-form.css";
export const metadata = { title: "Forgot PIN | Township Rollers Membership" };
export default function ForgotPinPage(){
 return <main className="member-login-page"><section className="member-login-stage"><div className="member-login-art" aria-hidden="true"><div><span>MEMBER ACCOUNT RECOVERY</span><strong>POPA POPA</strong><p>Protecting your membership access.</p></div></div><section className="member-login-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Forgot your PIN?</h1><p>Enter your registered mobile number to receive a verification code by SMS.</p><p>For your security, never send your current PIN or a verification code to anyone.</p><ForgotPinClient/></section></section></main>;
}
