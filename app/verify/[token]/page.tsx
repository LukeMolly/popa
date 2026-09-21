import { DB } from "../../../lib/platform";
const env = { DB };

export const dynamic = "force-dynamic";

type MemberStatus = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  expiresAt: string;
};

export default async function Verify({params}:{params:Promise<{token:string}>}) {
  try {
    const {token} = await params;
    const member = await env.DB
      .prepare("SELECT id,first_name AS firstName,last_name AS lastName,status,expires_at AS expiresAt FROM members WHERE token=?")
      .bind(token)
      .first() as MemberStatus | null;

    if (!member) {
      return <VerificationShell><div className="verify-symbol invalid">×</div><h1>Card not recognised</h1><p>This QR code does not match a Township Rollers membership record.</p></VerificationShell>;
    }

    const expired = member.status === "active" && Boolean(member.expiresAt) && member.expiresAt < new Date().toISOString().slice(0,10);
    const status = expired ? "expired" : member.status.toLowerCase();
    const positive = status === "active" || status === "pending";
    const negative = status === "suspended" || status === "rejected" || status === "expired";
    const colour = positive ? "positive" : negative ? "negative" : "neutral";

    return (
      <VerificationShell>
        <div className={"verify-symbol "+colour}>{positive ? "✓" : "!"}</div>
        <span className={"verify-status "+colour}>{status}</span>
        <h1>{member.firstName} {member.lastName}</h1>
        <p>{status === "active" ? "This membership is active and valid." : status === "pending" ? "This membership is recorded and awaiting approval." : status === "suspended" ? "This membership has been suspended." : status === "rejected" ? "This membership application was rejected." : status === "expired" ? "This membership has expired." : "This is the current recorded membership status."}</p>
        <dl>
          <div><dt>Member ID</dt><dd>{member.id}</dd></div>
          <div><dt>Status</dt><dd className={"status-text "+colour}>{status}</dd></div>
          <div><dt>Expiry</dt><dd>{member.expiresAt ? new Date(member.expiresAt+"T00:00:00").toLocaleDateString("en-BW",{dateStyle:"long"}) : "Not set"}</dd></div>
        </dl>
      </VerificationShell>
    );
  } catch (error) {
    console.error("Membership verification failed",error);
    return <VerificationShell><div className="verify-symbol invalid">!</div><h1>Unable to verify</h1><p>The membership service is temporarily unavailable. Please try again shortly.</p></VerificationShell>;
  }
}

function VerificationShell({children}:{children:React.ReactNode}) {
  return <main className="verify-page"><section className="verify-box"><div className="verify-mark"><div className="crest">TR</div><span>TOWNSHIP ROLLERS FC<br/><small>MEMBERSHIP VERIFICATION</small></span></div>{children}</section></main>;
}
