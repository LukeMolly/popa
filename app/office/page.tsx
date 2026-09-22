import { getClubAdmin } from "../admin-auth";
import { redirect } from "next/navigation";
import OfficeClient from "./office-client";

export const dynamic = "force-dynamic";

export default async function Office() {
  const admin = await getClubAdmin();
  if (!admin) redirect("/admin-login?return_to=/office");
  if (!["executive","membership"].includes(admin.role)) redirect("/admin");
  return <OfficeClient role={admin.role as "executive"|"membership"} name={admin.name || admin.email} />;
}
