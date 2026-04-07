"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";

interface ConsultantItem {
  id: string;
  tokkoContactId: number;
  name: string;
  email: string | null;
  phone: string | null;
  cellphone: string | null;
  leadStatus: string | null;
  agentName: string | null;
  agentEmail: string | null;
  tokkoCreatedAt: string | null;
  syncAt: string | null;
}

interface ConsultantsClientProps {
  isAdmin: boolean;
  items: ConsultantItem[];
  page: number;
  totalPages: number;
  total: number;
}

export function ConsultantsClient({
  isAdmin,
  items,
  page,
  totalPages,
  total,
}: ConsultantsClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.cellphone?.toLowerCase().includes(q) ||
      item.phone?.toLowerCase().includes(q) ||
      item.leadStatus?.toLowerCase().includes(q) ||
      item.agentName?.toLowerCase().includes(q)
    );
  });

  async function handleSync(mode: "auto" | "api") {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/tokko/contacts-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo sincronizar consultants");
        return;
      }
      if (data.data?.noChanges) {
        toast.success("Consultants al día. No hay nuevos registros.");
        router.refresh();
        return;
      }
      toast.success(
        `Consultants sincronizados · nuevos: ${data.data?.created ?? 0}, actualizados: ${data.data?.updated ?? 0}`
      );
      router.refresh();
    } catch {
      toast.error("Error de conexión al sincronizar consultants");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text">Consultants</h1>
          <p className="text-sm text-text-muted">
            {total} contacto{total !== 1 ? "s" : ""} sincronizado{total !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleSync("auto")}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
            {syncing ? "Sincronizando..." : "Actualizar consultants"}
          </button>
        )}
      </div>

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          placeholder="Buscar por nombre, email, estado, agente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface/40 py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3">Lead</th>
                <th className="px-5 py-3">Agente</th>
                <th className="px-5 py-3">Creado</th>
                <th className="px-5 py-3">Sync</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-text-muted">
                    {search ? "Sin resultados para la búsqueda" : "No hay consultants cargados"}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-b-0">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text">{item.name}</p>
                      <p className="text-xs text-text-muted">
                        #{item.tokkoContactId} · {item.email ?? item.cellphone ?? item.phone ?? "Sin dato"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">{item.leadStatus ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-text-muted">{item.agentName ?? "—"}</p>
                      {item.agentEmail && (
                        <p className="text-xs text-text-muted/70">{item.agentEmail}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">
                      {item.tokkoCreatedAt ? new Date(item.tokkoCreatedAt).toLocaleString("es-AR") : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">
                      {item.syncAt ? new Date(item.syncAt).toLocaleString("es-AR") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
