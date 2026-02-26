"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LUXURY_EASE } from "./animation-constants";
import type { AnimationStep } from "./use-login-animation";
import { Logo } from "./logo";
import { LoginForm } from "./login-form";

interface Props {
  step: AnimationStep;
}

export function LoginV1({ step }: Props) {
  return (
    <motion.div
      className="relative flex h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background image — right side only on desktop */}
      <motion.div
        className="absolute inset-0 lg:left-[450px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: step >= 1 ? 1 : 0 }}
        transition={{ duration: 2, ease: LUXURY_EASE }}
      >
        <Image
          src="/images/v1-bg.png"
          alt="Vista urbana"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient overlays — soft fade into sidebar */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1115]/80 via-[#0f1115]/40 to-transparent lg:from-[#0f1115]/60 lg:via-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1115]/30 via-transparent to-[#0f1115]/20" />
      </motion.div>

      {/* Logo intro overlay */}
      <Logo step={step} finalClassName="relative z-10" compact />

      {/* Glass Sidebar — 450px */}
      <motion.aside
        className="relative z-10 flex h-full w-full flex-col justify-between border-r border-border px-8 py-10 sm:w-[450px] sm:px-12 sm:py-14"
        style={{
          backdropFilter: "blur(72px)",
          WebkitBackdropFilter: "blur(72px)",
          background:
            "linear-gradient(to bottom, rgba(15,17,21,0.85), rgba(15,17,21,0.55), rgba(15,17,21,0.7))",
        }}
        initial={{ x: -60, opacity: 0 }}
        animate={{
          x: step === 2 ? 0 : -60,
          opacity: step === 2 ? 1 : 0,
        }}
        transition={{
          duration: 0.8,
          ease: LUXURY_EASE,
        }}
      >
        {/* Small docked logo */}
        {step === 2 && (
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <p className="text-[13px] font-semibold tracking-[0.5em] text-text">
              JULIANA PROFITOS
            </p>
            <p className="mt-0.5 text-[8px] font-normal uppercase tracking-[0.4em] text-white/40">
              PROPIEDADES
            </p>
          </motion.div>
        )}

        {/* Form — vertically centered */}
        <div className="flex flex-1 flex-col justify-center py-8">
          <LoginForm step={step} inputStyle="underline" />
        </div>

        {/* Footer */}
        <p className="text-[10px] font-light tracking-wide text-white/25">
          &copy; 2026 Juliana Profitos Propiedades
        </p>
      </motion.aside>
    </motion.div>
  );
}
