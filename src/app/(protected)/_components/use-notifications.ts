"use client";

import { useState, useEffect } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export interface NotificationItem {
  kind: "followup_assignment" | "property" | "overdue_followup";
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
        const eventAt = item.eventAt ?? item.createdAt;
        if (!eventAt) return false;
        return new Date(eventAt).getTime() > lastSeenMs;
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
    return () => globalThis.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseClient();
    const schema = process.env.NEXT_PUBLIC_DB_SCHEMA ?? "profitos";
    const channel = supabase
      .channel("bottom-nav-notifications")
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_propiedades" }, () => void loadNotifications())
      .on("postgres_changes", { event: "INSERT", schema, table: "jp_property_followups" }, () => void loadNotifications())
      .on("postgres_changes", { event: "UPDATE", schema, table: "jp_property_followups" }, () => void loadNotifications())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return { notifications, unreadCount, markAsSeen, loadNotifications };
}
