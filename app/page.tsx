import { ClubLogo } from "./components/club-logo";
import { getClubAdmin } from "./admin-auth";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const admin = await getClubAdmin();
  const firstName = admin?.name?.trim().split(/\s+/)[0] || "Administrator";

  return (
    <main className="welcome-screen">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="welcome-crest">
          <ClubLogo className="welcome-club-logo" />
        </div>
        <p className="welcome-club-name">TOWNSHIP ROLLERS F.C.</p>
        <p className="welcome-motto">POPA POPA EA IPOPA</p>

        {admin ? (
          <>
            <h1 id="welcome-title">Hi, <span>{firstName}</span><span aria-hidden="true"> 👋</span></h1>
            <p className="welcome-description">Welcome back to POPA.</p>
          </>
        ) : (
          <>
            <h1 id="welcome-title">Welcome to <span>POPA.</span></h1>
            <p className="welcome-description">Your club. Your membership.</p>
          </>
        )}

        <div className="welcome-season"><span>2026–2027 MEMBERSHIP</span></div>

        <nav className="welcome-actions" aria-label="Membership access">
          <a className="welcome-action welcome-action-primary" href="/register">
            <span>Membership Registration</span><span aria-hidden="true">→</span>
          </a>
          <a className="welcome-action welcome-action-secondary" href="/admin-login?return_to=/admin">
            <span>Administrator Login</span><span aria-hidden="true">→</span>
          </a>
        </nav>

        <p className="welcome-card-footer">Official Township Rollers membership portal</p>
      </section>
      <p className="welcome-outer-footer">Township Rollers F.C. · Botswana</p>
    </main>
  );
}
