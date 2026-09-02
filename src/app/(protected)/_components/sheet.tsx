"use client";

/**
 * Sheet — bottom sheet en mobile, dialog centrado en desktop.
 *
 * Mobile  (< 640px): slide desde abajo, drag-to-close desde el handle/header.
 * Desktop (≥ 640px): centrado, max-w configurable.
 *
 * Construido sobre @radix-ui Dialog → Esc + focus-trap + a11y gratis.
 *
 * Uso:
 *   <Sheet open={open} onClose={close} title="Título" footer={<Botones />}>
 *     <Contenido scrolleable />
 *   </Sheet>
 *
 * Props extra:
 *   description   — subtítulo bajo el título.
 *   headerExtra   — slot fijo bajo el header (tabs, barra de progreso).
 *   footer        — ReactNode; puede cambiar (wizards con footer por paso).
 *   closeOnOverlay=false — el overlay y el drag NO cierran (X y Esc sí).
 *                          Para formularios con datos precargados.
 */

import { motion, AnimatePresence, useDragControls } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useIsMobile } from "./use-is-mobile";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // ej: "sm:max-w-md", "sm:max-w-xl"
  avatarInitial?: string; // avatar letter for header
  closeOnOverlay?: boolean; // default true
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Sheet({
  open,
  onClose,
  title,
  description,
  headerExtra,
  children,
  footer,
  maxWidth = "sm:max-w-md",
  avatarInitial,
  closeOnOverlay = true,
}: Readonly<SheetProps>) {
  const isMobile = useIsMobile();
  const dragControls = useDragControls();

  // El título es la etiqueta accesible del diálogo (Radix lo exige). Si es un
  // string va visible; si es un nodo complejo, lo mostramos y damos a Radix un
  // Title oculto para no romper a11y.
  const titleIsString = typeof title === "string";

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              {/* Overlay */}
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={closeOnOverlay ? onClose : undefined}
                />
              </Dialog.Overlay>

              {/* Panel */}
              <Dialog.Content
                asChild
                onPointerDownOutside={(e) => {
                  if (!closeOnOverlay) e.preventDefault();
                }}
                onInteractOutside={(e) => {
                  if (!closeOnOverlay) e.preventDefault();
                }}
              >
                <motion.div
                  className={`fixed z-50 flex flex-col border border-border bg-surface shadow-2xl
                    bottom-0 left-0 right-0 max-h-[92dvh] rounded-t-[28px]
                    sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)] ${maxWidth}
                    sm:-translate-x-1/2 sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl`}
                  initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: "-48%" }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: "-50%" }}
                  exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: "-48%" }}
                  transition={{ duration: 0.28, ease: EASE }}
                  drag={isMobile ? "y" : false}
                  dragListener={false}
                  dragControls={dragControls}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={(_, info) => {
                    if (closeOnOverlay && (info.offset.y > 120 || info.velocity.y > 500)) onClose();
                  }}
                >
                  {/* Handle + header: única zona que inicia el drag-to-close (solo mobile) */}
                  <div
                    onPointerDown={isMobile ? (e) => dragControls.start(e) : undefined}
                    style={isMobile ? { touchAction: "none" } : undefined}
                    className="flex-shrink-0 sm:cursor-default"
                  >
                    {/* Drag handle — solo mobile */}
                    <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-border sm:hidden" />

                    {/* Header */}
                    <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {avatarInitial && (
                          <motion.div
                            layoutId={`contact-avatar-${avatarInitial}`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.05 }}
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-sand-chip font-display text-sm font-bold text-text-muted"
                          >
                            {avatarInitial}
                          </motion.div>
                        )}
                        <div className="min-w-0">
                          {titleIsString ? (
                            <Dialog.Title className="truncate font-display text-[17px] font-semibold text-text">
                              {title}
                            </Dialog.Title>
                          ) : (
                            <>
                              <Dialog.Title className="sr-only">Diálogo</Dialog.Title>
                              <div className="font-display text-[17px] font-semibold text-text">{title}</div>
                            </>
                          )}
                          {description && (
                            <Dialog.Description className="mt-0.5 text-[13px] text-text-muted">
                              {description}
                            </Dialog.Description>
                          )}
                        </div>
                      </div>
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-text-muted active:bg-bg"
                          aria-label="Cerrar"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </Dialog.Close>
                    </div>

                    {/* Slot extra bajo el header (tabs, progreso) */}
                    {headerExtra}
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
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
