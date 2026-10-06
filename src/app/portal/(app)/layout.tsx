import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/auth/tenant";
import { PortalHeader } from "../_ui/portal-header";

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/portal/login");
  return (
    <div className="min-h-dvh bg-bg">
      <PortalHeader name={tenant.fullName} />
      <main className="mx-auto w-full max-w-5xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 md:px-8">{children}</main>
    </div>
  );
}
