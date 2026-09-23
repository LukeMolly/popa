import { redirect } from "next/navigation";
import { getClubAdmin } from "../admin-auth";
import MemberRegistry from "../member-registry";

export const dynamic="force-dynamic";
export default async function AdminPage(){
 const admin=await getClubAdmin();
 if(!admin) redirect("/admin-login?return_to=/admin");
 if(!["executive","membership"].includes(admin.role)) return <main className="access-denied"><span className="mini-crest">TR</span><h1>Membership administrator access required</h1><p>This administrator role does not manage membership records.</p><div><a href="/office">Go to assigned administration area</a></div></main>;
 return <MemberRegistry adminRole={admin.role}/>;
}
