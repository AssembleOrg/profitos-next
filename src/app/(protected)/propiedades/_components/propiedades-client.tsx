"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";

interface Property {
  id: string;
  tokkoId: number | null;
  source: string;
  address: string;
  realAddress: string | null;
  publicationTitle: string | null;
  referenceCode: string | null;
  publicUrl: string | null;
  city: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  roomAmount: number | null;
  bathroomAmount: number | null;
  totalSurface: number | null;
  operationType: string | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  createdAt: string;
  _count?: { visitas: number };
}

interface PropiedadesClientProps {
  properties: Property[];
  page: number;
  totalPages: number;
  total: number;
  isAdmin: boolean;
  usersForAssignments: Array<{ id: string; fullName: string | null; email: string }>;
  propertiesForAssignments: Array<{ id: string; address: string }>;
}

const PROPERTY_TYPES = [
  { value: "", label: "Sin especificar" },
  { value: "departamento", label: "Departamento" },
  { value: "casa", label: "Casa" },
  { value: "local", label: "Local" },
  { value: "terreno", label: "Terreno" },
  { value: "oficina", label: "Oficina" },
  { value: "otro", label: "Otro" },
];

const PROPERTY_STATUSES = [
  { value: "activa", label: "Activa", color: "bg-emerald-500" },
  { value: "vendida", label: "Vendida", color: "bg-blue-500" },
  { value: "alquilada", label: "Alquilada", color: "bg-amber-500" },
  { value: "suspendida", label: "Suspendida", color: "bg-red-500" },
];

function getStatusColor(status: string) {
  return PROPERTY_STATUSES.find((s) => s.value === status)?.color ?? "bg-text-muted";
}

function getStatusLabel(status: string) {
  return PROPERTY_STATUSES.find((s) => s.value === status)?.label ?? status;
}

function getUserLabel(user: { fullName: string | null; email: string }) {
  return user.fullName?.trim() || user.email;
}

