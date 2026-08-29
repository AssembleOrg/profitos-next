"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField } from "@/components/ui/select-field";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Pagination } from "../../_components/pagination";
import { Sheet } from "../../_components/sheet";
import { buildPropertyWhatsAppLink } from "@/lib/whatsapp";
import { MlPublishWizard } from "./ml-publish-wizard";
import { PortalesPanel } from "./portales-panel";

const PropertiesMap = dynamic(
  () => import("./properties-map").then((mod) => mod.PropertiesMap),
  { ssr: false, loading: () => <div className="flex h-[500px] items-center justify-center rounded-3xl border border-border bg-surface text-[13px] text-text-faint">Cargando mapa...</div> }
);

interface Property {
  id: string;
  externalId: number | null;
  source: string;
  address: string;
  realAddress: string | null;
  publicationTitle: string | null;
  referenceCode: string | null;
  publicUrl: string | null;
  city: string | null;
  province: string | null;
  zone: string | null;
  type: string | null;
  status: string;
  roomAmount: number | null;
  bedrooms: number | null;
  bathroomAmount: number | null;
  parkingLotAmount: number | null;
  totalSurface: number | null;
  roofedSurface: number | null;
  operationType: string | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  geoLat: number | null;
  geoLong: number | null;
  ownerReportData: Record<string, unknown> | null;
  createdAt: string;
  _count?: { visitas: number };
  mlPublication?: { status: string; permalink: string | null; published: boolean } | null;
  portalPublications?: { portal: string; status: string; permalink: string | null }[];
}

