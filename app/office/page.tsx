import { getClubAdmin } from "../admin-auth";
import { redirect } from "next/navigation";
import OfficeClient from "./office-client";
export const dynamic = "force-dynamic";
export default async function Office() {
  const admin = await getClubAdmin();
  if (!admin) redirect("/admin-login?return_to=/office");
  return <OfficeClient role={admin.role} name={admin.name || admin.email} />;
}
