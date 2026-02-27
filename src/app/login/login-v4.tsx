"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LUXURY_EASE, TIMING } from "./animation-constants";
import type { AnimationStep } from "./use-login-animation";
import { Logo } from "./logo";
import { LoginForm } from "./login-form";

interface Props {
  step: AnimationStep;
  urlError?: string;
}

const SERVICE_TAGS = ["Compra", "Venta", "Alquiler"];

export function LoginV4({ step, urlError }: Props) {
  return (
    <motion.div
      className="relative flex h-full w-full flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Full-bleed background */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: step >= 1 ? 1 : 0 }}
        transition={{ duration: 2, ease: LUXURY_EASE }}
      >
        <Image
          src="/images/image.png"
          alt="Buenos Aires skyline con Obelisco al atardecer"
          fill
          className="object-cover object-[center_35%]"
          priority
        />
        {/* Multi-layer gradient overlays for depth — matches Pencil design */}
        <div className="absolute inset-0 bg-[#0f1115]/50" />
        <div className="absolute inset-0 h-[350px] bg-gradient-to-b from-[#0f1115]/[0.73] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[400px] bg-gradient-to-t from-[#0f1115]/[0.93] to-transparent" />
        <div className="absolute inset-y-0 left-0 w-[400px] bg-gradient-to-r from-[#0f1115]/60 to-transparent" />
      </motion.div>

      {/* Logo intro overlay */}
      <Logo step={step} finalClassName="relative" compact />

      {/* Top bar */}
      <motion.header
        className="relative z-10 flex items-center justify-between px-6 py-8 lg:px-14 lg:py-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{
          opacity: step === 2 ? 1 : 0,
          y: step === 2 ? 0 : -20,
        }}
        transition={{
          duration: 0.8,
          ease: LUXURY_EASE,
        }}
      >
        {/* Small docked logo */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.5em] text-text lg:text-[13px]">
            JULIANA PROFITOS
          </p>
          <p className="mt-0.5 text-[7px] font-normal uppercase tracking-[0.4em] text-white/40 lg:text-[8px]">
            PROPIEDADES
          </p>
        </div>
        <p className="hidden text-[10px] font-light tracking-[0.2em] text-white/30 sm:block">
          Sistema de gesti&oacute;n inmobiliaria
        </p>
      </motion.header>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section — stacks on mobile, side-by-side on desktop */}
      <div className="relative z-10 flex flex-col gap-6 px-6 pb-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:px-14 lg:pb-12">
        {/* Tagline — hidden on mobile, visible on desktop */}
        <motion.div
          className="hidden max-w-md shrink-0 pb-6 lg:block"
          initial={{ opacity: 0, y: 30 }}
          animate={{
            opacity: step === 2 ? 1 : 0,
            y: step === 2 ? 0 : 30,
          }}
          transition={{
            duration: TIMING.formSlideDuration,
            ease: LUXURY_EASE,
            delay: step === 2 ? 0.2 : 0,
          }}
        >
          <h2 className="text-[36px] font-light leading-[1.15] tracking-wide text-text">
            Tu patrimonio,
            <br />
            nuestra prioridad.
          </h2>
          <p className="mt-5 text-[13px] font-light leading-relaxed text-white/45">
            Intermediaci&oacute;n profesional en compra,
            <br />
            venta y alquiler de inmuebles.
          </p>
          <div className="mt-7 flex items-center gap-4">
            <span className="h-[2px] w-8 bg-primary" />
            {SERVICE_TAGS.map((tag, i) => (
              <span
                key={tag}
                className="text-[10px] font-medium uppercase tracking-[0.25em] text-secondary/70"
              >
                {tag}
                {i < SERVICE_TAGS.length - 1 && (
                  <span className="ml-4 text-white/15">&middot;</span>
                )}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Login card — full width on mobile, fixed 400px on desktop */}
        <motion.div
          className="v4-login-card w-full p-8 lg:w-[380px] lg:shrink-0 lg:rounded-t-[20px] lg:rounded-b-[4px] lg:border lg:border-white/[0.05] lg:p-9"
          initial={{ opacity: 0, y: 50 }}
          animate={{
            opacity: step === 2 ? 1 : 0,
            y: step === 2 ? 0 : 50,
          }}
          transition={{
            duration: TIMING.formSlideDuration,
            ease: LUXURY_EASE,
          }}
        >
          <LoginForm step={step} inputStyle="pill" urlError={urlError} />
        </motion.div>
      </div>
    </motion.div>
  );
}
