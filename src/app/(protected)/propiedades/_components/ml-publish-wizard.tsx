"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Wizard de publicación en MercadoLibre. Dinámico: categorías, atributos,
// tipos de publicación y lugares se leen en vivo de la API de ML.
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

const STEPS = ["Categoría", "Ubicación", "Características", "Precio", "Aviso", "Contacto"];

const input =
  "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:border-secondary focus:outline-none";
const select = input + " [color-scheme:light]";
const label = "text-xs font-medium text-text-muted";
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

export function MlPublishWizard({ propertyId, propertyLabel, onClose, onPublished }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [property, setProperty] = useState<FullProperty | null>(null);
  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);

  // --- publicación existente (gestión) ---
  const [publication, setPublication] = useState<Publication | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  // --- categoría ---
  const [catPath, setCatPath] = useState<MlChildCategory[]>([]);
  const [currentCat, setCurrentCat] = useState<MlCategory | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [leafCategory, setLeafCategory] = useState<MlChildCategory | null>(null);

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

  // Carga inicial: estado de conexión + propiedad + categoría raíz + provincias.
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
        setCurrentCat(root);
        setStates(sts);
        setPublication(pub);
        // Si ya existe un item publicado, arrancá en la pantalla de gestión.
        if (pub?.externalId) setShowManage(true);

        // Prefill del aviso / precio / ubicación desde la propiedad.
        setTitle(prop.publicationTitle ?? prop.address ?? "");
        setDescription(prop.description ?? prop.richDescription ?? "");
        setPrice(prop.operationPrice ? String(prop.operationPrice) : "");
        setCurrency(normalizeCurrency(prop.operationCurrency));
        const photos = extractPhotos(prop.photos, prop.coverImageUrl);
        setAllPhotos(photos);
        setPictures(photos);
        setLoc((l) => ({
          ...l,
          address_line: prop.address ?? "",
          neighborhood: prop.zone ?? "",
          cityName: prop.city ?? "",
          latitude: prop.geoLat != null ? String(prop.geoLat) : "",
          longitude: prop.geoLong != null ? String(prop.geoLong) : "",
        }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar MercadoLibre");
      }
    })();
  }, [propertyId]);

  // Fija la categoría hoja y carga atributos + tipos de publicación.
  const selectLeaf = useCallback(
    async (leaf: MlChildCategory) => {
      setLeafCategory(leaf);
      try {
        const [attrs, prices] = await Promise.all([
          api<MlAttribute[]>(
            `/api/integrations/mercadolibre/catalog?resource=attributes&id=${leaf.id}`
          ),
          api<MlListingPrice[]>(
            `/api/integrations/mercadolibre/catalog?resource=listing_prices&id=${leaf.id}`
          ),
        ]);
        // Solo requeridos, sin los que ya cubrimos aparte (precio/ubicación).
        const req = attrs.filter((a) => a.tags?.required);
        setAttributes(req);
        setListingPrices(prices);
        if (prices.length) {
          const free = prices.find((p) => p.listing_type_id === "free");
          setListingTypeId((free ?? prices[0]).listing_type_id);
        }
        prefillAttributes(req);
        setStep(1);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar características");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [property]
  );

  // Prefill de atributos comunes desde los campos de la propiedad.
  function prefillAttributes(attrs: MlAttribute[]) {
    if (!property) return;
    const next: Record<string, AttrValue> = {};
    for (const a of attrs) {
      const numUnit = (n: number | null, unit?: string) =>
        n != null ? { number: String(n), unit: unit ?? a.default_unit ?? a.allowed_units?.[0]?.id } : null;
      let v: AttrValue | null = null;
      if (a.id === "ROOMS") v = numUnit(property.roomAmount);
      else if (a.id === "FULL_BATHROOMS" || a.id === "BATHROOMS") v = numUnit(property.bathroomAmount);
      else if (a.id === "TOTAL_AREA") v = numUnit(property.totalSurface, a.default_unit ?? "m²");
      else if (a.id === "COVERED_AREA") v = numUnit(property.roofedSurface, a.default_unit ?? "m²");
      if (v) next[a.id] = v;
    }
    setAttrValues((prev) => ({ ...next, ...prev }));
  }

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

  const goToState = useCallback(async (stateId: string) => {
    const st = states.find((s) => s.id === stateId);
    setLoc((l) => ({ ...l, stateId, stateName: st?.name ?? "", cityId: "", cityName: l.cityName }));
    if (!stateId) return setCities([]);
    try {
      const cs = await api<MlPlace[]>(
        `/api/integrations/mercadolibre/catalog?resource=cities&id=${stateId}`
      );
      setCities(cs);
    } catch {
      setCities([]);
    }
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
          sellerContact: contact.contact || contact.phone
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
      toast.success("Publicado en MercadoLibre");
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

  // Entra al wizard para editar el aviso existente (precarga categoría/tipo).
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

  // ------------------------------- render ---------------------------------

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
                <a
                  href={publication.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium underline"
                >
                  Ver aviso ↗
                </a>
              )}
            </div>

            {publication.lastError && (
              <p className="rounded-lg bg-danger-chip px-3 py-2 text-xs text-danger">
                {publication.lastError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {publication.status === "active" && (
                <button
                  className={ghostBtn}
                  disabled={statusBusy}
                  onClick={() => changeStatus("pause")}
                >
                  Pausar
                </button>
              )}
              {publication.status === "paused" && (
                <button
                  className={ghostBtn}
                  disabled={statusBusy}
                  onClick={() => changeStatus("activate")}
                >
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

        {connected && !showManage && (
          <>
            {/* stepper */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-5 py-3">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-shrink-0 items-center gap-1">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                      i === step
                        ? "bg-secondary text-white"
                        : i < step
                          ? "bg-secondary/20 text-secondary"
                          : "bg-bg text-text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-xs ${i === step ? "font-medium text-text" : "text-text-muted"}`}>{s}</span>
                  {i < STEPS.length - 1 && <span className="mx-1 text-text-muted/40">·</span>}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {/* STEP 0 — categoría */}
              {step === 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-muted">
                    Elegí la categoría del inmueble (tipo + operación). Se usa la que exige ML.
                  </p>
                  {leafCategory ? (
                    <div className="flex items-center justify-between rounded-xl border border-secondary/40 bg-secondary/10 px-3 py-2.5">
                      <span className="text-sm font-medium text-secondary">✓ {leafCategory.name}</span>
                      <button
                        className="text-xs text-text-muted underline"
                        onClick={() => {
                          setLeafCategory(null);
                          setCatPath([]);
                          setAttributes([]);
                          openRoot();
                        }}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <>
                      {catPath.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
                          <button className="underline" onClick={openRoot}>
                            Inmuebles
                          </button>
                          {catPath.map((c, i) => (
                            <span key={c.id} className="flex items-center gap-1">
                              <span>/</span>
                              {i === catPath.length - 1 ? (
                                <span className="text-text">{c.name}</span>
                              ) : (
                                <span>{c.name}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5">
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
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 1 — ubicación */}
              {step === 1 && (
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
                    <input
                      className={input}
                      value={loc.neighborhood}
                      onChange={(e) => setLoc({ ...loc, neighborhood: e.target.value })}
                    />
                  </Field>
                  <Field label="Código postal">
                    <input
                      className={input}
                      value={loc.zip_code}
                      onChange={(e) => setLoc({ ...loc, zip_code: e.target.value })}
                    />
                  </Field>
                  <Field label="Latitud">
                    <input
                      className={input}
                      value={loc.latitude}
                      onChange={(e) => setLoc({ ...loc, latitude: e.target.value })}
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="Longitud">
                    <input
                      className={input}
                      value={loc.longitude}
                      onChange={(e) => setLoc({ ...loc, longitude: e.target.value })}
                      inputMode="decimal"
                    />
                  </Field>
                </div>
              )}

              {/* STEP 2 — atributos dinámicos */}
              {step === 2 && (
                <div className="flex flex-col gap-3">
                  {attributes.length === 0 && (
                    <p className="text-sm text-text-muted">Esta categoría no exige características adicionales.</p>
                  )}
                  {attributes.map((a) => (
                    <Field key={a.id} label={a.name} hint={a.hint}>
                      {a.value_type === "list" && a.values?.length ? (
                        <select
                          className={select}
                          value={attrValues[a.id]?.value_id ?? ""}
                          onChange={(e) =>
                            setAttrValues({ ...attrValues, [a.id]: { value_id: e.target.value } })
                          }
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
                          onChange={(e) =>
                            setAttrValues({ ...attrValues, [a.id]: { value_id: e.target.value } })
                          }
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
                            onChange={(e) =>
                              setAttrValues({
                                ...attrValues,
                                [a.id]: { ...attrValues[a.id], number: e.target.value },
                              })
                            }
                          />
                          <select
                            className={select + " max-w-[120px]"}
                            value={attrValues[a.id]?.unit ?? a.default_unit ?? a.allowed_units?.[0]?.id ?? ""}
                            onChange={(e) =>
                              setAttrValues({
                                ...attrValues,
                                [a.id]: { ...attrValues[a.id], unit: e.target.value },
                              })
                            }
                          >
                            {(a.allowed_units ?? [{ id: a.default_unit ?? "m²", name: a.default_unit ?? "m²" }]).map(
                              (u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      ) : a.value_type === "number" ? (
                        <input
                          className={input}
                          inputMode="numeric"
                          value={attrValues[a.id]?.number ?? ""}
                          onChange={(e) =>
                            setAttrValues({ ...attrValues, [a.id]: { number: e.target.value } })
                          }
                        />
                      ) : (
                        <input
                          className={input}
                          value={attrValues[a.id]?.value_name ?? ""}
                          onChange={(e) =>
                            setAttrValues({ ...attrValues, [a.id]: { value_name: e.target.value } })
                          }
                        />
                      )}
                    </Field>
                  ))}
                </div>
              )}

              {/* STEP 3 — precio y tipo de publicación */}
              {step === 3 && (
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
                    <select
                      className={select}
                      value={listingTypeId}
                      onChange={(e) => setListingTypeId(e.target.value)}
                    >
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
              )}

              {/* STEP 4 — aviso (título, descripción, fotos) */}
              {step === 4 && (
                <div className="flex flex-col gap-3">
                  <Field label="Título del aviso">
                    <input
                      className={input}
                      value={title}
                      maxLength={60}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <span className="mt-1 text-[11px] text-text-muted">{title.length}/60</span>
                  </Field>
                  <Field label="Descripción">
                    <textarea
                      className={input + " min-h-[120px] resize-y"}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Field>
                  <Field label={`Fotos (${pictures.length} seleccionadas)`}>
                    <div className="flex flex-col gap-3">
                      <p className="text-[11px] text-text-muted/70">
                        Tocá una foto para incluirla o quitarla del aviso. La primera seleccionada
                        es la portada.
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
                                setPictures(
                                  selected
                                    ? pictures.filter((u) => u !== url)
                                    : [...pictures, url]
                                )
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
              )}

              {/* STEP 5 — contacto + revisión */}
              {step === 5 && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Nombre de contacto" className="sm:col-span-2">
                      <input
                        className={input}
                        value={contact.contact}
                        onChange={(e) => setContact({ ...contact, contact: e.target.value })}
                      />
                    </Field>
                    <Field label="Cód. área">
                      <input
                        className={input}
                        value={contact.area_code}
                        onChange={(e) => setContact({ ...contact, area_code: e.target.value })}
                        placeholder="11"
                      />
                    </Field>
                    <Field label="Teléfono">
                      <input
                        className={input}
                        value={contact.phone}
                        onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      />
                    </Field>
                    <Field label="Email" className="sm:col-span-2">
                      <input
                        className={input}
                        value={contact.email}
                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="rounded-xl border border-border bg-bg p-3 text-xs text-text-muted">
                    <p className="mb-1 font-medium text-text">Resumen</p>
                    <p>Categoría: {leafCategory?.name ?? "—"}</p>
                    <p>
                      Precio: {currency} {price || "—"} · {listingPrices.find((p) => p.listing_type_id === listingTypeId)?.listing_type_name ?? listingTypeId}
                    </p>
                    <p>Fotos: {pictures.length}</p>
                    {!canPublish && (
                      <p className="mt-2 text-warning">
                        Faltan datos: categoría, título, tipo, precio &gt; 0 y al menos una foto.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* footer nav */}
            <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
              <button className={ghostBtn} onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>
                {step === 0 ? "Cancelar" : "Atrás"}
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  className={primaryBtn}
                  disabled={step === 0 && !leafCategory}
                  onClick={() => setStep(step + 1)}
                >
                  Siguiente
                </button>
              ) : (
                <button className={primaryBtn} disabled={!canPublish || publishing} onClick={handlePublish}>
                  {publishing
                    ? "Publicando…"
                    : publication?.externalId
                      ? "Actualizar publicación"
                      : "Publicar"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  async function openRoot() {
    setCatPath([]);
    setCatLoading(true);
    try {
      const root = await api<MlCategory>("/api/integrations/mercadolibre/catalog?resource=category");
      setCurrentCat(root);
    } finally {
      setCatLoading(false);
    }
  }
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
      <span className={label}>{text}</span>
      {children}
      {hint && <span className="text-[11px] text-text-muted/70">{hint}</span>}
    </label>
  );
}
