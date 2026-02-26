export const LUXURY_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const TIMING = {
  /** Step 0→1: logo text slides in */
  logoHold: 0.5,
  /** Step 1: brief hold */
  logoCrossfade: 0.4,
  /** Step 1→2: splash exits, form enters */
  formEntryDelay: 1.0,
  /** Form slide-in duration */
  formSlideDuration: 0.8,
  /** Stagger between form children */
  formStagger: 0.08,
} as const;

export const transitions = {
  luxury: {
    ease: LUXURY_EASE,
    duration: 0.8,
  },
  crossfade: {
    ease: LUXURY_EASE,
    duration: 1.1,
  },
} as const;

export type LoginVariant = "v1" | "v4";
