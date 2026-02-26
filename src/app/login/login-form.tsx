"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LUXURY_EASE, TIMING } from "./animation-constants";
import type { AnimationStep } from "./use-login-animation";
import { GoogleIcon } from "./google-icon";

interface Props {
  step: AnimationStep;
  inputStyle: "underline" | "pill";
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: TIMING.formStagger,
      delayChildren: 0,
    },
  },
};

const staggerChild = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: TIMING.formSlideDuration,
      ease: LUXURY_EASE,
    },
  },
};

export function LoginForm({ step, inputStyle }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const isVisible = step === 2;

  const inputUnderline =
    "w-full bg-transparent border-b border-border pb-3 pt-1 text-[14px] font-light text-text placeholder:text-white/20 focus:border-secondary focus:outline-none transition-colors";

  const inputPill =
    "w-full rounded-xl bg-black/30 border border-white/[0.08] px-4 py-3 text-[14px] font-normal text-text placeholder:text-white/30 focus:border-secondary focus:outline-none transition-colors backdrop-blur-sm";

  const inputClass = inputStyle === "underline" ? inputUnderline : inputPill;

  return (
    <motion.form
      variants={staggerContainer}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      className="flex flex-col gap-7"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Title */}
      <motion.div variants={staggerChild}>
        <h2 className="text-[30px] font-light tracking-[0.1em] text-text drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          INGRES&Aacute;
        </h2>
        <p className="mt-2 text-[13px] font-light leading-relaxed text-white/55 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
          Acced&eacute; a tu plataforma de gesti&oacute;n inmobiliaria
        </p>
      </motion.div>

      {/* Email */}
      <motion.div variants={staggerChild} className="flex flex-col gap-2.5">
        <label className="text-[10px] font-semibold uppercase tracking-[0.4em] text-secondary drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          CORREO
        </label>
        <input
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          className={inputClass}
        />
      </motion.div>

      {/* Password */}
      <motion.div variants={staggerChild} className="flex flex-col gap-2.5">
        <label className="text-[10px] font-semibold uppercase tracking-[0.4em] text-secondary drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          CONTRASE&Ntilde;A
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 transition-colors hover:text-text"
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {showPassword ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
      </motion.div>

      {/* Submit Button */}
      <motion.button
        variants={staggerChild}
        type="submit"
        className="w-full rounded-2xl bg-primary py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-text shadow-[0_18px_60px_rgba(75,83,64,0.25)] transition-all hover:bg-primary-hover hover:shadow-[0_22px_70px_rgba(75,83,64,0.35)] active:scale-[0.99]"
      >
        INGRESAR
      </motion.button>

      {/* Divider */}
      <motion.div
        variants={staggerChild}
        className="flex items-center gap-4"
      >
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-medium tracking-widest text-white/25">
          O
        </span>
        <span className="h-px flex-1 bg-border" />
      </motion.div>

      {/* Google Button */}
      <motion.button
        variants={staggerChild}
        type="button"
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-white/[0.03] py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-text transition-colors hover:bg-white/[0.07]"
      >
        <GoogleIcon />
        GOOGLE
      </motion.button>
    </motion.form>
  );
}
