import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginShell } from "./login-shell";

export const metadata: Metadata = {
  title: "Iniciar sesión | Juliana Profitos Propiedades",
  description:
    "Ingresá a tu plataforma de gestión inmobiliaria.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginShell />
    </Suspense>
  );
}
