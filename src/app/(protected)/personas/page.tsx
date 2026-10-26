import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isBuscalaConfigured } from "@/lib/buscala/client";
import { PersonasClient } from "./_components/personas-client";

export default async function PersonasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Suspense fallback={null}>
      <PersonasClient configured={isBuscalaConfigured()} />
    </Suspense>
  );
}
