import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { getTenantPortalData, touchPortalLogin } from "@/lib/rentals/portal-data";
import { PortalHome } from "../_ui/portal-home";

export default async function PortalPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/portal/login");
  const [data] = await Promise.all([getTenantPortalData(tenant.id), touchPortalLogin(tenant.id)]);
  return <PortalHome firstName={tenant.fullName} data={data} />;
}
