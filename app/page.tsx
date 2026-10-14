import {ClubLogo} from "./components/club-logo";
import {getClubAdmin} from "./admin-auth";

export const dynamic = "force-dynamic";

export default async function PortalHome(){
 const admin = await getClubAdmin();
 const firstName = admin?.name?.trim().split(/\s+/)[0] || "Administrator";
 return <main className="gateway-page">
  <header className="gateway-header"><a href="/" className="gateway-brand"><ClubLogo/><span><strong>Township Rollers F.C.</strong><small>KYC Onboarding</small></span></a></header>
  <section className="gateway-hero"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in club colours"/><div className="gateway-overlay"/><div className="gateway-copy"><p>POPA POPA EA IPOPA</p><h1>One club.<br/>One membership platform.</h1><span>Complete your KYC registration and connect with the club administration.</span></div></section>
  <section className="gateway-actions">
   {admin ? (
    <div className="gateway-greeting">
     <span className="gateway-greeting-mark"><ClubLogo className="gateway-greeting-crest"/></span>
     <div className="gateway-greeting-copy">
      <p className="gateway-greeting-label">POPA MEMBERSHIP</p>
      <h2>Hi, <span>{firstName}</span><span aria-hidden="true" className="gateway-greeting-wave"> 👋</span></h2>
      <p>Welcome back to POPA.</p>
     </div>
    </div>
   ) : (
    <div className="gateway-intro"><p className="eyebrow">JOIN THE POPA FAMILY</p><h2>Welcome to POPA Membership</h2><p>Join the Township Rollers family by submitting your KYC information. After registration, contact the membership administrator on WhatsApp.</p></div>
   )}
   <div className="gateway-grid">
    <article className="access-card member-access"><span className="access-number">01</span><h3>POPA KYC Registration</h3><p>Complete your registration details and send them to the membership office.</p><a href="/register">Start KYC Registration <span>→</span></a><small>2026–2027 season membership</small></article>
    <article className="access-card admin-access"><span className="access-number">02</span><h3>Admin Login</h3><p>Review registrations, verify payments and manage club memberships.</p><a href="/admin-login?return_to=/admin">Continue as administrator <span>→</span></a><small>For authorised club officials.</small></article>
   </div>
  </section>
  <footer className="gateway-footer"><span>Township Rollers F.C. Membership</span></footer>
 </main>
}
