"use client";

/**
 * Sheet — bottom sheet en mobile, dialog centrado en desktop.
 *
 * Mobile  (< 640px): slide desde abajo, max-h-[90dvh], drag handle
 * Desktop (≥ 640px): centrado, max-w configurable, max-h-[85vh]
 *
 * Uso:
 *   <Sheet open={open} onClose={close} title="Título" footer={<Botones />}>
 *     <Contenido scrolleable />
 *   </Sheet>
 */

import { useEffect, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // ej: "sm:max-w-md", "sm:max-w-xl"
  avatarInitial?: string; // avatar letter for header
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

function subscribeToMobileQuery(onStoreChange: () => void) {
  if (!("window" in globalThis)) return () => {};

  const mediaQueryList = globalThis.window.matchMedia(MOBILE_MEDIA_QUERY);
  mediaQueryList.addEventListener("change", onStoreChange);

  return () => mediaQueryList.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot() {
  if (!("window" in globalThis)) return false;
  return globalThis.window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "sm:max-w-md",
  avatarInitial,
}: Readonly<SheetProps>) {
  const isMobile = useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    () => false
  );

  // Lock body scroll cuando el sheet está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className={`fixed z-50 flex flex-col border border-border bg-surface shadow-2xl
              bottom-0 left-0 right-0 max-h-[92dvh] rounded-t-2xl
              sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)] ${maxWidth}
              sm:-translate-x-1/2 sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl`}
            initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: "-48%" }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: "-50%" }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: "-48%" }}
            transition={{ duration: 0.28, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — solo mobile */}
            <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-border sm:hidden" />

            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border-olive/40 px-5 py-4">
              <div className="flex items-center gap-3">
                {avatarInitial && (
                  <motion.div
                    layoutId={`contact-avatar-${avatarInitial}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                      delay: 0.05,
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/15 text-sm font-semibold text-secondary"
                  >
                    {avatarInitial}
                  </motion.div>
                )}
                <h2 className="text-base font-medium text-text">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted active:bg-bg"
                aria-label="Cerrar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body — scrolleable */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {children}
            </div>

            {/* Footer — siempre visible, respeta safe area */}
            {footer && (
              <div
                className="flex flex-shrink-0 items-center justify-between border-t border-border px-5 py-4"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
