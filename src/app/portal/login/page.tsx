import type { Metadata } from "next";
import Image from "next/image";
import { PortalLoginForm } from "../_ui/login-form";

export const metadata: Metadata = {
  title: "Portal de inquilinos | Juliana Profitos Propiedades",
  description: "Tus vencimientos, recibos y comprobantes de servicios.",
};

export default function PortalLoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col bg-dark">
      <Image src="/images/image.png" alt="" fill priority className="object-cover object-[center_35%] opacity-60" />
      <div className="absolute inset-0 bg-[#0f1115]/55" />
      <header className="relative z-10 px-6 py-8 lg:px-14 lg:py-12">
        <p className="text-[11px] font-semibold tracking-[0.5em] text-dark-fg lg:text-[13px]">JULIANA PROFITOS</p>
        <p className="mt-0.5 text-[8px] uppercase tracking-[0.4em] text-white/60">Propiedades</p>
      </header>
      <div className="flex-1" />
      <div className="relative z-10 flex flex-col gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:flex-row lg:items-end lg:justify-between lg:px-14 lg:pb-12">
        <div className="hidden max-w-md pb-6 lg:block">
          <h1 className="font-display text-[36px] font-semibold leading-[1.15] text-dark-fg [text-shadow:0_2px_18px_rgba(0,0,0,0.45)]">
            Tu alquiler,
            <br />
            en orden y a mano.
          </h1>
          <p className="mt-4 text-[13.5px] leading-relaxed text-white/80">Vencimientos, recibos y comprobantes de servicios en un solo lugar.</p>
        </div>
        <div className="w-full rounded-[28px] bg-bg p-7 shadow-2xl lg:w-[380px] lg:p-9">
          <PortalLoginForm />
        </div>
      </div>
    </main>
  );
}
