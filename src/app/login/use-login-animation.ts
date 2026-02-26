"use client";

import { useState, useEffect } from "react";
import { TIMING } from "./animation-constants";

export type AnimationStep = 0 | 1 | 2;

export function useLoginAnimation(): AnimationStep {
  const [step, setStep] = useState<AnimationStep>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), TIMING.logoHold * 1000);
    const t2 = setTimeout(() => setStep(2), TIMING.formEntryDelay * 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return step;
}
