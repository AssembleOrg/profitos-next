"use client";

import { motion } from "framer-motion";
import { LUXURY_EASE } from "./animation-constants";
import type { LoginVariant } from "./animation-constants";
import type { AnimationStep } from "./use-login-animation";

interface Props {
  current: LoginVariant;
  onChange: (v: LoginVariant) => void;
  step: AnimationStep;
}

export function VariantSelector({ current, onChange, step }: Props) {
  return (
    <motion.div
      className="fixed right-6 top-6 z-50 flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: step === 2 ? 1 : 0 }}
      transition={{ duration: 0.5, ease: LUXURY_EASE }}
      style={{ pointerEvents: step === 2 ? "auto" : "none" }}
    >
      {(["v1", "v4"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="relative rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-text"
        >
          {current === v && (
            <motion.span
              layoutId="variant-pill"
              className="absolute inset-0 rounded-full bg-primary/40"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <span className="relative z-10">
            {v === "v1" ? "Versión 1" : "Versión 2"}
          </span>
        </button>
      ))}
    </motion.div>
  );
}
