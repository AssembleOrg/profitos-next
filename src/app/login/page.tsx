import type { Metadata } from "next";
import { LoginShell } from "./login-shell";

export const metadata: Metadata = {
  title: "Iniciar sesi\u00f3n | Juliana Profitos Propiedades",
  description:
    "Ingres\u00e1 a tu plataforma de gesti\u00f3n inmobiliaria.",
};

export default function LoginPage() {
  return <LoginShell />;
}
