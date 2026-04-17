import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { now } from "@/lib/datetime";
import { Sidebar } from "./dashboard/_components/sidebar";
import { CommandPalette } from "./dashboard/_components/command-palette";
import { SplashScreen } from "./_components/splash-screen";
import { BottomNav } from "./_components/bottom-nav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <SplashScreen />
      <Sidebar avatarUrl={user.avatarUrl} role={user.role} />
      <main className="flex-1 overflow-auto transition-[margin] duration-200 md:ml-[var(--sidebar-width,13rem)]">
        {/* Top bar */}
        <header className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-5">
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-base font-medium text-text">
              Hola, {user.fullName?.split(" ")[0] ?? user.email.split("@")[0]}
            </h2>
            <span className="text-sm text-text-muted">/</span>
            <span className="whitespace-nowrap text-sm text-text-muted">
              {now().toFormat("dd/MM/yyyy")}
            </span>
          </div>
          <CommandPalette />
        </header>
        <div className="px-5 pb-nav md:px-8 md:pb-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
