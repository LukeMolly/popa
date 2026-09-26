import { headers } from "next/headers";
import RegistrationPortal from "./registration-portal";
import { getMembershipSettings } from "../../lib/membership";
import "./portal.css";
import "./location-field.css";

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const h = await headers();
  const settings=await getMembershipSettings();
  return <RegistrationPortal accountEmail={h.get("oai-authenticated-user-email") ?? ""} settings={settings} />;
}
