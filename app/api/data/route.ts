import { DB } from "../../../lib/platform";
import { getClubAdmin } from "../../admin-auth";
import { expireDueMemberships, getMembershipSettings } from "../../../lib/membership";
const env = { DB };

export const dynamic = "force-dynamic";

export async function GET() {
  const admin=await getClubAdmin();
  if (!admin||!["executive","membership"].includes(admin.role)) return Response.json({error:"Membership administrator access required."},{status:403});
  try {
    await expireDueMemberships();
    const db = env.DB;
    const [members,payments,audits,recoveryRequests,settings] = await Promise.all([
      db.prepare("SELECT id,first_name AS firstName,last_name AS lastName,phone,email,status,expires_at AS expiresAt,token,created_at AS createdAt,id_number AS idNumber,date_of_birth AS dateOfBirth,place_of_birth AS placeOfBirth,membership_location AS membershipLocation,gender,password_must_change AS passwordMustChange FROM members ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,member_id AS memberId,amount,reference,payment_method AS paymentMethod,payment_method_detail AS paymentMethodDetail,status,note,created_at AS createdAt,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy FROM payments ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,actor_email AS actorEmail,actor_name AS actorName,actor_role AS actorRole,action,entity_type AS entityType,entity_id AS entityId,note,created_at AS createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 250").all(),
      db.prepare("SELECT r.id,r.member_id AS memberId,r.email,r.status,r.requested_at AS requestedAt,r.resolved_at AS resolvedAt,r.resolved_by AS resolvedBy,m.first_name AS firstName,m.last_name AS lastName FROM password_recovery_requests r JOIN members m ON m.id=r.member_id ORDER BY r.requested_at DESC LIMIT 100").all(),
      getMembershipSettings()
    ]);
    return Response.json({members:members.results,payments:payments.results,audits:audits.results,recoveryRequests:recoveryRequests.results,settings},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    console.error(e);
    return Response.json({error:"Membership data is unavailable. Please try again."},{status:500});
  }
}
