import { DB } from "../../../../lib/platform";
import { isClubAdmin } from "../../../admin-auth";

export const dynamic = "force-dynamic";
// Independent security audit endpoint; does not alter existing member dashboards
// or the registration/approval workflow.
export async function GET() {
  if (!(await isClubAdmin(["executive", "membership"]))) {
    return Response.json({ error: "Membership administrator access required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const flags = await DB.prepare(
      "SELECT f.member_id AS memberId,f.flag_type AS flagType,f.selected_gender AS selectedGender," +
      "f.omang_gender AS omangGender,f.created_at AS createdAt,f.resolved_at AS resolvedAt," +
      "m.first_name AS firstName,m.last_name AS lastName " +
      "FROM member_identity_flags f JOIN members m ON m.id=f.member_id " +
      "WHERE f.resolved_at='' ORDER BY f.created_at DESC LIMIT 100"
    ).all();
    return Response.json({ flags: flags.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Omang security audit unavailable", error);
    return Response.json({ error: "Security flags are temporarily unavailable." }, { status: 503 });
  }
}
