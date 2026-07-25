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
        <h2 className="text-[30px] font-light tracking-[0.1em] text-text drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          INGRES&Aacute;
        </h2>
        <p className="mt-2 text-[13px] font-light leading-relaxed text-white/55 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
          Acced&eacute; a tu plataforma de gesti&oacute;n inmobiliaria
        </p>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[13px] font-light text-danger"
        >
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
        className="flex w-full items-center justify-center gap-3.5 rounded-2xl bg-white py-4 text-[14px] font-medium tracking-[0.02em] text-[#1f1f1f] shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition-all hover:shadow-[0_22px_70px_rgba(0,0,0,0.45)] active:scale-[0.99] disabled:opacity-60"
      >
        <GoogleIcon />
        {googlePending ? "Redirigiendo…" : "Continuar con Google"}
      </motion.button>
    </motion.div>
  );
}
