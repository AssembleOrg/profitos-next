"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Sheet } from "../../_components/sheet";
import { Spinner } from "../../_components/spinner";
import { Pagination } from "../../_components/pagination";
import { formatDate } from "@/lib/datetime";

interface MemberItem {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  fullName: string | null;
  role: "admin" | "user" | "viewer" | null;
  avatarUrl: string | null;
  hasAccount: boolean;
}

interface Props {
  items: MemberItem[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

const ROLE_CONFIG = {
  admin: { label: "Admin", color: "bg-warning-chip text-warning border-warning/30" },
  user: { label: "Usuario", color: "bg-info-chip text-info border-info/30" },
  viewer: { label: "Viewer", color: "bg-text-faint/10 text-text-faint border-border" },
} as const;

export function MiembrosClient({ items, page, totalPages, total, limit }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user" | "viewer">("user");
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  async function handleCreate() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/miembros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role: newRole }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "Error al agregar miembro");
        return;
      }
      toast.success("Miembro agregado");
      setEmail("");
      setNewRole("user");
      setModalOpen(false);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(item: MemberItem) {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/miembros/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message ?? "Error al actualizar");
        return;
      }
      toast.success(item.isActive ? "Acceso desactivado" : "Acceso activado");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleChangeRole(item: MemberItem, newRole: "admin" | "user" | "viewer") {
    if (item.role === newRole) return;
    setChangingRoleId(item.id);
    try {
      const res = await fetch(`/api/miembros/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message ?? "Error al cambiar rol");
        return;
      }
      toast.success(`Rol cambiado a ${ROLE_CONFIG[newRole].label}`);
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setChangingRoleId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/miembros/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message ?? "Error al eliminar");
        return;
      }
      toast.success("Miembro eliminado");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-text">Miembros</h1>
          <p className="mt-1 text-sm text-text-muted">
            {total} miembro{total !== 1 ? "s" : ""} con acceso al sistema
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-primary-hover"
        >
          + Agregar
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold ${
                    item.isActive
                      ? "bg-secondary/15 text-secondary"
                      : "bg-text-faint/10 text-text-faint"
                  }`}
                >
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    item.email[0].toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm font-medium ${item.isActive ? "text-text" : "text-text-muted line-through"}`}>
                      {item.fullName ?? item.email}
                    </p>
                    {/* Role badge */}
                    {item.role && (
                      <span className={`inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_CONFIG[item.role].color}`}>
                        {ROLE_CONFIG[item.role].label}
                      </span>
                    )}
                    {!item.hasAccount && (
                      <span className="inline-flex shrink-0 rounded-md border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-text-faint">
                        Sin cuenta
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted">
                    {item.fullName ? item.email : `Agregado ${formatDate(item.createdAt)}`}
                    {!item.isActive && " · Inactivo"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 lg:shrink-0 lg:flex-row lg:items-center lg:gap-2">
                {/* Fila superior: Informe + Rol */}
                <div className="flex items-center gap-2">
                  {item.hasAccount && (
                    <Link
                      href={`/miembros/${item.id}/informe`}
                      className="rounded-lg bg-info-chip px-3 py-1.5 text-xs font-medium text-info transition-colors hover:bg-info-chip"
                    >
                      Informe
                    </Link>
                  )}
                  {item.role && (
                    <select
                      value={item.role ?? "user"}
                      onChange={(e) => handleChangeRole(item, e.target.value as "admin" | "user" | "viewer")}
                      disabled={changingRoleId === item.id}
                      className="flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text focus:border-secondary focus:outline-none disabled:opacity-50 lg:flex-none [color-scheme:light]"
                    >
                      <option value="admin">Admin</option>
                      <option value="user">Usuario</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </div>

                {/* Fila inferior: Toggle + Eliminar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(item)}
                    disabled={togglingId === item.id}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors lg:flex-none ${
                      item.isActive
                        ? "bg-warning-chip text-warning hover:bg-warning-chip"
                        : "bg-success-chip text-success hover:bg-success-chip"
                    } disabled:opacity-50`}
                    title={item.isActive ? "Desactivar acceso" : "Activar acceso"}
                  >
                    {togglingId === item.id
                      ? <Spinner size={12} />
                      : item.isActive
                        ? "Desactivar"
                        : "Activar"}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="flex-1 rounded-lg bg-danger-chip px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-chip disabled:opacity-50 lg:flex-none"
                    title="Eliminar"
                  >
                    {deletingId === item.id ? <Spinner variant="red" size={12} /> : "Eliminar"}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-surface px-6 py-12 text-center">
            <p className="text-sm text-text-muted">No hay miembros registrados</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />
        </div>
      )}

      {/* Add modal */}
      <Sheet
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEmail("");
          setNewRole("user");
        }}
        title="Agregar miembro"
        footer={
          <div className="flex w-full gap-3">
            <button
              onClick={() => {
                setModalOpen(false);
                setEmail("");
              }}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-bg"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !email.trim()}
              className="flex flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-bg transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? <Spinner /> : "Agregar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Agregá un email para dar acceso al sistema. El miembro podrá iniciar sesión con este email.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Rol</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user" | "viewer")}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-secondary focus:outline-none [color-scheme:light]"
            >
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
            <p className="mt-1 text-xs text-text-faint">
              El rol se aplicará cuando el miembro inicie sesión por primera vez.
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
