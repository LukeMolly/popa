import { DB } from "../../lib/platform";
const env = { DB };
import {getChatGPTUser} from "../chatgpt-auth";
import MemberLoginClient from "./member-login-client";
import Link from "next/link";
import "./member-login.css";
import "./password-form.css";

export const dynamic = "force-dynamic";

export default async function MemberLoginPage() {
  const user = await getChatGPTUser();
  let linked = false;
  if (user) {
    try { linked = Boolean(await env.DB.prepare("SELECT id FROM members WHERE lower(email)=lower(?) ORDER BY created_at DESC LIMIT 1").bind(user.email).first()); }
    catch { linked = false; }
  }
  return <main className="member-login-page">
    <header className="member-login-header"><Link href="/" className="member-login-brand"><span className="mini-crest">TR</span><span>Township Rollers F.C.</span></Link><a href="/register">Open an account</a></header>
    <section className="member-login-stage">
      <div className="member-login-art" aria-hidden="true"><div><span>MEMBERSHIP ACCESS</span><strong>POPA POPA</strong><p>One club. One membership.</p></div></div>
      <section className="member-login-card">
        <p className="eyebrow">MEMBER ACCESS</p>
        {!user ? <>
          <h1>Sign in to your membership</h1>
          <p>Use your email address or +267 mobile number and your 4-character PIN.</p>
          <MemberLoginClient/>
          <div className="member-login-help"><strong>New member?</strong><span>Register first, then sign in using the same email address or mobile number.</span><a href="/register">Create membership account</a></div>
        </> : linked ? <>
          <h1>Welcome back</h1><p>Your signed-in email is linked to a Township Rollers membership.</p>
          <div className="signed-email"><small>SIGNED IN AS</small><strong>{user.email}</strong></div>
          <a className="member-login-primary" href="/account">Open my membership</a><a className="member-login-secondary" href="/member-logout">Sign out</a>
        </> : <>
          <h1>No membership found</h1><p>No member record is linked to <strong>{user.email}</strong>.</p>
          <a className="member-login-primary" href="/register">Complete registration</a><a className="member-login-secondary" href="/member-logout">Use another email</a>
        </>}
        <p className="member-login-note">PINs are stored as one-way hashes. Five failed attempts temporarily lock the account.</p>
      </section>
    </section>
  </main>;
}
