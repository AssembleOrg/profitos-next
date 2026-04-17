"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PriceTableEditor } from "./price-table-editor";
import { ImageUploader, MultiImageUploader } from "./image-uploader";

const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="flex h-[200px] items-center justify-center rounded-lg border border-border bg-bg text-sm text-text-muted">Cargando editor...</div> }
);

interface TablaData {
  titulo: string;
  filas: Array<{ unidad: string; valor: string; observaciones: string }>;
}

interface TasacionData {
  id: string;
  titulo: string;
  direccion: string;
  ubicacionUnidad: string | null;
  superficieTotal: string | null;
  superficieMono: string | null;
  condicionVenta: string | null;
  mapaImageUrl: string | null;
  fotos: string[];
  informeHtml: string | null;
  resultadoHtml: string | null;
  listaPreciosTitulo: string | null;
  tablas: TablaData[];
  status: string;
  createdAt: string;
}

interface Props {
  tasacion: TasacionData;
}

function SectionHeader({ title, number }: { title: string; number: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/15 text-xs font-bold text-secondary">
        {number}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">{title}</h2>
    </div>
  );
}

export function TasacionForm({ tasacion }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Form state
  const [direccion, setDireccion] = useState(tasacion.direccion);
  const [ubicacionUnidad, setUbicacionUnidad] = useState(tasacion.ubicacionUnidad ?? "");
  const [superficieTotal, setSuperficieTotal] = useState(tasacion.superficieTotal ?? "");
  const [superficieMono, setSuperficieMono] = useState(tasacion.superficieMono ?? "");
  const [condicionVenta, setCondicionVenta] = useState(tasacion.condicionVenta ?? "");
  const [mapaImageUrl, setMapaImageUrl] = useState(tasacion.mapaImageUrl ?? "");
  const [fotos, setFotos] = useState<string[]>(tasacion.fotos);
  const [informeHtml, setInformeHtml] = useState(tasacion.informeHtml ?? "");
  const [resultadoHtml, setResultadoHtml] = useState(tasacion.resultadoHtml ?? "");
  const [listaPreciosTitulo, setListaPreciosTitulo] = useState(tasacion.listaPreciosTitulo ?? "");
  const [tablas, setTablas] = useState<TablaData[]>(tasacion.tablas);

  const handleSave = useCallback(async (andPdf = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasaciones/${tasacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direccion,
          titulo: direccion,
          ubicacionUnidad: ubicacionUnidad || null,
          superficieTotal: superficieTotal || null,
          superficieMono: superficieMono || null,
          condicionVenta: condicionVenta || null,
          mapaImageUrl: mapaImageUrl || null,
          fotos,
          informeHtml: informeHtml || null,
          resultadoHtml: resultadoHtml || null,
          listaPreciosTitulo: listaPreciosTitulo || null,
          tablas,
          ...(andPdf && { status: "completada" }),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message ?? "Error al guardar");
        return;
      }
      toast.success("Tasación guardada");
      if (andPdf) {
        window.open(`/api/tasaciones/${tasacion.id}/pdf`, "_blank");
      }
      router.refresh();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }, [direccion, ubicacionUnidad, superficieTotal, superficieMono, condicionVenta, mapaImageUrl, fotos, informeHtml, resultadoHtml, listaPreciosTitulo, tablas, tasacion.id, router]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/tasaciones"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-text">{direccion || "Nueva tasación"}</h1>
            <p className="text-xs text-text-muted">Editando tasación</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Guardar y generar PDF
          </button>
        </div>
      </div>

      {/* Section 1: Portada */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-6">
        <SectionHeader title="Portada" number="1" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Dirección (aparece en la portada) *</label>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="San Martin 870 - Quilmes"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
          />
        </div>
      </div>

      {/* Section 2: Tasación Actualizada */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-6">
        <SectionHeader title="Tasación Actualizada" number="2" />
        <p className="text-xs text-text-faint">
          Estos datos aparecen en el punteo de la segunda página del PDF.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              <strong className="text-text">Ubicación de la unidad:</strong>
            </label>
            <input
              value={ubicacionUnidad}
              onChange={(e) => setUbicacionUnidad(e.target.value)}
              placeholder="San Martin 870 entre 25 de Mayo y Brandsen"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              <strong className="text-text">Superficie total dos ambientes:</strong>
            </label>
            <input
              value={superficieTotal}
              onChange={(e) => setSuperficieTotal(e.target.value)}
              placeholder="64m2"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              <strong className="text-text">Superficie total monoambiente:</strong>
            </label>
            <input
              value={superficieMono}
              onChange={(e) => setSuperficieMono(e.target.value)}
              placeholder="44m2"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              <strong className="text-text">Condición de venta:</strong>
            </label>
            <input
              value={condicionVenta}
              onChange={(e) => setCondicionVenta(e.target.value)}
              placeholder="Vacío"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-secondary focus:outline-none"
            />
          </div>
        </div>

        {/* Mapa image */}
        <ImageUploader
          value={mapaImageUrl}
          onChange={setMapaImageUrl}
          label="Imagen del mapa"
        />
      </div>

      {/* Section 3: Fotos */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-6">
        <SectionHeader title="Fotos de la propiedad" number="3" />
        <p className="text-xs text-text-faint">
          Se mostrarán 2 fotos por página en el PDF. Las imágenes se convierten a AVIF automáticamente.
        </p>
        <MultiImageUploader images={fotos} onChange={setFotos} />
      </div>

      {/* Section 4: Informe */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-6">
        <SectionHeader title="Informe" number="4" />
        <p className="text-xs text-text-faint">
          Descripción detallada del inmueble. Aparece como una página de texto en el PDF.
        </p>
        <RichTextEditor
          content={informeHtml}
          onChange={setInformeHtml}
          placeholder="Las unidades se encuentran distribuidas en distintos pisos..."
        />
      </div>

      {/* Section 5: Resultado */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-6">
        <SectionHeader title="Resultado" number="5" />
        <p className="text-xs text-text-faint">
          Conclusión y estimación de la tasación. Aparece como página de texto en el PDF.
        </p>
        <RichTextEditor
          content={resultadoHtml}
          onChange={setResultadoHtml}
          placeholder="Es importante tener en cuenta que la tasación es un cálculo..."
        />
      </div>

      {/* Section 6: Lista de Precios */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface/30 p-6">
        <SectionHeader title="Lista de Precios" number="6" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Título de la lista</label>
          <div className="flex items-center gap-0 rounded-lg border border-border bg-bg">
            <span className="shrink-0 px-3 py-2.5 text-sm text-text-faint">Lista de Precios -</span>
            <input
              value={listaPreciosTitulo?.replace(/^Lista de Precios\s*-\s*/i, "") ?? ""}
              onChange={(e) => setListaPreciosTitulo(`Lista de Precios - ${e.target.value}`)}
              placeholder="San Martin 870"
              className="flex-1 bg-transparent px-1 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none"
            />
          </div>
        </div>
        <PriceTableEditor tablas={tablas} onChange={setTablas} />
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/30 p-4">
        <Link href="/tasaciones" className="text-sm text-text-muted hover:text-text">
          &larr; Volver al listado
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-surface hover:text-text disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-secondary/20 px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary/30 disabled:opacity-50"
          >
            Guardar y generar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
