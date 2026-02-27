"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LUXURY_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPLASH_DURATION = 1.2; // seconds before splash exits

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), SPLASH_DURATION * 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f1115]"
          exit={{
            opacity: 0,
            scale: 1.15,
            filter: "blur(20px)",
          }}
          transition={{
            duration: 0.4,
            ease: LUXURY_EASE,
          }}
        >
          <div className="relative flex flex-col items-start">
            {/* "Juliana" — slides in from the left */}
            <motion.h1
              className="text-[72px] font-bold leading-none tracking-tight text-text"
              initial={{ x: -150, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{
                duration: 0.5,
                ease: LUXURY_EASE,
                delay: 0.05,
              }}
            >
              Juliana
            </motion.h1>

            {/* "Profitos" — slides in from the right */}
            <motion.h1
              className="self-end text-[72px] font-bold leading-none tracking-tight text-text"
              initial={{ x: 150, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{
                duration: 0.5,
                ease: LUXURY_EASE,
                delay: 0.15,
              }}
            >
              Profitos
            </motion.h1>

            {/* "PROPIEDADES" — fades in below */}
            <motion.p
              className="mt-3 self-end text-[11px] font-normal uppercase tracking-[0.5em] text-white/40"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                ease: LUXURY_EASE,
                delay: 0.35,
              }}
            >
              P R O P I E D A D E S
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
