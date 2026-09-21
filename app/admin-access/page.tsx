import { getClubAdmin } from "../admin-auth";
import { redirect } from "next/navigation";
import AdminAccessClient from "./admin-access-client";
export const dynamic = "force-dynamic";
export default async function AdminAccessPage() {
  const admin = await getClubAdmin();
  if (!admin) redirect("/admin-login?return_to=/admin-access");
  if (admin?.role !== "executive") return <main className="access-denied"><span className="mini-crest">TR</span><h1>Executive access required</h1><p>Only the Executive Access Administrator can assign or remove administrator roles.</p><div><a href="/office">Return to club office</a></div></main>;
  return <AdminAccessClient />;
}