export function PropiedadesClient({
  properties,
  page,
  totalPages,
  total,
  isAdmin,
  usersForAssignments,
  propertiesForAssignments,
}: PropiedadesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [syncingTokko, setSyncingTokko] = useState(false);

  const filtered = properties.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.address.toLowerCase().includes(q) ||
      p.publicationTitle?.toLowerCase().includes(q) ||
      p.referenceCode?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.zone?.toLowerCase().includes(q) ||
      p.type?.toLowerCase().includes(q)
    );
  });

  function handleNew() {
    setEditProperty(null);
    setModalOpen(true);
  }

  function handleEdit(p: Property) {
    setEditProperty(p);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditProperty(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      address: form.get("address") as string,
      realAddress: (form.get("realAddress") as string) || null,
      publicationTitle: (form.get("publicationTitle") as string) || null,
      referenceCode: (form.get("referenceCode") as string) || null,
      publicUrl: (form.get("publicUrl") as string) || null,
      city: (form.get("city") as string) || null,
      zone: (form.get("zone") as string) || null,
      type: (form.get("type") as string) || null,
      status: form.get("status") as string,
      roomAmount: (form.get("roomAmount") as string) || null,
      bathroomAmount: (form.get("bathroomAmount") as string) || null,
      totalSurface: (form.get("totalSurface") as string) || null,
      operationType: (form.get("operationType") as string) || null,
      operationPrice: (form.get("operationPrice") as string) || null,
      operationCurrency: (form.get("operationCurrency") as string) || null,
    };

    try {
      const url = editProperty
        ? `/api/propiedades/${editProperty.id}`
        : "/api/propiedades";
      const method = editProperty ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Error al guardar");
        return;
      }

      toast.success(editProperty ? "Propiedad actualizada" : "Propiedad creada");
      handleClose();
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editProperty) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/propiedades/${editProperty.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? "Error al eliminar");
        return;
      }

      toast.success("Propiedad eliminada");
      handleClose();
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssignFollowUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAssigning(true);

    const form = new FormData(e.currentTarget);
    const body = {
      propertyId: form.get("propertyId"),
      assignedToUserId: form.get("assignedToUserId"),
      title: form.get("title") || null,
      notes: form.get("notes") || null,
      dueDate: form.get("dueDate") || null,
      status: "pendiente",
    };

    try {
      const res = await fetch("/api/seguimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo asignar el seguimiento");
        return;
      }

      toast.success("Seguimiento asignado");
      setAssignModalOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setAssigning(false);
    }
  }

  async function handleSyncTokko(mode: "auto" | "api") {
    setSyncingTokko(true);
    try {
      const res = await fetch("/api/integrations/tokko/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "No se pudo sincronizar con Tokko");
        return;
      }
      if (data.data?.noChanges) {
        toast.success("Tokko al día. No se detectaron nuevas propiedades.");
        router.refresh();
        return;
      }
      toast.success(
        `Tokko sincronizado · nuevos: ${data.data?.created ?? 0}, actualizados: ${data.data?.updated ?? 0}`
      );
      router.refresh();
    } catch {
      toast.error("Error de conexión al sincronizar Tokko");
    } finally {
      setSyncingTokko(false);
    }
  }

  const isEdit = !!editProperty;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text">Propiedades</h1>
          <p className="text-sm text-text-muted">
            {total} propiedad{total !== 1 ? "es" : ""} registrada{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setAssignModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-secondary/30 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              Asignar seguimiento
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => handleSyncTokko("auto")}
              disabled={syncingTokko}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
                <polyline points="21 3 21 8 16 8" />
              </svg>
              {syncingTokko ? "Sincronizando..." : "Actualizar Tokko"}
            </button>
          )}
          <button
            onClick={handleNew}
            className="flex items-center gap-2 rounded-xl bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva propiedad
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          placeholder="Buscar por dirección, código, título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface/40 py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-text-muted">
                <th className="px-5 py-3">Dirección</th>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3">Ciudad</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-text-muted">
                    {search ? "Sin resultados para la búsqueda" : "No hay propiedades registradas"}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleEdit(p)}
                    className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-surface/50"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text">{p.address}</p>
                      <p className="text-xs text-text-muted">{p.publicationTitle ?? p.realAddress ?? "Sin título"}</p>
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">{p.referenceCode ?? (p.tokkoId ? `#${p.tokkoId}` : "—")}</td>
                    <td className="px-5 py-3.5 text-text-muted">
                      {p.operationPrice ? `${p.operationCurrency ?? "USD"} ${p.operationPrice.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">{p.city ?? "—"}</td>
                    <td className="px-5 py-3.5 capitalize text-text-muted">{p.type ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${getStatusColor(p.status)}`} />
                        <span className="text-text-muted">{getStatusLabel(p.status)}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {p.publicUrl ? (
                        <a
                          href={p.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-secondary/40 bg-secondary/15 px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-secondary/25"
                        >
                          Ver ficha
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17L17 7" />
                            <path d="M7 7h10v10" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} />

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-medium text-text">
                  {isEdit ? "Editar propiedad" : "Nueva propiedad"}
                </h2>
                <button
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Dirección *</label>
                  <input
                    name="address"
                    required
                    defaultValue={editProperty?.address ?? ""}
                    placeholder="Av. Corrientes 1234, 5to A"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Título publicación</label>
                    <input
                      name="publicationTitle"
                      defaultValue={editProperty?.publicationTitle ?? ""}
                      placeholder="Título de aviso"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Código referencia</label>
                    <input
                      name="referenceCode"
                      defaultValue={editProperty?.referenceCode ?? ""}
                      placeholder="Ej: ZP-M-51545814"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Dirección real</label>
                  <input
                    name="realAddress"
                    defaultValue={editProperty?.realAddress ?? ""}
                    placeholder="Brown 1082 - 2B"
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Zona</label>
                    <input
                      name="zone"
                      defaultValue={editProperty?.zone ?? ""}
                      placeholder="Palermo"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Ciudad</label>
                    <input
                      name="city"
                      defaultValue={editProperty?.city ?? ""}
                      placeholder="Buenos Aires"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Tipo</label>
                    <select
                      name="type"
                      defaultValue={editProperty?.type ?? ""}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Estado</label>
                    <select
                      name="status"
                      defaultValue={editProperty?.status ?? "activa"}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                    >
                      {PROPERTY_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Ambientes</label>
                    <input
                      name="roomAmount"
                      type="number"
                      min={0}
                      defaultValue={editProperty?.roomAmount ?? ""}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Baños</label>
                    <input
                      name="bathroomAmount"
                      type="number"
                      min={0}
                      defaultValue={editProperty?.bathroomAmount ?? ""}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Sup. total</label>
                    <input
                      name="totalSurface"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={editProperty?.totalSurface ?? ""}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Operación</label>
                    <input
                      name="operationType"
                      defaultValue={editProperty?.operationType ?? ""}
                      placeholder="Venta / Alquiler"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Moneda</label>
                    <input
                      name="operationCurrency"
                      defaultValue={editProperty?.operationCurrency ?? ""}
                      placeholder="USD"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Precio</label>
                    <input
                      name="operationPrice"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={editProperty?.operationPrice ?? ""}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">URL pública</label>
                  <input
                    name="publicUrl"
                    defaultValue={editProperty?.publicUrl ?? ""}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
                )}

                <div className="mt-2 flex items-center justify-between">
                  {isEdit ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      {deleting ? "Eliminando..." : "Eliminar"}
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-2 rounded-xl bg-secondary/20 px-5 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
                          Guardando...
                        </>
                      ) : isEdit ? (
                        "Guardar cambios"
                      ) : (
                        "Crear propiedad"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assignModalOpen && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setAssignModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-medium text-text">Asignar seguimiento</h2>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAssignFollowUp} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Propiedad *</label>
                    <select
                      name="propertyId"
                      required
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                    >
                      <option value="">Seleccionar...</option>
                      {propertiesForAssignments.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.address}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Asignado a *</label>
                    <select
                      name="assignedToUserId"
                      required
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                    >
                      <option value="">Seleccionar...</option>
                      {usersForAssignments.map((user) => (
                        <option key={user.id} value={user.id}>
                          {getUserLabel(user)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Título</label>
                    <input
                      name="title"
                      placeholder="Ej: Seguimiento comercial"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Vencimiento</label>
                    <input
                      name="dueDate"
                      type="date"
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Notas</label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Indicaciones para el seguimiento..."
                    className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none"
                  />
                </div>

                <div className="mt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={assigning}
                    className="rounded-xl bg-secondary/20 px-5 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50"
                  >
                    {assigning ? "Asignando..." : "Asignar seguimiento"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
