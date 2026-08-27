"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Publicación en MercadoLibre — pantalla ÚNICA de revisión.
// Todo se infiere/precarga desde la propiedad (categoría, ubicación, precio,
// atributos, aviso, contacto); el usuario corrige lo que haga falta y publica.
// Categorías, atributos, tipos de publicación y lugares se leen en vivo de ML.
// ---------------------------------------------------------------------------

interface MlChildCategory {
  id: string;
  name: string;
}
interface MlCategory {
  id: string;
  name: string;
  children_categories: MlChildCategory[];
  settings?: { listing_allowed?: boolean };
}
interface MlAttribute {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, boolean>;
  values?: { id: string; name: string }[];
  allowed_units?: { id: string; name: string }[];
  default_unit?: string;
  hint?: string;
}
interface MlListingPrice {
  listing_type_id: string;
  listing_type_name: string;
  listing_fee_amount?: number;
  currency_id?: string;
}
interface MlPlace {
  id: string;
  name: string;
}
interface Publication {
  id: string;
  status: string;
  externalId: string | null;
  permalink: string | null;
  categoryId: string | null;
  listingTypeId: string | null;
  lastError: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  publishing: "Publicando…",
  active: "Activa",
  paused: "Pausada",
  closed: "Cerrada",
  error: "Con error",
};
const STATUS_TONE: Record<string, string> = {
  active: "border-success/40 bg-success/10 text-success",
  paused: "border-warning/40 bg-warning-chip text-warning",
  closed: "border-border bg-bg text-text-muted",
  error: "border-danger/40 bg-danger-chip text-danger",
};

interface FullProperty {
  id: string;
  address: string;
  publicationTitle: string | null;
  description: string | null;
  richDescription: string | null;
  city: string | null;
  zone: string | null;
  type: string | null;
  operationType: string | null;
  roomAmount: number | null;
  bathroomAmount: number | null;
  totalSurface: number | null;
  roofedSurface: number | null;
  operationPrice: number | null;
  operationCurrency: string | null;
  geoLat: number | null;
  geoLong: number | null;
  coverImageUrl: string | null;
  photos: unknown;
}

interface AttrValue {
  value_id?: string;
  value_name?: string;
  number?: string;
  unit?: string;
}

interface Props {
  propertyId: string;
  propertyLabel: string;
  onClose: () => void;
  onPublished?: () => void;
}

const input =
  "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none";
const select = input + " [color-scheme:light]";
const labelCls = "text-xs font-medium text-text-muted";
const primaryBtn =
  "flex items-center justify-center gap-2 rounded-xl bg-secondary/20 px-5 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/30 disabled:opacity-50";
const ghostBtn =
  "rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface disabled:opacity-50";

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return json.data as T;
}

// Extrae URLs de fotos del campo Json (soporta strings u objetos {url|image}).
function extractPhotos(photos: unknown, cover: string | null): string[] {
  const out = new Set<string>();
  if (cover) out.add(cover);
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (typeof p === "string") out.add(p);
      else if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        const u = o.url ?? o.image ?? o.src ?? o.image_url;
        if (typeof u === "string") out.add(u);
      }
    }
  }
  return [...out];
}

function normalizeCurrency(c: string | null): string {
  if (!c) return "ARS";
  const up = c.toUpperCase();
  if (up.includes("USD") || up.includes("U$") || up === "US$") return "USD";
  return "ARS";
}

// Normaliza para comparar nombres de categorías/lugares (sin acentos, minúsculas).
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Elige la subcategoría de "tipo" que matchea property.type (ej. casa → Casas).
function pickTypeChild(children: MlChildCategory[], type: string | null): MlChildCategory | undefined {
  if (!type) return undefined;
  const t = norm(type);
  return children.find((c) => {
    const n = norm(c.name);
    return n.includes(t) || t.includes(n.replace(/s$/, ""));
  });
}

