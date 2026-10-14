import {ClubLogo} from "./components/club-logo";

export default function PortalHome(){
 return <main className="gateway-page">
  <header className="gateway-header"><a href="/" className="gateway-brand"><ClubLogo/><span><strong>Township Rollers F.C.</strong><small>KYC Onboarding</small></span></a></header>
  <section className="gateway-hero"><img src="/township-rollers-team.jpeg" alt="Township Rollers players in club colours"/><div className="gateway-overlay"/><div className="gateway-copy"><p>POPA POPA EA IPOPA</p><h1>One club.<br/>One membership platform.</h1><span>Complete your KYC registration and connect with the club administration.</span></div></section>
  <section className="gateway-actions">
   <div className="gateway-intro"><p className="eyebrow">JOIN THE POPA FAMILY</p><h2>Welcome to POPA Membership</h2><p>Join the Township Rollers family by submitting your KYC information. After registration, contact the membership administrator on WhatsApp.</p></div>
   <div className="gateway-grid">
    <article className="access-card member-access"><span className="access-number">01</span><h3>POPA KYC Registration</h3><p>Complete your registration details and send them to the membership office.</p><a href="/register">Start KYC Registration <span>→</span></a><small>2026–2027 season membership</small></article>
    <article className="access-card admin-access"><span className="access-number">02</span><h3>Admin Login</h3><p>Review registrations and payments, activate memberships, manage cards, codes, fixtures and team records.</p><a href="/admin-login?return_to=/admin">Continue as administrator <span>→</span></a><small>For authorised club officials.</small></article>
   </div>
  </section>
  <footer className="gateway-footer"><span>Township Rollers F.C. Membership</span></footer>
 </main>
}
