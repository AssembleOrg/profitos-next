"use client";

import { useState, useEffect } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export interface NotificationItem {
  kind: "followup_assignment" | "property" | "overdue_followup" | "publication_closed" | "contact";
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
  // kind "contact": lead scrapeado (ZP/AP) o pregunta ML
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  message?: string | null;
  propertyTitle?: string | null;
}

const LS_KEY = "jp_last_notifications_seen_at";

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
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return { notifications, unreadCount, markAsSeen, loadNotifications };
}
