import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDeviceSession, listSessions } from "@/lib/auth/device-sessions";
import { readContactPhones } from "@/lib/auth/device-utils";
import { PerfilClient } from "./_components/perfil-client";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const device = await getDeviceSession(user.id);
  const sessions = await listSessions(user.id, device.status === "ok" ? device.sessionId : null);

  return (
    <PerfilClient
      initial={{
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        avatarCustom: user.avatarCustom,
        phones: readContactPhones(user.contactPhones),
      }}
      initialSessions={sessions}
    />
  );
}
