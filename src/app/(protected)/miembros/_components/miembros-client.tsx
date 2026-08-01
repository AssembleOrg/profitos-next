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
import { SelectField } from "@/components/ui/select-field";

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
  admin: { label: "Admin", color: "bg-sand-chip text-warning" },
  user: { label: "Usuario", color: "bg-info-chip text-info" },
  viewer: { label: "Viewer", color: "bg-bg text-text-faint" },
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
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Miembros</h1>
          <p className="mt-1 text-[12.5px] text-text-faint">
            {total} miembro{total !== 1 ? "s" : ""} con acceso al sistema
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90"
        >
          <span className="text-accent">+</span> Agregar
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
              className={`flex flex-col gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between ${
                item.isActive ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-display text-[12px] font-bold ${
                    item.isActive
                      ? "bg-sand-chip text-text-muted"
                      : "bg-bg text-text-faint"
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
                    <p className={`truncate text-[13.5px] font-bold ${item.isActive ? "text-text" : "text-text-muted line-through"}`}>
                      {item.fullName ?? item.email}
                    </p>
                    {/* Role badge */}
                    {item.role && (
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${ROLE_CONFIG[item.role].color}`}>
                        {ROLE_CONFIG[item.role].label}
                      </span>
                    )}
                    {!item.hasAccount && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-text-faint">
                        Sin cuenta
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11.5px] text-text-faint">
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
                      className="inline-flex items-center rounded-full bg-sage-chip px-3 py-1.5 text-[12px] font-bold text-olive-light transition-opacity hover:opacity-80"
                    >
                      Informe
                    </Link>
                  )}
                  {item.role && (
                    <SelectField
                      value={item.role ?? "user"}
                      onChange={(e) => handleChangeRole(item, e.target.value as "admin" | "user" | "viewer")}
                      disabled={changingRoleId === item.id}
                      className="h-8 rounded-full pl-3 pr-8 text-[11.5px]"
                      wrapperClassName="flex-1 lg:flex-none"
                    >
                      <option value="admin">Admin</option>
                      <option value="user">Usuario</option>
                      <option value="viewer">Viewer</option>
                    </SelectField>
                  )}
                </div>

                {/* Fila inferior: Toggle + Eliminar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(item)}
                    disabled={togglingId === item.id}
                    className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-bold transition-opacity hover:opacity-80 lg:flex-none ${
                      item.isActive
                        ? "bg-warning-chip text-warning"
                        : "bg-success-chip text-success"
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay-chip text-terra transition-opacity hover:opacity-80 disabled:opacity-50"
                    title="Eliminar"
                  >
                    {deletingId === item.id ? (
                      <Spinner variant="red" size={12} />
                    ) : (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 4h11M6.5 4V2.5h3V4M5 4v9.5h6V4M6.8 6.5v4.5M9.2 6.5v4.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="col-span-full rounded-[20px] bg-bg px-6 py-8 text-center">
            <p className="font-display text-[15px] font-semibold text-text">No hay miembros registrados</p>
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
              className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-semibold text-text-faint transition-colors hover:bg-bg"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !email.trim()}
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Spinner /> : "Agregar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[12.5px] text-text-muted">
            Agregá un email para dar acceso al sistema. El miembro podrá iniciar sesión con este email.
          </p>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@ejemplo.com"
              className="h-11 w-full rounded-[14px] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-text-muted">Rol</label>
            <SelectField
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user" | "viewer")}
            >
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </SelectField>
            <p className="mt-1 text-xs text-text-faint">
              El rol se aplicará cuando el miembro inicie sesión por primera vez.
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