// Elige la subcategoría de "operación" que matchea property.operationType.
function pickOperationChild(
  children: MlChildCategory[],
  operation: string | null
): MlChildCategory | undefined {
  if (!operation) return undefined;
  const op = norm(operation);
  if (op.includes("temporal"))
    return children.find((c) => norm(c.name).includes("temporal"));
  if (op.includes("alquiler"))
    return (
      children.find((c) => norm(c.name) === "alquiler") ??
      children.find((c) => norm(c.name).includes("alquiler") && !norm(c.name).includes("temporal"))
    );
  if (op.includes("venta")) return children.find((c) => norm(c.name).includes("venta"));
  return undefined;
}

export function MlPublishWizard({ propertyId, propertyLabel, onClose, onPublished }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [property, setProperty] = useState<FullProperty | null>(null);
  const [publishing, setPublishing] = useState(false);

  // --- publicación existente (gestión) ---
  const [publication, setPublication] = useState<Publication | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  // --- categoría ---
  const [rootCat, setRootCat] = useState<MlCategory | null>(null);
  const [catPath, setCatPath] = useState<MlChildCategory[]>([]);
  const [currentCat, setCurrentCat] = useState<MlCategory | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [leafCategory, setLeafCategory] = useState<MlChildCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [inferDone, setInferDone] = useState(false);
  const [catBusy, setCatBusy] = useState(false);

  // --- atributos ---
  const [attributes, setAttributes] = useState<MlAttribute[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, AttrValue>>({});

  // --- precio / listing ---
  const [listingPrices, setListingPrices] = useState<MlListingPrice[]>([]);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [listingTypeId, setListingTypeId] = useState("");

  // --- ubicación ---
  const [states, setStates] = useState<MlPlace[]>([]);
  const [cities, setCities] = useState<MlPlace[]>([]);
  const [loc, setLoc] = useState({
    address_line: "",
    zip_code: "",
    neighborhood: "",
    stateId: "",
    stateName: "",
    cityId: "",
    cityName: "",
    latitude: "",
    longitude: "",
  });

  // --- aviso ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pictures, setPictures] = useState<string[]>([]);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [newPic, setNewPic] = useState("");

  // --- contacto ---
  const [contact, setContact] = useState({ contact: "", area_code: "", phone: "", email: "" });

  // Carga inicial: conexión + propiedad + categoría raíz + provincias + publicación.
  useEffect(() => {
    (async () => {
      try {
        const status = await api<{ connected: boolean; configured: boolean }>(
          "/api/integrations/mercadolibre/status"
        );
        setConnected(status.connected);
        setConfigured(status.configured);
        if (!status.connected) return;

        const [prop, root, sts, pub] = await Promise.all([
          api<FullProperty>(`/api/propiedades/${propertyId}`),
          api<MlCategory>("/api/integrations/mercadolibre/catalog?resource=category"),
          api<MlPlace[]>("/api/integrations/mercadolibre/catalog?resource=states"),
          api<Publication | null>(`/api/integrations/mercadolibre/publications/${propertyId}`),
        ]);
        setProperty(prop);
        setRootCat(root);
        setCurrentCat(root);
        setStates(sts);
        setPublication(pub);
        if (pub?.externalId) setShowManage(true);

        // Prefill del aviso / precio / ubicación desde la propiedad.
        setTitle((prop.publicationTitle ?? prop.address ?? "").slice(0, 60));
        setDescription(prop.description ?? prop.richDescription ?? "");
        setPrice(prop.operationPrice ? String(prop.operationPrice) : "");
        setCurrency(normalizeCurrency(prop.operationCurrency));
        const photos = extractPhotos(prop.photos, prop.coverImageUrl);
        setAllPhotos(photos);
        setPictures(photos);

        // Auto-selección best-effort de provincia por nombre dentro de la dirección.
        const haystack = norm(`${prop.city ?? ""} ${prop.zone ?? ""} ${prop.address ?? ""}`);
        const st = sts.find((s) => haystack.includes(norm(s.name)));
        setLoc((l) => ({
          ...l,
          address_line: prop.address ?? "",
          neighborhood: prop.zone ?? "",
          cityName: prop.city ?? "",
          stateId: st?.id ?? "",
          stateName: st?.name ?? "",
          latitude: prop.geoLat != null ? String(prop.geoLat) : "",
          longitude: prop.geoLong != null ? String(prop.geoLong) : "",
        }));
        if (st) loadCities(st.id, prop.city ?? "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar MercadoLibre");
      }
    })();
     
  }, [propertyId]);

  // Prefill de atributos comunes desde los campos de la propiedad.
  const prefillAttributes = useCallback(
    (attrs: MlAttribute[], prop: FullProperty) => {
      const next: Record<string, AttrValue> = {};
      for (const a of attrs) {
        const numUnit = (n: number | null, unit?: string) =>
          n != null
            ? { number: String(n), unit: unit ?? a.default_unit ?? a.allowed_units?.[0]?.id }
            : null;
        let v: AttrValue | null = null;
        if (a.id === "ROOMS") v = numUnit(prop.roomAmount);
        else if (a.id === "FULL_BATHROOMS" || a.id === "BATHROOMS") v = numUnit(prop.bathroomAmount);
        else if (a.id === "TOTAL_AREA") v = numUnit(prop.totalSurface, a.default_unit ?? "m²");
        else if (a.id === "COVERED_AREA") v = numUnit(prop.roofedSurface, a.default_unit ?? "m²");
        if (v) next[a.id] = v;
      }
      setAttrValues((prev) => ({ ...next, ...prev }));
    },
    []
  );

  // Fija la categoría hoja y carga atributos + tipos de publicación.
  const selectLeaf = useCallback(
    async (leaf: MlChildCategory) => {
      setLeafCategory(leaf);
      setEditingCategory(false);
      setCatBusy(true);
      try {
        const [attrs, prices] = await Promise.all([
          api<MlAttribute[]>(
            `/api/integrations/mercadolibre/catalog?resource=attributes&id=${leaf.id}`
          ),
          api<MlListingPrice[]>(
            `/api/integrations/mercadolibre/catalog?resource=listing_prices&id=${leaf.id}`
          ),
        ]);
        const req = attrs.filter((a) => a.tags?.required);
        setAttributes(req);
        setListingPrices(prices);
        if (prices.length) {
          const free = prices.find((p) => p.listing_type_id === "free");
          setListingTypeId((free ?? prices[0]).listing_type_id);
        }
        if (property) prefillAttributes(req, property);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar características");
      } finally {
        setCatBusy(false);
      }
    },
    [property, prefillAttributes]
  );

  // Navega a una subcategoría (o la selecciona si es hoja).
  const openCategory = useCallback(
    async (id: string) => {
      setCatLoading(true);
      try {
        const cat = await api<MlCategory>(
          `/api/integrations/mercadolibre/catalog?resource=category&id=${id}`
        );
        if (cat.children_categories?.length) {
          setCurrentCat(cat);
          setCatPath((p) => [...p, { id: cat.id, name: cat.name }]);
        } else {
          await selectLeaf({ id: cat.id, name: cat.name });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al abrir categoría");
      } finally {
        setCatLoading(false);
      }
    },
    [selectLeaf]
  );

  // Inferencia automática de categoría: tipo → operación (camina el árbol vivo).
  const inferCategory = useCallback(
    async (root: MlCategory, prop: FullProperty) => {
      setInferring(true);
      try {
        const typeNode = pickTypeChild(root.children_categories ?? [], prop.type);
        if (!typeNode) return;
        const typeCat = await api<MlCategory>(
          `/api/integrations/mercadolibre/catalog?resource=category&id=${typeNode.id}`
        );
        if (!typeCat.children_categories?.length) {
          await selectLeaf({ id: typeCat.id, name: typeNode.name });
          return;
        }
        const opNode = pickOperationChild(typeCat.children_categories, prop.operationType);
        if (!opNode) return;
        const opCat = await api<MlCategory>(
          `/api/integrations/mercadolibre/catalog?resource=category&id=${opNode.id}`
        );
        if (opCat.children_categories?.length) return; // más profundo → dejar manual
        await selectLeaf({ id: opNode.id, name: `${typeNode.name} · ${opNode.name}` });
      } catch {
        // silencioso: si no se pudo inferir, el usuario elige manual
      } finally {
        setInferring(false);
      }
    },
    [selectLeaf]
  );

  // Dispara la inferencia una vez que hay propiedad + árbol raíz.
  useEffect(() => {
    if (inferDone || !property || !rootCat || leafCategory || publication?.externalId) return;
    setInferDone(true);
    inferCategory(rootCat, property);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, rootCat, publication]);

  async function loadCities(stateId: string, preselectCityName = "") {
    try {
      const cs = await api<MlPlace[]>(
        `/api/integrations/mercadolibre/catalog?resource=cities&id=${stateId}`
      );
      setCities(cs);
      if (preselectCityName) {
        const match = cs.find((c) => norm(c.name) === norm(preselectCityName));
        if (match) setLoc((l) => ({ ...l, cityId: match.id, cityName: match.name }));
      }
    } catch {
      setCities([]);
    }
  }

  const goToState = useCallback((stateId: string) => {
    const st = states.find((s) => s.id === stateId);
    setLoc((l) => ({ ...l, stateId, stateName: st?.name ?? "", cityId: "" }));
    if (!stateId) return setCities([]);
    loadCities(stateId);
     
  }, [states]);

  const canPublish = useMemo(
    () => Boolean(leafCategory && title.trim() && listingTypeId && Number(price) > 0 && pictures.length),
    [leafCategory, title, listingTypeId, price, pictures]
  );

  function buildAttributesPayload() {
    return attributes.map((a) => {
      const v = attrValues[a.id] ?? {};
      if (v.value_id) return { id: a.id, value_id: v.value_id };
      if (a.value_type === "number_unit" && v.number)
        return { id: a.id, value_name: `${v.number} ${v.unit ?? a.default_unit ?? ""}`.trim() };
      if (v.number) return { id: a.id, value_name: v.number };
      return { id: a.id, value_name: v.value_name ?? "" };
    });
  }

  async function handlePublish() {
    if (!canPublish || !leafCategory) return;
    setPublishing(true);
    try {
      const payload = {
        propertyId,
        input: {
          title: title.trim(),
          categoryId: leafCategory.id,
          price: Number(price),
          currencyId: currency,
          listingTypeId,
          location: {
            address_line: loc.address_line || undefined,
            zip_code: loc.zip_code || undefined,
            neighborhood: loc.neighborhood ? { name: loc.neighborhood } : undefined,
            city: loc.cityId ? { id: loc.cityId } : loc.cityName ? { name: loc.cityName } : undefined,
            state: loc.stateId ? { id: loc.stateId } : undefined,
            country: { id: "AR" },
            latitude: loc.latitude ? Number(loc.latitude) : undefined,
            longitude: loc.longitude ? Number(loc.longitude) : undefined,
          },
          attributes: buildAttributesPayload(),
          pictures,
          sellerContact:
            contact.contact || contact.phone
              ? {
                  contact: contact.contact || undefined,
                  area_code: contact.area_code || undefined,
                  phone: contact.phone || undefined,
                  email: contact.email || undefined,
                }
              : undefined,
          description: description || undefined,
        },
      };
      const pub = await api<{ permalink: string | null }>(
        "/api/integrations/mercadolibre/publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      toast.success(publication?.externalId ? "Publicación actualizada" : "Publicado en MercadoLibre");
      if (pub.permalink) window.open(pub.permalink, "_blank");
      onPublished?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setPublishing(false);
    }
  }

  // Pausar / activar / cerrar el item ya publicado.
  async function changeStatus(action: "pause" | "activate" | "close") {
    if (action === "close" && !confirm("Cerrar la publicación es irreversible. ¿Continuar?")) return;
    setStatusBusy(true);
    try {
      const updated = await api<Publication>(
        `/api/integrations/mercadolibre/publications/${propertyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      setPublication(updated);
      toast.success("Estado actualizado");
      onPublished?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar el estado");
    } finally {
      setStatusBusy(false);
    }
  }

  // Entra a editar el aviso existente (precarga categoría/tipo).
  async function enterEdit() {
    if (!publication?.categoryId) {
      setShowManage(false);
      return;
    }
    try {
      const cat = await api<MlCategory>(
        `/api/integrations/mercadolibre/catalog?resource=category&id=${publication.categoryId}`
      );
      await selectLeaf({ id: cat.id, name: cat.name });
      if (publication.listingTypeId) setListingTypeId(publication.listingTypeId);
      setShowManage(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar la publicación");
    }
  }

  function startEditCategory() {
    setEditingCategory(true);
    setCatPath([]);
    setCurrentCat(rootCat);
  }

  // ------------------------------- render ---------------------------------

  const listingName =
    listingPrices.find((p) => p.listing_type_id === listingTypeId)?.listing_type_name ?? listingTypeId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-text">Publicar en MercadoLibre</h2>
            <p className="truncate text-xs text-text-muted">{propertyLabel}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-bg" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {connected === null && <div className="p-8 text-center text-sm text-text-muted">Cargando…</div>}

        {connected === false && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-text-muted">
              {configured
                ? "La cuenta de MercadoLibre no está conectada."
                : "MercadoLibre no está configurado (faltan credenciales de la app en el servidor)."}
            </p>
            {configured && (
              <a href="/api/integrations/mercadolibre/connect" className={primaryBtn}>
                Conectar MercadoLibre
              </a>
            )}
          </div>
        )}

        {/* gestión de publicación existente */}
        {connected && showManage && publication && (
          <div className="flex flex-col gap-4 p-6">
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                STATUS_TONE[publication.status] ?? "border-border bg-bg text-text-muted"
              }`}
            >
              <span className="text-sm font-semibold">
                {STATUS_LABEL[publication.status] ?? publication.status}
              </span>
              {publication.permalink && (
                <a href={publication.permalink} target="_blank" rel="noreferrer" className="text-xs font-medium underline">
                  Ver aviso ↗
                </a>
              )}
            </div>
            {publication.lastError && (
              <p className="rounded-lg bg-danger-chip px-3 py-2 text-xs text-danger">{publication.lastError}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {publication.status === "active" && (
                <button className={ghostBtn} disabled={statusBusy} onClick={() => changeStatus("pause")}>
                  Pausar
                </button>
              )}
              {publication.status === "paused" && (
                <button className={ghostBtn} disabled={statusBusy} onClick={() => changeStatus("activate")}>
                  Activar
                </button>
              )}
              {publication.status !== "closed" && (
                <button
                  className={ghostBtn + " border-danger/40 text-danger hover:bg-danger-chip"}
                  disabled={statusBusy}
                  onClick={() => changeStatus("close")}
                >
                  Cerrar aviso
                </button>
              )}
            </div>
            {publication.status !== "closed" && (
              <button className={primaryBtn} onClick={enterEdit}>
                Editar aviso
              </button>
            )}
          </div>
        )}

        {connected && !showManage && !property && (
          <div className="p-8 text-center text-sm text-text-muted">Cargando datos de la propiedad…</div>
        )}

        {/* pantalla única de revisión */}
        {connected && !showManage && property && (
          <>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
              {/* Categoría */}
              <Section title="Categoría">
                {!editingCategory && leafCategory && (
                  <div className="flex items-center justify-between rounded-xl border border-secondary/40 bg-secondary/10 px-3 py-2.5">
                    <span className="text-sm font-medium text-secondary">✓ {leafCategory.name}</span>
                    <button className="text-xs text-text-muted underline" onClick={startEditCategory}>
                      Cambiar
                    </button>
                  </div>
                )}
                {!editingCategory && !leafCategory && (
                  <div className="flex items-center justify-between rounded-xl border border-warning/40 bg-warning-chip px-3 py-2.5">
                    <span className="text-sm text-warning">
                      {inferring ? "Detectando categoría…" : "No se pudo inferir la categoría."}
                    </span>
                    {!inferring && (
                      <button className="text-xs text-warning underline" onClick={startEditCategory}>
                        Elegir
                      </button>
                    )}
                  </div>
                )}
                {editingCategory && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
                      <button className="underline" onClick={startEditCategory}>
                        Inmuebles
                      </button>
                      {catPath.map((c) => (
                        <span key={c.id} className="flex items-center gap-1">
                          <span>/</span>
                          <span className="text-text">{c.name}</span>
                        </span>
                      ))}
                    </div>
                    {catLoading && <p className="text-sm text-text-muted">Cargando…</p>}
                    {!catLoading &&
                      currentCat?.children_categories?.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => openCategory(c.id)}
                          className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2.5 text-left text-sm text-text transition-colors hover:border-secondary/40 hover:bg-secondary/5"
                        >
                          <span>{c.name}</span>
                          <span className="text-text-muted">›</span>
                        </button>
                      ))}
                    {leafCategory && (
                      <button className="self-start text-xs text-text-muted underline" onClick={() => setEditingCategory(false)}>
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </Section>

              {/* Precio */}
              <Section title="Precio y publicación">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Precio">
                    <input
                      className={input}
                      inputMode="numeric"
                      value={price}
                      onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="Moneda">
                    <select className={select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="ARS">Pesos (ARS)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </Field>
                  <Field label="Tipo de publicación" className="sm:col-span-2">
                    <select className={select} value={listingTypeId} onChange={(e) => setListingTypeId(e.target.value)}>
                      {listingPrices.length === 0 && <option value="">—</option>}
                      {listingPrices.map((p) => (
                        <option key={p.listing_type_id} value={p.listing_type_id}>
                          {p.listing_type_name}
                          {p.listing_fee_amount ? ` — $${p.listing_fee_amount}` : " — gratis"}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Section>

              {/* Ubicación */}
              <Section title="Ubicación">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Dirección" className="sm:col-span-2">
                    <input
                      className={input}
                      value={loc.address_line}
                      onChange={(e) => setLoc({ ...loc, address_line: e.target.value })}
                      placeholder="Av. Siempre Viva 742"
                    />
                  </Field>
                  <Field label="Provincia">
                    <select className={select} value={loc.stateId} onChange={(e) => goToState(e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {states.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ciudad">
                    <select
                      className={select}
                      value={loc.cityId}
                      onChange={(e) => {
                        const c = cities.find((x) => x.id === e.target.value);
                        setLoc({ ...loc, cityId: e.target.value, cityName: c?.name ?? loc.cityName });
                      }}
                      disabled={!cities.length}
                    >
                      <option value="">{loc.cityName || "Seleccionar…"}</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Barrio">
                    <input className={input} value={loc.neighborhood} onChange={(e) => setLoc({ ...loc, neighborhood: e.target.value })} />
                  </Field>
                  <Field label="Código postal">
                    <input className={input} value={loc.zip_code} onChange={(e) => setLoc({ ...loc, zip_code: e.target.value })} />
                  </Field>
                  <Field label="Latitud">
                    <input className={input} value={loc.latitude} onChange={(e) => setLoc({ ...loc, latitude: e.target.value })} inputMode="decimal" />
                  </Field>
                  <Field label="Longitud">
                    <input className={input} value={loc.longitude} onChange={(e) => setLoc({ ...loc, longitude: e.target.value })} inputMode="decimal" />
                  </Field>
                </div>
              </Section>

              {/* Características */}
              {attributes.length > 0 && (
                <Section title="Características">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {attributes.map((a) => (
                      <Field key={a.id} label={a.name} hint={a.hint}>
                        {a.value_type === "list" && a.values?.length ? (
                          <select
                            className={select}
                            value={attrValues[a.id]?.value_id ?? ""}
                            onChange={(e) => setAttrValues({ ...attrValues, [a.id]: { value_id: e.target.value } })}
                          >
                            <option value="">Seleccionar…</option>
                            {a.values.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        ) : a.value_type === "boolean" ? (
                          <select
                            className={select}
                            value={attrValues[a.id]?.value_id ?? ""}
                            onChange={(e) => setAttrValues({ ...attrValues, [a.id]: { value_id: e.target.value } })}
                          >
                            <option value="">Seleccionar…</option>
                            {(a.values ?? [
                              { id: "242085", name: "Sí" },
                              { id: "242084", name: "No" },
                            ]).map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        ) : a.value_type === "number_unit" ? (
                          <div className="flex gap-2">
                            <input
                              className={input}
                              inputMode="decimal"
                              value={attrValues[a.id]?.number ?? ""}
                              onChange={(e) => setAttrValues({ ...attrValues, [a.id]: { ...attrValues[a.id], number: e.target.value } })}
                            />
                            <select
                              className={select + " max-w-[120px]"}
                              value={attrValues[a.id]?.unit ?? a.default_unit ?? a.allowed_units?.[0]?.id ?? ""}
                              onChange={(e) => setAttrValues({ ...attrValues, [a.id]: { ...attrValues[a.id], unit: e.target.value } })}
                            >
                              {(a.allowed_units ?? [{ id: a.default_unit ?? "m²", name: a.default_unit ?? "m²" }]).map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : a.value_type === "number" ? (
                          <input
                            className={input}
                            inputMode="numeric"
                            value={attrValues[a.id]?.number ?? ""}
                            onChange={(e) => setAttrValues({ ...attrValues, [a.id]: { number: e.target.value } })}
                          />
                        ) : (
                          <input
                            className={input}
                            value={attrValues[a.id]?.value_name ?? ""}
                            onChange={(e) => setAttrValues({ ...attrValues, [a.id]: { value_name: e.target.value } })}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </Section>
              )}

              {/* Aviso */}
              <Section title="Aviso">
                <div className="flex flex-col gap-3">
                  <Field label="Título del aviso">
                    <input className={input} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
                    <span className="mt-1 text-[11px] text-text-muted">{title.length}/60</span>
                  </Field>
                  <Field label="Descripción">
                    <textarea
                      className={input + " min-h-[110px] resize-y"}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Field>
                  <Field label={`Fotos (${pictures.length} seleccionadas)`}>
                    <div className="flex flex-col gap-3">
                      <p className="text-[11px] text-text-muted/70">
                        Tocá una foto para incluirla o quitarla. La primera seleccionada es la portada.
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {allPhotos.map((url) => {
                          const idx = pictures.indexOf(url);
                          const selected = idx >= 0;
                          return (
                            <button
                              key={url}
                              type="button"
                              onClick={() =>
                                setPictures(selected ? pictures.filter((u) => u !== url) : [...pictures, url])
                              }
                              className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                                selected ? "border-secondary" : "border-transparent opacity-50 hover:opacity-80"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="h-full w-full object-cover" />
                              {selected && (
                                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-white">
                                  {idx + 1}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {allPhotos.length === 0 && (
                        <p className="text-xs text-text-muted">La propiedad no tiene fotos cargadas.</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          className={input}
                          value={newPic}
                          onChange={(e) => setNewPic(e.target.value)}
                          placeholder="Pegar URL de otra foto…"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const u = newPic.trim();
                            if (u && !allPhotos.includes(u)) {
                              setAllPhotos([...allPhotos, u]);
                              setPictures([...pictures, u]);
                              setNewPic("");
                            }
                          }}
                          className="rounded-xl bg-secondary/20 px-4 text-sm font-medium text-secondary"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </Field>
                </div>
              </Section>

              {/* Contacto */}
              <Section title="Contacto (opcional)">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Nombre de contacto" className="sm:col-span-2">
                    <input className={input} value={contact.contact} onChange={(e) => setContact({ ...contact, contact: e.target.value })} />
                  </Field>
                  <Field label="Cód. área">
                    <input className={input} value={contact.area_code} onChange={(e) => setContact({ ...contact, area_code: e.target.value })} placeholder="11" />
                  </Field>
                  <Field label="Teléfono">
                    <input className={input} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                  </Field>
                  <Field label="Email" className="sm:col-span-2">
                    <input className={input} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  </Field>
                </div>
              </Section>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <div className="min-w-0 text-xs text-text-muted">
                {inferring || catBusy ? (
                  <span className="truncate">Cargando datos de MercadoLibre…</span>
                ) : canPublish ? (
                  <span className="truncate">
                    {currency} {price} · {listingName} · {pictures.length} fotos
                  </span>
                ) : (
                  <span className="text-warning">Faltan: categoría, título, tipo, precio &gt; 0 y ≥1 foto.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className={ghostBtn} onClick={onClose}>
                  Cancelar
                </button>
                <button className={primaryBtn} disabled={!canPublish || publishing} onClick={handlePublish}>
                  {publishing
                    ? "Publicando…"
                    : publication?.externalId
                      ? "Actualizar publicación"
                      : "Publicar"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted/70">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label: text,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className={labelCls}>{text}</span>
      {children}
      {hint && <span className="text-[11px] text-text-muted/70">{hint}</span>}
    </label>
  );
}
