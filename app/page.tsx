import { getChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function PortalHome(){
 const user=await getChatGPTUser();
 return <main className="gateway-page">
  <header className="gateway-header"><a href="/" className="gateway-brand"><span className="mini-crest">TR</span><span><strong>Township Rollers F.C.</strong><small>Unified Membership Platform</small></span></a>{user&&<a href={chatGPTSignOutPath("/")} className="gateway-signout">Sign out</a>}</header>
  <section className="gateway-hero"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in club colours"/><div className="gateway-overlay"/><div className="gateway-copy"><p>POPA POPA EA IPOPA</p><h1>One club.<br/>One membership platform.</h1><span>Register, manage your membership and stay connected.</span></div></section>
  <section className="gateway-actions">
   <div className="gateway-intro"><p className="eyebrow">CHOOSE YOUR ACCESS</p><h2>{user?`Welcome, ${user.displayName}`:"Membership access"}</h2><p>Members and administrators use the same secure platform with separate role-based dashboards.</p></div>
   <div className="gateway-grid">
    <article className="access-card member-access"><span className="access-number">01</span><h3>Member Login</h3><p>View your digital card, membership status, payment history, fixtures, standings and club notices.</p><a href="/member-login">Continue as member <span>→</span></a><small>New member? <a href="/register">Open an account</a></small></article>
    <article className="access-card admin-access"><span className="access-number">02</span><h3>Admin Login</h3><p>Review registrations and payments, activate memberships, manage cards, codes, fixtures and communications.</p><a href="/admin-login?return_to=/admin">Continue as administrator <span>→</span></a><small>Sign in with your authorised email and six-digit PIN.</small></article>
   </div>
  </section>
  <footer className="gateway-footer"><span>Township Rollers F.C. Membership</span><a href="/club">View public club updates</a></footer>
 </main>
}
