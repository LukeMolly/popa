import { headers } from "next/headers";
import RegistrationPortal from "./registration-portal";
import "./portal.css";
import "./location-field.css";

export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const h = await headers();
  return <RegistrationPortal accountEmail={h.get("oai-authenticated-user-email") ?? ""} />;
}