interface PropiedadesClientProps {
  properties: Property[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  totalAll: number;
  isAdmin: boolean;
  usersForAssignments: Array<{ id: string; fullName: string | null; email: string }>;
  propertiesForAssignments: Array<{ id: string; address: string }>;
  filters: {
    q: string;
    status: string;
    operation: string;
    type: string;
    city: string;
    currency: string;
    sort: string;
  };
}

interface PdfPopupState {
  property: Property;
  top: number;
  left: number;
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
  { value: "activa", label: "Activa", color: "bg-sage-chip text-olive-light" },
  { value: "vendida", label: "Vendida", color: "bg-info-chip text-info" },
  { value: "alquilada", label: "Alquilada", color: "bg-sand-chip text-warning" },
  { value: "suspendida", label: "Suspendida", color: "bg-clay-chip text-terra" },
];

/**
 * Distintivo para propiedades cargadas a mano (no importadas de un portal).
 * Chip con lápiz + "Manual" para que se entienda el origen de un vistazo.
 */
function ManualChip() {
  return (
    <span
      title="Propiedad cargada manualmente"
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-sand-chip px-2 py-0.5 text-[10px] font-bold text-warning"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
      Manual
    </span>
  );
}

/**
 * Chip de estado de la publicación en MercadoLibre.
 * Solo se muestra si la propiedad tiene item publicado (o en error).
 */
const ML_CHIP: Record<string, { label: string; cls: string }> = {
  active: { label: "ML activa", cls: "border-success/30 bg-success/10 text-success" },
  paused: { label: "ML pausada", cls: "border-warning/30 bg-warning-chip text-warning" },
  closed: { label: "ML cerrada", cls: "border-border bg-bg text-text-muted" },
  publishing: { label: "ML publicando…", cls: "border-info/30 bg-info/10 text-info" },
  error: { label: "ML error", cls: "border-danger/30 bg-danger-chip text-danger" },
};
function MlChip({ status, permalink }: { status: string; permalink: string | null }) {
  const c = ML_CHIP[status];
  if (!c) return null;
  const chip = (
    <span
      title={`MercadoLibre: ${c.label}`}
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${c.cls}`}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-9M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
      {c.label}
    </span>
  );
  return permalink ? (
    <a href={permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {chip}
    </a>
  ) : (
    chip
  );
}

/**
 * Chip de estado de la publicación en ZonaProp / ArgenProp (mismo idioma visual
 * que el de ML). Un punto del color del portal + estado. Sólo se muestra si hay
 * fila de publicación para ese portal.
 */
const PUB_CHIP: Record<string, { label: string; cls: string }> = {
  active: { label: "activa", cls: "border-success/30 bg-success/10 text-success" },
  draft: { label: "borrador", cls: "border-border bg-sand-chip text-warning" },
  publishing: { label: "publicando…", cls: "border-info/30 bg-info/10 text-info" },
  paused: { label: "pausada", cls: "border-warning/30 bg-warning-chip text-warning" },
  closed: { label: "cerrada", cls: "border-border bg-bg text-text-muted" },
  error: { label: "error", cls: "border-danger/30 bg-danger-chip text-danger" },
};
const PORTAL_UI: Record<string, { abbr: string; name: string; dot: string }> = {
  zonaprop: { abbr: "ZP", name: "ZonaProp", dot: "#7b61ff" },
  argenprop: { abbr: "AP", name: "ArgenProp", dot: "#e2574c" },
};
function PortalChip({ portal, status, permalink }: { portal: string; status: string; permalink: string | null }) {
  const c = PUB_CHIP[status];
  const ui = PORTAL_UI[portal];
  if (!c || !ui) return null;
  const chip = (
    <span
      title={`${ui.name}: ${c.label}`}
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${c.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ui.dot }} aria-hidden />
      {ui.abbr} {c.label}
    </span>
  );
  return permalink ? (
    <a href={permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {chip}
    </a>
  ) : (
    chip
  );
}

function getStatusColor(status: string) {
  return PROPERTY_STATUSES.find((s) => s.value === status)?.color ?? "bg-bg text-text-faint";
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
  limit,
  totalAll,
  isAdmin,
  usersForAssignments,
  propertiesForAssignments,
  filters,
}: PropiedadesClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [operationFilter, setOperationFilter] = useState(filters.operation);
  const [typeFilter, setTypeFilter] = useState(filters.type);
  const [cityFilter, setCityFilter] = useState(filters.city);
  const [currencyFilter, setCurrencyFilter] = useState(filters.currency);
  const [sortFilter, setSortFilter] = useState(filters.sort || "created_desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"save" | "delete" | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [isMobile, setIsMobile] = useState(false);
  const [syncingMl, setSyncingMl] = useState(false);

  async function handleSyncMl() {
    setSyncingMl(true);
    try {
      const res = await fetch("/api/integrations/mercadolibre/publications/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? "No se pudo sincronizar");
        return;
      }
      toast.success(body.message ?? "Estados sincronizados");
      router.refresh();
    } catch {
      toast.error("Error de conexión al sincronizar");
    } finally {
      setSyncingMl(false);
    }
  }

  // PDF popup & owner modal
  const [pdfPopup, setPdfPopup] = useState<PdfPopupState | null>(null);
  const [ownerModalProperty, setOwnerModalProperty] = useState<Property | null>(null);
  const [wizardProperty, setWizardProperty] = useState<Property | null>(null);
  const [ownerForm, setOwnerForm] = useState({ visitasTotales: "", visitasMes: "", quejas: "", mejoras: "" });
  const [ownerSaving, setOwnerSaving] = useState(false);

  // Detecta mobile una sola vez al montar
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  // Resultado del OAuth de MercadoLibre (?ml_connected / ?ml_error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("ml_connected");
    const err = params.get("ml_error");
    if (connected) toast.success("MercadoLibre conectado");
    if (err) toast.error(err);
    if (connected || err) {
      params.delete("ml_connected");
      params.delete("ml_error");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  // Cerrar popup PDF al hacer click fuera
  useEffect(() => {
    if (!pdfPopup) return;
    function handleClick() {
      setPdfPopup(null);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pdfPopup]);

  useEffect(() => {
    if (!pdfPopup) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPdfPopup(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pdfPopup]);

  function applyFilters(nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string) => {
      const clean = value.trim();
      if (clean) params.set(key, clean);
      else params.delete(key);
    };

    setOrDelete("q", query);
    setOrDelete("status", statusFilter);
    setOrDelete("operation", operationFilter);
    setOrDelete("type", typeFilter);
    setOrDelete("city", cityFilter);
    setOrDelete("currency", currencyFilter);
    setOrDelete("sort", sortFilter);

    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setOperationFilter("");
    setTypeFilter("");
    setCityFilter("");
    setCurrencyFilter("");
    setSortFilter("created_desc");
    router.push(pathname);
  }

  const activeFilters = [
    query && `Búsqueda: ${query}`,
    statusFilter && `Estado: ${getStatusLabel(statusFilter)}`,
    operationFilter && `Operación: ${operationFilter}`,
    typeFilter && `Tipo: ${typeFilter}`,
    cityFilter && `Ciudad: ${cityFilter}`,
    currencyFilter && `Moneda: ${currencyFilter}`,
  ].filter(Boolean) as string[];

  // Filtros "extra" (los del panel colapsable mobile, excluyendo búsqueda y estado)
  const extraActiveCount = [operationFilter, typeFilter, cityFilter, currencyFilter, sortFilter !== "created_desc" ? sortFilter : ""].filter(Boolean).length;

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
      province: (form.get("province") as string) || null,
      zone: (form.get("zone") as string) || null,
      type: (form.get("type") as string) || null,
      status: form.get("status") as string,
      roomAmount: (form.get("roomAmount") as string) || null,
      bedrooms: (form.get("bedrooms") as string) || null,
      bathroomAmount: (form.get("bathroomAmount") as string) || null,
      parkingLotAmount: (form.get("parkingLotAmount") as string) || null,
      totalSurface: (form.get("totalSurface") as string) || null,
      roofedSurface: (form.get("roofedSurface") as string) || null,
      operationType: (form.get("operationType") as string) || null,
      operationPrice: (form.get("operationPrice") as string) || null,
      operationCurrency: (form.get("operationCurrency") as string) || null,
      geoLat: (form.get("geoLat") as string) || null,
      geoLong: (form.get("geoLong") as string) || null,
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

  function handlePdfClick(
    e: React.MouseEvent<HTMLButtonElement>,
    property: Property,
    align: "left" | "right" = "right"
  ) {
    e.stopPropagation();
    if (pdfPopup?.property.id === property.id) {
      setPdfPopup(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 132;
    const menuHeight = 84;
    const viewportPadding = 8;
    const preferredLeft = align === "right" ? rect.right - menuWidth : rect.left;
    const left = Math.min(
      Math.max(preferredLeft, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= menuHeight + viewportPadding
        ? rect.bottom + 6
        : Math.max(viewportPadding, rect.top - menuHeight - 6);

    setPdfPopup({
      property,
      left,
      top,
    });
  }

  function handlePdfNoDueno(propertyId: string) {
    setPdfPopup(null);
    window.open(`/api/propiedades/${propertyId}/pdf`, "_blank");
  }

  function handlePdfDueno(p: Property) {
    setPdfPopup(null);
    const data = (p.ownerReportData ?? {}) as Record<string, unknown>;
    setOwnerForm({
      visitasTotales: data.visitasTotales != null ? String(data.visitasTotales) : "",
      visitasMes: data.visitasMes != null ? String(data.visitasMes) : "",
      quejas: (data.quejas as string) ?? "",
      mejoras: (data.mejoras as string) ?? "",
    });
    setOwnerModalProperty(p);
  }

  async function handleOwnerSubmit() {
    if (!ownerModalProperty) return;
    setOwnerSaving(true);
    const payload = {
      visitasTotales: ownerForm.visitasTotales ? Number(ownerForm.visitasTotales) : null,
      visitasMes: ownerForm.visitasMes ? Number(ownerForm.visitasMes) : null,
      quejas: ownerForm.quejas,
      mejoras: ownerForm.mejoras,
    };
    try {
      const res = await fetch(`/api/propiedades/${ownerModalProperty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerReportData: payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? "Error al guardar");
        return;
      }
      setOwnerModalProperty(null);
      window.open(`/api/propiedades/${ownerModalProperty.id}/pdf?mode=owner`, "_blank");
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setOwnerSaving(false);
    }
  }

  const isEdit = !!editProperty;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Propiedades</h1>
          <p className="text-[12.5px] text-text-faint">
            Mostrando {properties.length} de {total} resultado{total !== 1 ? "s" : ""} · Total global: {totalAll}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setAssignModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg active:bg-bg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <span className="hidden sm:inline">Asignar seguimiento</span>
              <span className="sm:hidden">Asignar</span>
            </button>
          )}
          <button
            onClick={handleSyncMl}
            disabled={syncingMl}
            title="Sincronizar el estado de las publicaciones de MercadoLibre"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg active:bg-bg disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-2.64-6.36L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
            <span className="hidden sm:inline">{syncingMl ? "Sincronizando..." : "Sincronizar ML"}</span>
            <span className="sm:hidden">ML</span>
          </button>
          <div className="inline-flex h-11 items-center gap-0.5 rounded-full border border-border bg-surface p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
                viewMode === "list" ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors ${
                viewMode === "map" ? "bg-dark font-bold text-dark-fg" : "font-medium text-text-faint hover:text-text"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <span className="hidden sm:inline">Mapa</span>
            </button>
          </div>
          <button
            onClick={handleNew}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90 active:opacity-90"
          >
            <svg className="text-accent" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline">Nueva propiedad</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-[20px] border border-border bg-surface p-4">

        {/* Mobile: búsqueda + botón filtros siempre visibles */}
        <div className="flex gap-2 sm:hidden">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters(1)}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((f) => !f)}
            className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${filtersOpen || extraActiveCount > 0 ? "border-transparent bg-sand-chip text-warning" : "border-border bg-surface text-text-muted"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            {extraActiveCount > 0 ? `Filtros (${extraActiveCount})` : "Filtros"}
          </button>
        </div>

        {/* Mobile: estado siempre visible */}
        <SelectField
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          wrapperClassName="mt-2 sm:hidden"
        >
          <option value="">Todos los estados</option>
          {PROPERTY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </SelectField>

        {/* Mobile: panel colapsable */}
        {filtersOpen && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:hidden">
            <SelectField
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
            >
              <option value="">Todas las operaciones</option>
              <option value="venta">Venta</option>
              <option value="alquiler">Alquiler</option>
            </SelectField>
            <SelectField
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {PROPERTY_TYPES.filter((t) => t.value).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </SelectField>
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Ciudad"
              className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
            <SelectField
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
            >
              <option value="">Moneda</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </SelectField>
            <SelectField
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value)}
            >
              <option value="created_desc">Más recientes</option>
              <option value="price_asc">Precio menor</option>
              <option value="price_desc">Precio mayor</option>
              <option value="surface_desc">Mayor superficie</option>
              <option value="external_newest">Más nuevas</option>
            </SelectField>
          </div>
        )}

        {/* Desktop: todos los filtros en grid */}
        <div className="hidden sm:grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Buscar por dirección, código, título..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <SelectField
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </SelectField>
          <SelectField
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
          >
            <option value="">Todas las operaciones</option>
            <option value="venta">Venta</option>
            <option value="alquiler">Alquiler</option>
          </SelectField>
          <SelectField
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {PROPERTY_TYPES.filter((t) => t.value).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </SelectField>
          <input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Ciudad"
            className="h-11 rounded-[14px] border border-border bg-surface px-3.5 text-[13px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
          />
          <SelectField
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="">Moneda</option>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </SelectField>
          <SelectField
            value={sortFilter}
            onChange={(e) => setSortFilter(e.target.value)}
          >
            <option value="created_desc">Más recientes</option>
            <option value="price_asc">Precio menor</option>
            <option value="price_desc">Precio mayor</option>
            <option value="surface_desc">Mayor superficie</option>
            <option value="external_newest">Más nuevas</option>
          </SelectField>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyFilters(1)}
            className="inline-flex h-10 items-center rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity hover:opacity-90"
          >
            Aplicar filtros
          </button>
          <button
            onClick={resetFilters}
            className="px-2 text-[13px] font-bold text-text-faint transition-colors hover:text-text"
          >
            Limpiar filtros
          </button>
          {activeFilters.length > 0 && (
            <div className="ml-1 flex flex-wrap items-center gap-2">
              {activeFilters.map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sand-chip px-3 py-1.5 text-[12px] font-semibold text-text-muted"
                >
                  {chip}
                  <span aria-hidden="true" className="text-text-faint">✕</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map view */}
      {viewMode === "map" && (
        <PropertiesMap
          properties={properties
            .filter((p) => p.geoLat != null && p.geoLong != null)
            .map((p) => ({
              id: p.id,
              address: p.address,
              geoLat: p.geoLat!,
              geoLong: p.geoLong!,
              operationType: p.operationType,
              operationPrice: p.operationPrice,
              operationCurrency: p.operationCurrency,
              type: p.type,
              status: p.status,
            }))}
        />
      )}

      {/* Cards — solo mobile */}
      {viewMode === "list" && <div className="sm:hidden space-y-2">
        {properties.length === 0 ? (
          <div className="rounded-[20px] bg-bg px-6 py-8 text-center">
            <p className="text-[12.5px] text-text-faint">No hay propiedades para los filtros seleccionados</p>
          </div>
        ) : (
          properties.map((p) => (
            <div
              key={p.id}
              onClick={() => handleEdit(p)}
              className="flex cursor-pointer flex-col rounded-[18px] border border-border bg-surface p-3.5 active:bg-bg"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[13.5px] font-bold text-text">{p.address}</p>
                    {p.source === "manual" && <ManualChip />}
                    {p.mlPublication?.published && (
                      <MlChip status={p.mlPublication.status} permalink={p.mlPublication.permalink} />
                    )}
                    {p.portalPublications?.map((pub) => (
                      <PortalChip key={pub.portal} portal={pub.portal} status={pub.status} permalink={pub.permalink} />
                    ))}
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-text-faint">
                    {p.operationType ?? "Operación"} · {p.operationCurrency ?? ""} {p.operationPrice?.toLocaleString("es-AR") ?? "s/d"}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-text-faint">{p.city ?? ""}{p.type ? ` · ${p.type}` : ""}</p>
                </div>
                <span className={`ml-3 mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusColor(p.status)}`}>
                  {getStatusLabel(p.status)}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <a
                  href={buildPropertyWhatsAppLink(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-sage-chip px-3 text-[11px] font-bold text-olive-light"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.696-6.42-1.888l-.447-.293-2.91.975.975-2.91-.293-.447A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                  WhatsApp
                </a>
                <div className="relative">
                  <button
                    onClick={(e) => handlePdfClick(e, p, "left")}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-sand-chip px-3 text-[11px] font-bold text-warning"
                  >
                    PDF
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>}

      {/* Grid 2→3 columnas — sm hasta xl */}
      {viewMode === "list" && (
        <div className="hidden sm:grid xl:hidden grid-cols-2 lg:grid-cols-3 gap-2">
          {properties.length === 0 ? (
            <div className="col-span-3 rounded-[20px] bg-bg px-6 py-8 text-center text-[12.5px] text-text-faint">
              No hay propiedades para los filtros seleccionados
            </div>
          ) : (
            properties.map((p) => (
              <div
                key={p.id}
                onClick={() => handleEdit(p)}
                className="flex cursor-pointer flex-col rounded-[18px] border border-border bg-surface p-4 active:bg-bg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-[13.5px] font-bold text-text">{p.address}</p>
                      {p.source === "manual" && <ManualChip />}
                      {p.mlPublication?.published && (
                        <MlChip status={p.mlPublication.status} permalink={p.mlPublication.permalink} />
                      )}
                      {p.portalPublications?.map((pub) => (
                        <PortalChip key={pub.portal} portal={pub.portal} status={pub.status} permalink={pub.permalink} />
                      ))}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-text-faint">
                      {p.operationType ?? "Operación"} · {p.operationCurrency ?? ""} {p.operationPrice?.toLocaleString("es-AR") ?? "s/d"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-text-faint">{p.city ?? ""}{p.type ? ` · ${p.type}` : ""}</p>
                  </div>
                  <span className={`ml-1 mt-0.5 inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusColor(p.status)}`}>
                    {getStatusLabel(p.status)}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href={buildPropertyWhatsAppLink(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-sage-chip px-3 text-[11px] font-bold text-olive-light"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.696-6.42-1.888l-.447-.293-2.91.975.975-2.91-.293-.447A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                  <div className="relative">
                    <button
                      onClick={(e) => handlePdfClick(e, p, "left")}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-[11px] font-medium text-text-muted"
                    >
                      PDF
                    </button>
                  </div>
                  {p.publicUrl && (
                    <a
                      href={p.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-bg px-3 text-[11px] font-bold text-text-muted"
                    >
                      Tokko
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Table — solo desktop xl+ */}
      {viewMode === "list" && <div className="hidden overflow-hidden rounded-[20px] border border-border bg-surface xl:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Dirección</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Código</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Precio</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Ciudad</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Tipo</th>
                <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Estado</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint">Ficha</th>
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[12.5px] text-text-faint">
                    No hay propiedades para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                properties.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleEdit(p)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-bg"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13.5px] font-bold text-text">{p.address}</p>
                        {p.source === "manual" && <ManualChip />}
                        {p.mlPublication?.published && (
                          <MlChip status={p.mlPublication.status} permalink={p.mlPublication.permalink} />
                        )}
                        {p.portalPublications?.map((pub) => (
                          <PortalChip key={pub.portal} portal={pub.portal} status={pub.status} permalink={pub.permalink} />
                        ))}
                      </div>
                      <p className="text-[11.5px] text-text-faint">{p.publicationTitle ?? p.realAddress ?? "Sin título"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-text-muted">{p.referenceCode ?? (p.externalId ? `#${p.externalId}` : "—")}</td>
                    <td className="px-4 py-3.5 font-display text-[13.5px] font-bold text-text">
                      {p.operationPrice ? `${p.operationCurrency ?? "USD"} ${p.operationPrice.toLocaleString("es-AR")}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-text-muted">{p.city ?? "—"}</td>
                    <td className="px-4 py-3.5 text-[13px] capitalize text-text-muted">{p.type ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <a
                          href={buildPropertyWhatsAppLink(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sage-chip text-olive-light transition-opacity hover:opacity-80"
                          title="Compartir por WhatsApp"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.696-6.42-1.888l-.447-.293-2.91.975.975-2.91-.293-.447A9.953 9.953 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                          </svg>
                        </a>
                        <div className="relative">
                          <button
                            onClick={(e) => handlePdfClick(e, p)}
                            title="Descargar PDF"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand-chip text-warning transition-opacity hover:opacity-80"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                        {p.publicUrl ? (
                          <a
                            href={p.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            title="Ver publicación"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg text-text-muted transition-colors hover:text-text"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 17L17 7" />
                              <path d="M7 7h10v10" />
                            </svg>
                          </a>
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center text-xs text-text-faint">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} />

      {pdfPopup && (
        <div
          className="fixed z-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          style={{ top: `${pdfPopup.top}px`, left: `${pdfPopup.left}px`, width: "132px" }}
        >
          <button
            onClick={() => handlePdfNoDueno(pdfPopup.property.id)}
            className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text"
          >
            No Dueño
          </button>
          <button
            onClick={() => handlePdfDueno(pdfPopup.property)}
            className="block w-full whitespace-nowrap border-t border-border bg-sand-chip px-4 py-2.5 text-left text-[12px] font-bold text-warning transition-opacity hover:opacity-90"
          >
            Dueño
          </button>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Panel — bottom sheet en mobile, dialog en desktop */}
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`fixed z-50 flex flex-col border border-border bg-surface shadow-2xl
                /* mobile: bottom sheet */
                bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-[28px]
                /* desktop: centered dialog — ancho amplio para respirar */
                sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-2xl lg:max-w-4xl
                sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[88vh] sm:rounded-3xl`}
            >
              {/* Drag handle — solo mobile */}
              <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-border sm:hidden" />

              {/* Header fijo */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold text-text">
                  {isEdit ? "Editar propiedad" : "Nueva propiedad"}
                  {isEdit && editProperty?.source === "manual" && <ManualChip />}
                </h2>
                <button
                  onClick={handleClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors active:bg-bg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Body scrolleable */}
              <form id="property-form" onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4 sm:gap-5 sm:px-8 sm:py-6">
                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Dirección *</label>
                  <input
                    name="address"
                    required
                    defaultValue={editProperty?.address ?? ""}
                    placeholder="Av. Corrientes 1234, 5to A"
                    className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Título publicación</label>
                    <input
                      name="publicationTitle"
                      defaultValue={editProperty?.publicationTitle ?? ""}
                      placeholder="Título de aviso"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Código referencia</label>
                    <input
                      name="referenceCode"
                      defaultValue={editProperty?.referenceCode ?? ""}
                      placeholder="Ej: ZP-M-51545814"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Dirección real</label>
                  <input
                    name="realAddress"
                    defaultValue={editProperty?.realAddress ?? ""}
                    placeholder="Brown 1082 - 2B"
                    className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Provincia</label>
                    <input
                      name="province"
                      defaultValue={editProperty?.province ?? ""}
                      placeholder="Buenos Aires"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Ciudad / Partido</label>
                    <input
                      name="city"
                      defaultValue={editProperty?.city ?? ""}
                      placeholder="Quilmes"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Barrio / Zona</label>
                    <input
                      name="zone"
                      defaultValue={editProperty?.zone ?? ""}
                      placeholder="Ezpeleta"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Tipo</label>
                    <SelectField
                      name="type"
                      defaultValue={editProperty?.type ?? ""}
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Estado</label>
                    <SelectField
                      name="status"
                      defaultValue={editProperty?.status ?? "activa"}
                    >
                      {PROPERTY_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Ambientes</label>
                    <input
                      name="roomAmount"
                      type="number"
                      min={0}
                      defaultValue={editProperty?.roomAmount ?? ""}
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Dormitorios</label>
                    <input
                      name="bedrooms"
                      type="number"
                      min={0}
                      defaultValue={editProperty?.bedrooms ?? ""}
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Baños</label>
                    <input
                      name="bathroomAmount"
                      type="number"
                      min={0}
                      defaultValue={editProperty?.bathroomAmount ?? ""}
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Cocheras</label>
                    <input
                      name="parkingLotAmount"
                      type="number"
                      min={0}
                      defaultValue={editProperty?.parkingLotAmount ?? ""}
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Sup. total (m²)</label>
                    <input
                      name="totalSurface"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={editProperty?.totalSurface ?? ""}
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Sup. cubierta (m²)</label>
                    <input
                      name="roofedSurface"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={editProperty?.roofedSurface ?? ""}
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                </div>

                {/* Operación y Moneda ocultas del modal — visibles solo en tabla y filtros
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Operación</label>
                    <input
                      name="operationType"
                      defaultValue={editProperty?.operationType ?? ""}
                      placeholder="Venta / Alquiler"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Moneda</label>
                    <input
                      name="operationCurrency"
                      defaultValue={editProperty?.operationCurrency ?? ""}
                      placeholder="USD"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                */}
                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Precio</label>
                  <input
                    name="operationPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={editProperty?.operationPrice ?? ""}
                    className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                  />
                </div>
                {/* fin campos ocultos */}

                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">URL pública</label>
                  <input
                    name="publicUrl"
                    defaultValue={editProperty?.publicUrl ?? ""}
                    placeholder="https://..."
                    className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Latitud</label>
                    <input
                      name="geoLat"
                      type="number"
                      step="any"
                      defaultValue={editProperty?.geoLat ?? ""}
                      placeholder="-34.6037"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Longitud</label>
                    <input
                      name="geoLong"
                      type="number"
                      step="any"
                      defaultValue={editProperty?.geoLong ?? ""}
                      placeholder="-58.3816"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                </div>

                {error && (
                  <p className="rounded-[14px] bg-clay-chip px-3.5 py-2 text-[13px] font-semibold text-terra">{error}</p>
                )}
              </form>

              {/* Publicación multi-portal (ML + ZonaProp + ArgenProp) */}
              {isEdit && editProperty?.id && (
                <div className="flex-shrink-0 border-t border-border px-5 py-3">
                  <PortalesPanel propertyId={editProperty.id} />
                </div>
              )}

              {/* Estado de publicación en MercadoLibre */}
              {isEdit && editProperty?.mlPublication?.published && (
                <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-sand-chip/40 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <MlChip status={editProperty.mlPublication.status} permalink={null} />
                    <span className="text-xs text-text-muted">Publicado en MercadoLibre</span>
                  </div>
                  {editProperty.mlPublication.permalink && (
                    <div className="flex items-center gap-2">
                      <a
                        href={editProperty.mlPublication.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted transition-colors hover:bg-bg"
                      >
                        Ver aviso
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17L17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(editProperty.mlPublication!.permalink!);
                            toast.success("Link copiado");
                          } catch {
                            toast.error("No se pudo copiar");
                          }
                        }}
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-text-muted transition-colors hover:bg-bg"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        Copiar link
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Footer fijo con acciones */}
              <div
                className="flex flex-shrink-0 items-center justify-between border-t border-border px-5 py-4"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                {isEdit ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmAction("delete")}
                      disabled={deleting}
                      className="flex h-10 items-center gap-1.5 rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra transition-opacity active:opacity-80 disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      {deleting ? "Eliminando..." : "Eliminar"}
                    </button>
                    {editProperty && (
                      <button
                        type="button"
                        onClick={() => {
                          const p = editProperty;
                          handleClose();
                          setWizardProperty(p);
                        }}
                        className="flex h-10 items-center gap-1.5 rounded-full bg-sand-chip px-4 text-[13px] font-bold text-warning transition-opacity active:opacity-80"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                        {editProperty.mlPublication?.published ? "Gestionar en ML" : "Publicar en ML"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
                  >
                    Cancelar
                  </button>
                  {isEdit ? (
                    <button
                      type="button"
                      onClick={() => setConfirmAction("save")}
                      disabled={loading}
                      className="flex items-center gap-2 h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-dark-fg/30 border-t-dark-fg" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar cambios"
                      )}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="property-form"
                      disabled={loading}
                      className="flex items-center gap-2 h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-dark-fg/30 border-t-dark-fg" />
                          Guardando...
                        </>
                      ) : (
                        "Crear propiedad"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de confirmación — Guardar / Eliminar */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              key="confirm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-scrim backdrop-blur-sm"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              key="confirm-dialog"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6 shadow-2xl"
            >
              <p className="font-display text-[17px] font-semibold text-text">
                {confirmAction === "delete" ? "¿Eliminar propiedad?" : "¿Guardar cambios?"}
              </p>
              <p className="mt-1 text-[13px] text-text-muted">
                {confirmAction === "delete"
                  ? "Esta acción no se puede deshacer."
                  : "Se guardarán los cambios realizados en la propiedad."}
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
                >
                  Cancelar
                </button>
                {confirmAction === "delete" ? (
                  <button
                    type="button"
                    onClick={() => { setConfirmAction(null); handleDelete(); }}
                    className="h-10 rounded-full bg-terra px-5 text-[13px] font-bold text-white transition-opacity active:opacity-90"
                  >
                    Eliminar
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="property-form"
                    onClick={() => setConfirmAction(null)}
                    className="h-10 rounded-full bg-dark px-5 text-[13px] font-bold text-dark-fg transition-opacity active:opacity-90"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assignModalOpen && isAdmin && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
              onClick={() => setAssignModalOpen(false)}
            />
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className={`fixed z-50 flex flex-col border border-border bg-surface shadow-2xl
                bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-[28px]
                sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-lg
                sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[85vh] sm:rounded-3xl`}
            >
              <div className="mx-auto mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-border sm:hidden" />

              <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4">
                <h2 className="font-display text-[17px] font-semibold text-text">Asignar seguimiento</h2>
                <button
                  onClick={() => setAssignModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted active:bg-bg"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form id="assign-form" onSubmit={handleAssignFollowUp} className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Propiedad *</label>
                    <SelectField name="propertyId" required>
                      <option value="">Seleccionar...</option>
                      {propertiesForAssignments.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.address}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Asignado a *</label>
                    <SelectField name="assignedToUserId" required>
                      <option value="">Seleccionar...</option>
                      {usersForAssignments.map((user) => (
                        <option key={user.id} value={user.id}>
                          {getUserLabel(user)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Título</label>
                    <input
                      name="title"
                      placeholder="Ej: Seguimiento comercial"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Vencimiento</label>
                    <DatePicker
                      name="dueDate"
                      className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text focus:border-border-strong focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Notas</label>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Indicaciones para el seguimiento..."
                    className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
                  />
                </div>
              </form>

              <div
                className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-border px-5 py-4"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              >
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-semibold text-text-faint transition-colors active:text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="assign-form"
                  disabled={assigning}
                  className="h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
                >
                  {assigning ? "Asignando..." : "Asignar seguimiento"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Owner report modal */}
      <Sheet
        open={!!ownerModalProperty}
        onClose={() => setOwnerModalProperty(null)}
        title="Informe para propietario"
        maxWidth="sm:max-w-lg"
        footer={
          <>
            <button type="button" onClick={() => setOwnerModalProperty(null)} className="px-4 py-2 text-[13px] font-semibold text-text-faint active:text-text">
              Cancelar
            </button>
            <button
              onClick={handleOwnerSubmit}
              disabled={ownerSaving}
              className="flex items-center gap-2 h-11 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity active:opacity-90 disabled:opacity-50"
            >
              {ownerSaving ? "Generando..." : "Guardar y generar PDF"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            {ownerModalProperty?.address}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Visitas totales</label>
              <input
                type="number"
                min={0}
                value={ownerForm.visitasTotales}
                onChange={(e) => setOwnerForm((f) => ({ ...f, visitasTotales: e.target.value }))}
                placeholder="0"
                className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Visitas este mes</label>
              <input
                type="number"
                min={0}
                value={ownerForm.visitasMes}
                onChange={(e) => setOwnerForm((f) => ({ ...f, visitasMes: e.target.value }))}
                placeholder="0"
                className="w-full rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Quejas / Observaciones</label>
            <textarea
              rows={4}
              value={ownerForm.quejas}
              onChange={(e) => setOwnerForm((f) => ({ ...f, quejas: e.target.value }))}
              placeholder="Quejas o comentarios del propietario..."
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-text-muted">Mejoras / Sugerencias</label>
            <textarea
              rows={4}
              value={ownerForm.mejoras}
              onChange={(e) => setOwnerForm((f) => ({ ...f, mejoras: e.target.value }))}
              placeholder="Sugerencias de mejora para la propiedad..."
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text placeholder:text-text-faint focus:border-border-strong focus:outline-none"
            />
          </div>
        </div>
      </Sheet>

      {wizardProperty && (
        <MlPublishWizard
          propertyId={wizardProperty.id}
          propertyLabel={wizardProperty.publicationTitle ?? wizardProperty.address}
          onClose={() => setWizardProperty(null)}
          onPublished={() => router.refresh()}
        />
      )}
    </div>
  );
}
