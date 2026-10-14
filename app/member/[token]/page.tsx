import { redirect } from "next/navigation";
import { isClubAdmin } from "../../admin-auth";
import MemberPortal from "./member-portal-client";

export const dynamic = "force-dynamic";

// The member portal is no longer available to members. Preserve the existing
// administrator's member-record preview while members use KYC onboarding only.
export default async function ProtectedMemberPage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await isClubAdmin(["executive", "membership"]))) redirect("/register");
  return <MemberPortal params={params}/>;
}
