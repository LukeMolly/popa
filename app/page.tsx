import {ClubLogo} from "./components/club-logo";
import { getChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function PortalHome(){
 const user=await getChatGPTUser();
 return <main className="gateway-page">
  <header className="gateway-header"><a href="/" className="gateway-brand"><ClubLogo/><span><strong>Township Rollers F.C.</strong><small>Unified Membership Platform</small></span></a>{user&&<a href={chatGPTSignOutPath("/")} className="gateway-signout">Sign out</a>}</header>
  <section className="gateway-hero"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in club colours"/><div className="gateway-overlay"/><div className="gateway-copy"><p>POPA POPA EA IPOPA</p><h1>One club.<br/>One membership platform.</h1><span>Register, manage your membership and stay connected.</span></div></section>
  <section className="gateway-actions">
   <div className="gateway-intro"><p className="eyebrow">JOIN THE POPA FAMILY</p>{user ? <><h2>Hi, {user.displayName.trim().split(" ")[0] || "Member"}</h2><p>Welcome to the Popa Popa ya Ipopa family.</p></> : <><h2>Welcome to POPA Membership</h2><p>Join the Township Rollers family by registering for your official membership. Already registered? Sign in to access your member portal.</p></>}</div>
   <div className="gateway-grid">
    <article className="access-card member-access"><span className="access-number">01</span><h3>POPA Membership Registration</h3><p>Register for your POPA membership and complete your existing membership application process.</p><a href="/register">Register for POPA Membership <span>→</span></a><small>Already registered? <a href="/member-login">Member Login</a></small></article>
    <article className="access-card admin-access"><span className="access-number">02</span><h3>Admin Login</h3><p>Review registrations and payments, activate memberships, manage cards, codes, fixtures and communications.</p><a href="/admin-login?return_to=/admin">Continue as administrator <span>→</span></a><small>Sign in with your authorised email and six-digit PIN.</small></article>
   </div>
  </section>
  <footer className="gateway-footer"><span>Township Rollers F.C. Membership</span><a href="/club">View public club updates</a></footer>
 </main>
}
