import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentAccess } from "@/lib/auth/access";
import { isPathAllowed } from "@/lib/nav/views";
import { now } from "@/lib/datetime";
import { SplashScreen } from "./_components/splash-screen";
import { NativeParityProvider } from "./_components/native-parity-provider";
import { ProtectedShell } from "./_components/protected-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Control de acceso por vistas: si el usuario abre por URL una vista a la que
  // no tiene acceso, lo mandamos al dashboard (siempre permitido).
  const access = await getCurrentAccess();
  const accessibleHrefs = access?.accessibleHrefs ?? [];
  const isAdmin = access?.isAdmin ?? false;
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname && !isPathAllowed(pathname, new Set(accessibleHrefs), isAdmin)) {
    redirect("/dashboard");
  }

  const greeting = (
    <div className="flex items-center gap-3">
      <h2 className="whitespace-nowrap text-base font-medium text-text">
        Hola, {user.fullName?.split(" ")[0] ?? user.email.split("@")[0]}
      </h2>
      <span className="text-sm text-text-muted">/</span>
      <span className="whitespace-nowrap text-sm text-text-muted">
        {now().toFormat("dd/MM/yyyy")}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-bg">
      <NativeParityProvider />
      <SplashScreen />
      <ProtectedShell
        realRole={user.role}
        avatarUrl={user.avatarUrl}
        greeting={greeting}
        favorites={user.navFavorites ?? []}
        accessibleHrefs={accessibleHrefs}
        isAdmin={isAdmin}
      >
        {children}
      </ProtectedShell>
    </div>
  );
}
