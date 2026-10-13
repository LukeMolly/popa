import Link from "next/link";
import "../member-login/member-login.css";
import "../member-login/password-form.css";
export const metadata = { title: "Forgot PIN | Township Rollers Membership" };
export default function ForgotPinPage(){
 return <main className="member-login-page"><section className="member-login-stage"><div className="member-login-art" aria-hidden="true"><div><span>MEMBER ACCOUNT RECOVERY</span><strong>POPA POPA</strong><p>Protecting your membership access.</p></div></div><section className="member-login-card"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Forgot your PIN?</h1><p>To protect your membership, please contact the Township Rollers membership office through its official communication channel and request a PIN reset. The office must verify your identity before helping you regain access.</p><p>For your security, never send your current PIN or a verification code to anyone.</p><Link className="member-login-primary" href="/member-login">Return to member login</Link></section></section></main>;
}
