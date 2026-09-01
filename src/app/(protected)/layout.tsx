import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Script from "next/script";
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
    <div className="flex flex-col">
      <h2 className="whitespace-nowrap font-display text-[22px] font-semibold text-text md:text-[26px]">
        Hola, {user.fullName?.split(" ")[0] ?? user.email.split("@")[0]}
      </h2>
      <span className="whitespace-nowrap text-[11.5px] text-text-faint">
        {now().toFormat("dd/MM/yyyy")}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
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
      {/* Chat IA (rag-webchat): widget flotante. userIdentifier = email para
          límites por cuenta. Sólo se monta si el token está configurado. */}
      {process.env.NEXT_PUBLIC_CHAT_APP_TOKEN && (
        <Script
          src={`${process.env.NEXT_PUBLIC_CHAT_URL ?? "https://rag-webchat-production.up.railway.app"}/widget.js`}
          data-app-token={process.env.NEXT_PUBLIC_CHAT_APP_TOKEN}
          data-user-identifier={user.email}
          strategy="lazyOnload"
        />
      )}
    </div>
  );
}
