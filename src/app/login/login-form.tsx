"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { LUXURY_EASE, TIMING } from "./animation-constants";
import type { AnimationStep } from "./use-login-animation";
import { GoogleIcon } from "./google-icon";
import { signInWithGoogle } from "./actions";

interface Props {
  step: AnimationStep;
  urlError?: string;
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

export function LoginForm({ step, urlError }: Props) {
  const [googlePending, startGoogleTransition] = useTransition();
  const isVisible = step === 2;

  const error = urlError;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      className="flex flex-col gap-8"
    >
      {/* Title */}
      <motion.div variants={staggerChild}>
        <h2 className="font-display text-[30px] font-bold tracking-[0.04em] text-text">
          INGRES&Aacute;
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
          Acced&eacute; a tu plataforma de gesti&oacute;n inmobiliaria
        </p>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2 rounded-[14px] bg-clay-chip px-3 py-2.5 text-[13px] font-medium text-terra"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </motion.p>
      )}

      {/* Google Button — única acción */}
      <motion.button
        variants={staggerChild}
        type="button"
        disabled={googlePending}
        onClick={() =>
          startGoogleTransition(async () => {
            await signInWithGoogle();
          })
        }
        className="flex h-[50px] w-full items-center justify-center gap-3 rounded-full bg-dark text-[14px] font-bold tracking-[0.02em] text-dark-fg transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
          <GoogleIcon />
        </span>
        {googlePending ? "Redirigiendo…" : "Continuar con Google"}
      </motion.button>
    </motion.div>
  );
}
