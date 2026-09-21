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
    try {
      const record = await env.DB
        .prepare("SELECT id FROM members WHERE lower(email)=lower(?) ORDER BY created_at DESC LIMIT 1")
        .bind(user.email)
        .first();
      linked = Boolean(record);
    } catch {
      linked = false;
    }
  }

  return (
    <main className="member-login-page">
      <header className="member-login-header">
        <Link href="/" className="member-login-brand"><span className="mini-crest">TR</span><span>Township Rollers F.C.</span></Link>
        <a href="/register">Open an account</a>
      </header>
      <section className="member-login-stage">
        <div className="member-login-art" aria-hidden="true">
          <div><span>2026 / 2027</span><strong>POPA POPA</strong><p>One club. One membership.</p></div>
        </div>
        <section className="member-login-card">
          <p className="eyebrow">MEMBER ACCESS</p>
          {!user ? (
            <>
              <h1>Sign in to your membership</h1>
              <p>Use the email address and password created with your Township Rollers membership.</p>
              <MemberLoginClient/>
              <div className="member-login-help"><strong>New member?</strong><span>Register first and use the same email address when signing in.</span><a href="/register">Create membership account</a></div>
            </>
          ) : linked ? (
            <>
              <h1>Welcome back</h1>
              <p>Your signed-in email is linked to a Township Rollers membership.</p>
              <div className="signed-email"><small>SIGNED IN AS</small><strong>{user.email}</strong></div>
              <a className="member-login-primary" href="/account">Open my membership</a>
              <a className="member-login-secondary" href="/member-logout">Sign out</a>
            </>
          ) : (
            <>
              <h1>No membership found</h1>
              <p>No member record is linked to <strong>{user.email}</strong>. Register with this email, or sign out and use the email entered on your existing membership.</p>
              <a className="member-login-primary" href="/register">Complete registration</a>
              <a className="member-login-secondary" href="/member-logout">Use another email</a>
            </>
          )}
          <p className="member-login-note">Passwords are protected with one-way encryption. The club cannot view your password.</p>
        </section>
      </section>
    </main>
  );
}
