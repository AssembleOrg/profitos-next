"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import type { LoginVariant } from "./animation-constants";
import { useLoginAnimation } from "./use-login-animation";
import { VariantSelector } from "./variant-selector";
import { LoginV1 } from "./login-v1";
import { LoginV4 } from "./login-v4";

export function LoginShell() {
  const [variant, setVariant] = useState<LoginVariant>("v1");
  const step = useLoginAnimation();

  const handleSwitch = useCallback((v: LoginVariant) => {
    setVariant(v);
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <VariantSelector current={variant} onChange={handleSwitch} step={step} />

      <AnimatePresence mode="wait">
        {variant === "v1" ? (
          <LoginV1 key="v1" step={step} />
        ) : (
          <LoginV4 key="v4" step={step} />
        )}
      </AnimatePresence>
    </div>
  );
}
