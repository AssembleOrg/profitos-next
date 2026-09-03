"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useNotificationsContext } from "./notifications-context";
import { NotifPanelBody } from "./notif-card";

/** Bell del header mobile + bottom sheet de notificaciones (md:hidden). */
export function MobileNotifButton() {
  const [open, setOpen] = useState(false);
  // El header padre tiene backdrop-blur → contiene a los `fixed`; portaleamos al body.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const drag = useDragControls();
  const { notifications, unreadCount, markAsSeen, loadNotifications } = useNotificationsContext();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          loadNotifications().catch(() => {});
          markAsSeen();
        }}
        aria-label="Notificaciones"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors active:bg-surface-elevated"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-terra px-1 text-[9.5px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-scrim md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[28px] bg-surface md:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 16px)" }}
              drag="y"
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) setOpen(false);
              }}
            >
              <div
                onPointerDown={(e) => drag.start(e)}
                style={{ touchAction: "none" }}
                className="cursor-grab active:cursor-grabbing"
              >
                <div className="mx-auto my-3 h-1 w-10 rounded-full bg-border-strong" />
              </div>
              <div className="max-h-[70dvh] overflow-y-auto">
                <NotifPanelBody
                  notifications={notifications}
                  onMarkSeen={() => markAsSeen()}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
