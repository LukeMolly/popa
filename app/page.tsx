import { getChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";
import { getMemberSession } from "../lib/member-auth";

export const dynamic = "force-dynamic";

export default async function PortalHome(){
 const [user,memberSession]=await Promise.all([getChatGPTUser(),getMemberSession()]);
 return <main className="gateway-page">
  <header className="gateway-header"><a href="/" className="gateway-brand"><span className="mini-crest">TR</span><span><strong>Township Rollers F.C.</strong><small>Membership Platform</small></span></a>{user&&<a href={memberSession?"/member-logout":chatGPTSignOutPath("/")} className="gateway-signout">Sign out</a>}</header>
  <section className="gateway-hero"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in club colours"/><div className="gateway-overlay"/><div className="gateway-copy"><p>POPA POPA EA IPOPA</p><h1>One club.<br/>One membership platform.</h1><span>Register, manage your membership and verify your status.</span></div></section>
  <section className="gateway-actions">
   <div className="gateway-intro"><p className="eyebrow">TOWNSHIP ROLLERS MEMBERSHIP</p><h2>{user?"Welcome, "+user.displayName:"Start your membership"}</h2><p>Register for the first time below. Already registered? Use Member Login to access your membership.</p></div>
   <div className="gateway-grid">
    <article className="access-card member-access"><span className="access-number">01</span><h3>Membership Registration</h3><p>Register as a Township Rollers member and set up your membership profile.</p><a href="/register">Membership Registration <span aria-hidden="true">→</span></a><small>Already registered? <a href="/member-login">Member Login</a></small></article>
    <article className="access-card admin-access"><span className="access-number">02</span><h3>Admin Login</h3><p>Review registrations and payments, manage member status, analyse membership data and download reports.</p><a href="/admin-login?return_to=/admin">Continue as administrator <span>→</span></a><small>Sign in with your authorised email and six-digit PIN.</small></article>
   </div>
  </section>
  <footer className="gateway-footer"><span>Township Rollers F.C. Membership</span><span>Registration · Payments · Membership reporting</span></footer>
 </main>
}
