import { DB } from "../../../lib/platform";
const env = { DB };
import { isClubAdmin } from "../../admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isClubAdmin(["executive","membership"]))) {
    return Response.json({error:"Membership administrator access required."},{status:403});
  }
  try {
    const db = env.DB;
    const [members,payments] = await Promise.all([
      db.prepare("SELECT id,first_name AS firstName,last_name AS lastName,phone,email,status,expires_at AS expiresAt,token,created_at AS createdAt,id_number AS idNumber,date_of_birth AS dateOfBirth,place_of_birth AS placeOfBirth,membership_location AS membershipLocation,gender FROM members ORDER BY created_at DESC").all(),
      db.prepare("SELECT id,member_id AS memberId,amount,reference,status,note,created_at AS createdAt,reviewed_at AS reviewedAt FROM payments ORDER BY created_at DESC").all(),
    ]);
    return Response.json({members:members.results,payments:payments.results},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    console.error(e);
    return Response.json({error:"Membership data is unavailable. Please try again."},{status:500});
  }
}
