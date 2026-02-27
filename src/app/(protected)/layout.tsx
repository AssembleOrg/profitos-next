import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { now } from "@/lib/datetime";
import { Sidebar } from "./dashboard/_components/sidebar";
import { CommandPalette } from "./dashboard/_components/command-palette";
import { SplashScreen } from "./_components/splash-screen";

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
      <Sidebar avatarUrl={user.avatarUrl} />
      <main className="ml-16 flex-1 overflow-auto">
        {/* Top bar */}
        <header className="flex flex-col gap-3 px-8 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-base font-medium text-text">
              Hola, {user.fullName?.split(" ")[0] ?? user.email.split("@")[0]}
            </h2>
            <span className="text-sm text-text-muted">/</span>
            <span className="whitespace-nowrap text-sm text-text-muted">
              {now().toFormat("dd MMM yyyy")}
            </span>
          </div>
          <CommandPalette />
        </header>
        <div className="px-8 pb-8">{children}</div>
      </main>
    </div>
  );
}
