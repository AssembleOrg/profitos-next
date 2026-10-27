"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export interface NotificationItem {
  kind: "followup_assignment" | "property" | "overdue_followup" | "publication_closed" | "contact" | "reservation_expiry" | "listing_issue";
  eventAt: string;
  id: string;
  createdAt?: string;
  title?: string | null;
  status?: string;
  dueDate?: string | null;
  updatedAt?: string;
  property?: { id: string; address: string };
  assignedToUser?: { id: string; fullName: string | null; email: string };
  assignedByUser?: { id: string; fullName: string | null; email: string };
  address?: string;
  publicationTitle?: string | null;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
  createdByUser?: { id: string; fullName: string | null; email: string } | null;
  producerName?: string | null;
  branchName?: string | null;
  portal?: string;
  permalink?: string | null;
  // kind "publication_closed": baja que no pidió el sistema (Tokko, ML)
  externalChange?: boolean;
  externalChangeDetail?: string | null;
  // kind "contact": lead scrapeado (ZP/AP) o pregunta ML
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  message?: string | null;
  propertyTitle?: string | null;
  proposalId?: string;
  // kind "listing_issue": aviso con un error nuevo en el portal (panel de Difusión)
  issue?: string | null;
  daysBefore?: number;
  expiresAt?: string | null;
}

const LS_KEY = "jp_last_notifications_seen_at";
const ALERTED_KEY = "jp_external_change_alerted";

/**
 * Bajas de avisos que no pidió el sistema: además de la campana, un aviso que
 * queda en pantalla hasta cerrarlo (una vez por baja y por navegador).
 */
function alertExternalChanges(items: NotificationItem[]) {
  let alerted: string[] = [];
  try {
    alerted = JSON.parse(localStorage.getItem(ALERTED_KEY) ?? "[]") as string[];
  } catch {
    /* vacío */
  }
  const fresh = items.filter(
    (i) =>
      i.kind === "publication_closed" &&
      i.externalChange &&
      !alerted.includes(`${i.id}:${i.eventAt}`) &&
      Date.now() - new Date(i.eventAt).getTime() < 7 * 24 * 60 * 60_000
  );
  for (const i of fresh) {
    const portal = i.portal === "mercadolibre" ? "MercadoLibre" : (i.portal ?? "portal");
    const verb = i.status === "paused" ? "pausó" : "cerró";
    toast.error(`Se ${verb} el aviso de ${portal} de ${i.property?.address ?? "una propiedad"} sin que lo pidiéramos`, {
      description: i.externalChangeDetail ?? undefined,
      duration: Infinity,
      closeButton: true,
      action: i.property ? { label: "Ver", onClick: () => (window.location.href = `/propiedades?q=${encodeURIComponent(i.property!.address)}`) } : undefined,
    });
  }
  if (fresh.length) {
    const next = [...alerted, ...fresh.map((i) => `${i.id}:${i.eventAt}`)].slice(-100);
    localStorage.setItem(ALERTED_KEY, JSON.stringify(next));
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications/recent-contacts?limit=15", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = await res.json();
      const items = (body?.data?.items ?? []) as NotificationItem[];
      setNotifications(items);
      alertExternalChanges(items);

      const lastSeen = localStorage.getItem(LS_KEY);
      if (!lastSeen) {
        setUnreadCount(items.length > 0 ? 1 : 0);
        return;
      }
      const lastSeenMs = new Date(lastSeen).getTime();
      const count = items.filter((item) => {
        // Un lead scrapeado tiene eventAt = fecha del mensaje EN EL PORTAL, que
        // puede ser horas anteriores a que el scraper lo traiga. Para "no leído"
        // vale la fecha más nueva entre el evento y su ingreso al sistema.
        const t = Math.max(
          item.eventAt ? new Date(item.eventAt).getTime() : 0,
          item.createdAt ? new Date(item.createdAt).getTime() : 0
        );
        return t > lastSeenMs;
      }).length;
      setUnreadCount(count);
    } catch {
      // silent
    }
  }

  function markAsSeen() {
    const now = new Date().toISOString();
    localStorage.setItem(LS_KEY, now);
    setUnreadCount(0);
  }

  useEffect(() => {
    const timerId = globalThis.setTimeout(() => {
      void loadNotifications();
    }, 0);
    // Red de seguridad si realtime no entrega (canal caído, tabla sin publicar).
    const pollId = globalThis.setInterval(() => void loadNotifications(), 120_000);
    return () => {
      globalThis.clearTimeout(timerId);
      globalThis.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const schema = process.env.NEXT_PUBLIC_DB_SCHEMA ?? "profitos";
    const channel = supabase
      .channel("bottom-nav-notifications")
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_propiedades" }, () => void loadNotifications())
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_property_followups" }, () => void loadNotifications())
      .on("postgres_changes", { event: "UPDATE", schema, table: "jp_property_followups" }, () => void loadNotifications())
      .on("postgres_changes", { event: "UPDATE", schema, table: "jp_property_publications" }, () => void loadNotifications())
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_scraped_leads" }, () => void loadNotifications())
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_portal_questions" }, () => void loadNotifications())
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_signature_reservation_reminders" }, () => void loadNotifications())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return { notifications, unreadCount, markAsSeen, loadNotifications };
}
