import { prisma } from "@/lib/prisma/client";
import { AppError } from "@/lib/api/handler";
import { ML_PORTAL } from "@/lib/mercadolibre/config";
import { MlApiError } from "@/lib/mercadolibre/client";
import { publishItem, updateItem, setItemStatus, getItem, type MlPublishInput, type MlAttributeInput } from "@/lib/mercadolibre/items";
import {
  REAL_ESTATE_ROOT,
  getCategory,
  getCategoryAttributes,
  getListingPrices,
  getStates,
  getCities,
  type MlAttribute,
  type MlChildCategory,
} from "@/lib/mercadolibre/catalog";
import { getConnectionStatus } from "@/lib/mercadolibre/oauth";

/**
 * Publicación de una propiedad en MercadoLibre, compartida por el wizard de la
 * web (que arma el MlPublishInput a mano) y por el chat IA (que lo infiere de
 * la propiedad con `buildMlInputFromProperty`). También el re-sync de un aviso
 * existente a partir de los datos actuales de la propiedad.
 */

export function describeMlError(err: unknown): string {
  if (err instanceof MlApiError) {
    const body = err.body as { cause?: Array<{ message?: string; code?: string }> } | undefined;
    const causes = body?.cause?.map((c) => c.message).filter(Boolean);
    if (causes?.length) return `MercadoLibre: ${causes.join(" · ")}`;
    return `MercadoLibre: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Error al publicar en MercadoLibre";
}

/** Publica (o re-publica/edita si ya hay item) y persiste PropertyPublication. */
export async function publishPropertyToMl(propertyId: string, input: MlPublishInput) {
  if (!input?.title || !input.categoryId || !input.listingTypeId) {
    throw new AppError(400, "Faltan datos obligatorios (título, categoría o tipo de publicación)");
  }
  if (!input.pictures?.length) throw new AppError(400, "Se requiere al menos una foto");

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, publicUrl: true } });
  if (!property) throw new AppError(404, "Propiedad no encontrada");

  const existing = await prisma.propertyPublication.findUnique({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
  });

  await prisma.propertyPublication.upsert({
    where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
    create: { propertyId, portal: ML_PORTAL, status: "publishing", categoryId: input.categoryId, listingTypeId: input.listingTypeId, lastPayload: input as object },
    update: { status: "publishing", categoryId: input.categoryId, listingTypeId: input.listingTypeId, lastPayload: input as object, lastError: null },
  });

  try {
    let item = existing?.externalId ? await updateItem(existing.externalId, input) : await publishItem(input);
    // ML suele crear el item classified en "paused"; lo activamos.
    if (item.status !== "active" && item.status !== "closed") {
      try {
        item = await setItemStatus(item.id, "active");
      } catch {
        /* sin cupo de gratuitas u otro motivo: queda como está */
      }
    }
    const publication = await prisma.propertyPublication.update({
      where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
      data: {
        externalId: item.id,
        status: item.status === "active" ? "active" : (item.status ?? "active"),
        permalink: item.permalink ?? null,
        publishedAt: existing?.publishedAt ?? new Date(),
        lastError: null,
      },
    });
    if (item.permalink && property.publicUrl !== item.permalink) {
      await prisma.property.update({ where: { id: propertyId }, data: { publicUrl: item.permalink } });
    }
    return { publication, item, updated: Boolean(existing?.externalId) };
  } catch (err) {
    const detail = describeMlError(err);
    await prisma.propertyPublication.update({
      where: { propertyId_portal: { propertyId, portal: ML_PORTAL } },
      data: { status: "error", lastError: detail },
    });
    throw new AppError(err instanceof MlApiError ? err.status || 502 : 502, detail);
  }
}

// ─── Inferencia desde la propiedad (chat IA) ────────────────────────────────

const PROPERTY_SELECT = {
  id: true,
  address: true,
  referenceCode: true,
  publicationTitle: true,
  description: true,
  richDescription: true,
  city: true,
  province: true,
  zone: true,
  type: true,
  operationType: true,
  roomAmount: true,
  bedrooms: true,
  bathroomAmount: true,
  parkingLotAmount: true,
  totalSurface: true,
  roofedSurface: true,
  operationPrice: true,
  operationCurrency: true,
  geoLat: true,
  geoLong: true,
  coverImageUrl: true,
  photos: true,
} as const;

async function loadProperty(id: string) {
  return prisma.property.findUnique({ where: { id }, select: PROPERTY_SELECT });
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function extractPhotoUrls(photos: unknown, cover: string | null): string[] {
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
  return [...out].filter((u) => /^https?:\/\//.test(u));
}

function normalizeCurrency(c: string | null): string {
  if (!c) return "ARS";
  const up = c.toUpperCase();
  return up.includes("USD") || up.includes("U$") ? "USD" : "ARS";
}

function pickTypeChild(children: MlChildCategory[], type: string | null): MlChildCategory | undefined {
  if (!type) return undefined;
  const t = norm(type);
  return children.find((c) => {
    const n = norm(c.name);
    return n.includes(t) || t.includes(n.replace(/s$/, ""));
  });
}

function pickOperationChild(children: MlChildCategory[], operation: string | null): MlChildCategory | undefined {
  if (!operation) return undefined;
  const op = norm(operation);
  if (op.includes("temporal")) return children.find((c) => norm(c.name).includes("temporal"));
  if (op.includes("alquiler")) {
    return children.find((c) => norm(c.name) === "alquiler") ?? children.find((c) => norm(c.name).includes("alquiler") && !norm(c.name).includes("temporal"));
  }
  if (op.includes("venta")) return children.find((c) => norm(c.name).includes("venta"));
  return undefined;
}

/** Lo que el chat puede aportar para completar lo que no se infiere solo. */
export type MlBuildOpts = {
  /** Id de categoría hoja de ML (si la inferencia por tipo/operación falló). */
  categoriaId?: string;
  /** Id o nombre del tipo de publicación (free, bronze, silver, gold...). */
  tipoPublicacion?: string;
  /** Valores para atributos requeridos que faltan: { ID_ATRIBUTO: valor }. */
  atributos?: Record<string, string | number>;
  provincia?: string;
  ciudad?: string;
};

/** Faltante que el bot tiene que preguntar (409 con detalle). */
export class MlNeedsInputError extends AppError {
  constructor(message: string, public readonly detalle: unknown) {
    super(409, message);
  }
}

function attrValueFor(a: MlAttribute, raw: string | number): MlAttributeInput {
  const s = String(raw).trim();
  if (a.values?.length) {
    const hit = a.values.find((v) => v.id === s || norm(v.name) === norm(s)) ?? a.values.find((v) => norm(v.name).includes(norm(s)));
    if (hit) return { id: a.id, value_id: hit.id };
  }
  if (a.value_type === "number_unit") {
    const n = s.replace(/[^\d.,]/g, "").replace(",", ".");
    const unit = a.default_unit ?? a.allowed_units?.[0]?.id ?? "";
    return { id: a.id, value_name: `${n} ${unit}`.trim() };
  }
  return { id: a.id, value_name: s };
}

/**
 * Arma el MlPublishInput a partir de la propiedad (misma lógica que el wizard
 * de la web: categoría por tipo→operación, atributos requeridos prellenados,
 * provincia/ciudad por nombre, fotos de la propiedad). Lo que no se pueda
 * resolver se devuelve como 409 con el detalle para que el bot pregunte.
 */
export async function buildMlInputFromProperty(propertyId: string, opts: MlBuildOpts = {}): Promise<{ input: MlPublishInput; resumen: Record<string, unknown> }> {
  const status = await getConnectionStatus();
  if (!status.connected) throw new AppError(400, "MercadoLibre no está conectado (Propiedades → Portales → Conectar MercadoLibre)");

  const prop = await loadProperty(propertyId);
  if (!prop) throw new AppError(404, "Propiedad no encontrada");

  // 1) Categoría hoja.
  let leaf: { id: string; name: string } | null = null;
  if (opts.categoriaId?.trim()) {
    const cat = await getCategory(opts.categoriaId.trim());
    if (cat.children_categories?.length) {
      throw new MlNeedsInputError(`La categoría ${cat.name} tiene subcategorías; elegí una`, {
        categorias: cat.children_categories.map((c) => ({ id: c.id, nombre: c.name })),
      });
    }
    leaf = { id: cat.id, name: cat.path_from_root?.map((p) => p.name).slice(1).join(" · ") || cat.name };
  } else {
    const root = await getCategory(REAL_ESTATE_ROOT);
    const typeNode = pickTypeChild(root.children_categories ?? [], prop.type);
    if (!typeNode) {
      throw new MlNeedsInputError(`No pude inferir la categoría de MercadoLibre para el tipo "${prop.type ?? "sin tipo"}"; pedile al usuario que elija y reintentá con categoriaId`, {
        categorias: (root.children_categories ?? []).map((c) => ({ id: c.id, nombre: c.name })),
      });
    }
    const typeCat = await getCategory(typeNode.id);
    if (!typeCat.children_categories?.length) {
      leaf = { id: typeCat.id, name: typeNode.name };
    } else {
      const opNode = pickOperationChild(typeCat.children_categories, prop.operationType);
      if (!opNode) {
        throw new MlNeedsInputError(`No pude inferir la operación en MercadoLibre para "${prop.operationType ?? "sin operación"}"; elegí una categoría y reintentá con categoriaId`, {
          categorias: typeCat.children_categories.map((c) => ({ id: c.id, nombre: `${typeNode.name} · ${c.name}` })),
        });
      }
      const opCat = await getCategory(opNode.id);
      if (opCat.children_categories?.length) {
        throw new MlNeedsInputError(`La categoría ${typeNode.name} · ${opNode.name} tiene subcategorías; elegí una y reintentá con categoriaId`, {
          categorias: opCat.children_categories.map((c) => ({ id: c.id, nombre: `${typeNode.name} · ${opNode.name} · ${c.name}` })),
        });
      }
      leaf = { id: opNode.id, name: `${typeNode.name} · ${opNode.name}` };
    }
  }

  // 2) Precio / moneda / título / descripción / fotos.
  const price = prop.operationPrice ?? 0;
  if (!(price > 0)) throw new AppError(400, "La propiedad no tiene precio cargado; editá el precio antes de publicar");
  const currencyId = normalizeCurrency(prop.operationCurrency);
  const title = (prop.publicationTitle ?? prop.address ?? "").trim().slice(0, 60);
  if (!title) throw new AppError(400, "La propiedad no tiene título ni dirección");
  const description = (prop.description ?? prop.richDescription ?? "").trim() || undefined;
  const pictures = extractPhotoUrls(prop.photos, prop.coverImageUrl);
  if (!pictures.length) throw new AppError(400, "La propiedad no tiene fotos; MercadoLibre exige al menos una");

  // 3) Atributos requeridos (prellenados desde la propiedad + lo que aporte el chat).
  const attrs = (await getCategoryAttributes(leaf.id)).filter((a) => a.tags?.required);
  const given = new Map<string, string | number>();
  for (const [k, v] of Object.entries(opts.atributos ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    const a = attrs.find((x) => x.id === k.toUpperCase() || norm(x.name) === norm(k));
    if (a) given.set(a.id, v);
  }
  const attributes: MlAttributeInput[] = [];
  const missing: MlAttribute[] = [];
  for (const a of attrs) {
    const numUnit = (n: number | null, unit?: string) => (n != null ? `${n} ${unit ?? a.default_unit ?? a.allowed_units?.[0]?.id ?? ""}`.trim() : null);
    let v: MlAttributeInput | null = null;
    if (given.has(a.id)) v = attrValueFor(a, given.get(a.id)!);
    else if (a.id === "ROOMS" && prop.roomAmount != null) v = { id: a.id, value_name: numUnit(prop.roomAmount) ?? "" };
    else if (a.id === "BEDROOMS" && prop.bedrooms != null) v = { id: a.id, value_name: numUnit(prop.bedrooms) ?? "" };
    else if ((a.id === "FULL_BATHROOMS" || a.id === "BATHROOMS") && prop.bathroomAmount != null) v = { id: a.id, value_name: numUnit(prop.bathroomAmount) ?? "" };
    else if (a.id === "PARKING_LOTS" && prop.parkingLotAmount != null) v = { id: a.id, value_name: numUnit(prop.parkingLotAmount) ?? "" };
    else if (a.id === "TOTAL_AREA" && prop.totalSurface != null) v = { id: a.id, value_name: numUnit(prop.totalSurface, a.default_unit ?? "m²") ?? "" };
    else if (a.id === "COVERED_AREA" && prop.roofedSurface != null) v = { id: a.id, value_name: numUnit(prop.roofedSurface, a.default_unit ?? "m²") ?? "" };
    if (v && (v.value_id || v.value_name)) attributes.push(v);
    else missing.push(a);
  }
  if (missing.length) {
    throw new MlNeedsInputError(
      `Faltan características obligatorias para MercadoLibre: ${missing.map((m) => m.name).join(", ")}. Preguntale al usuario y reintentá con atributos={ID: valor}`,
      {
        atributosFaltantes: missing.map((m) => ({
          id: m.id,
          nombre: m.name,
          tipo: m.value_type,
          unidad: m.default_unit ?? m.allowed_units?.[0]?.id ?? null,
          valoresPosibles: m.values?.slice(0, 20).map((v) => v.name) ?? null,
        })),
      }
    );
  }

  // 4) Tipo de publicación.
  const prices = await getListingPrices(leaf.id, price);
  const wanted = opts.tipoPublicacion?.trim();
  let listing = wanted
    ? prices.find((p) => p.listing_type_id === wanted.toLowerCase() || norm(p.listing_type_name) === norm(wanted)) ??
      prices.find((p) => norm(p.listing_type_name).includes(norm(wanted)))
    : prices.find((p) => p.listing_type_id === "free");
  if (!listing && !wanted && prices.length === 1) listing = prices[0];
  if (!listing) {
    throw new MlNeedsInputError(
      wanted ? `No existe el tipo de publicación "${wanted}" para esta categoría; elegí uno de la lista` : "No hay publicación gratuita disponible para esta categoría: preguntale al usuario qué tipo de publicación usar (tienen costo)",
      {
        tiposPublicacion: prices.map((p) => ({
          id: p.listing_type_id,
          nombre: p.listing_type_name,
          costo: p.listing_fee_amount != null ? `${p.currency_id ?? "ARS"} ${p.listing_fee_amount}` : null,
        })),
      }
    );
  }

  // 5) Ubicación: provincia/ciudad por nombre (la propiedad o lo que aporte el chat).
  const states = await getStates();
  const provName = opts.provincia?.trim() || prop.province || "";
  const haystack = norm(`${prop.city ?? ""} ${prop.zone ?? ""} ${prop.address ?? ""}`);
  const st = (provName ? states.find((s) => norm(s.name) === norm(provName)) ?? states.find((s) => norm(s.name).includes(norm(provName))) : undefined) ?? states.find((s) => haystack.includes(norm(s.name)));
  if (!st) {
    throw new MlNeedsInputError(`No pude determinar la provincia de ${prop.address}; preguntale al usuario y reintentá con provincia`, {
      provincias: states.map((s) => s.name),
    });
  }
  const cities = await getCities(st.id);
  const cityName = opts.ciudad?.trim() || prop.city || "";
  const city = cityName ? cities.find((c) => norm(c.name) === norm(cityName)) ?? cities.find((c) => norm(c.name).includes(norm(cityName)) || norm(cityName).includes(norm(c.name))) : undefined;
  if (!city) {
    throw new MlNeedsInputError(`No pude ubicar la ciudad "${cityName || "(sin ciudad)"}" en ${st.name} para MercadoLibre; preguntale al usuario y reintentá con ciudad`, {
      provincia: st.name,
      ciudadesEjemplo: cities.slice(0, 40).map((c) => c.name),
    });
  }

  const input: MlPublishInput = {
    title,
    categoryId: leaf.id,
    price,
    currencyId,
    listingTypeId: listing.listing_type_id,
    location: {
      address_line: prop.address || undefined,
      neighborhood: prop.zone ? { name: prop.zone } : undefined,
      city: { id: city.id },
      state: { id: st.id },
      country: { id: "AR" },
      latitude: prop.geoLat ?? undefined,
      longitude: prop.geoLong ?? undefined,
    },
    attributes,
    pictures,
    description,
  };
  const resumen = {
    categoria: leaf.name,
    tipoPublicacion: `${listing.listing_type_name}${listing.listing_fee_amount != null ? ` (${listing.currency_id ?? "ARS"} ${listing.listing_fee_amount})` : ""}`,
    titulo: title,
    precio: `${currencyId} ${price.toLocaleString("es-AR")}`,
    ubicacion: `${city.name}, ${st.name}`,
    fotos: pictures.length,
    caracteristicas: attributes.map((a) => `${a.id}=${a.value_id ?? a.value_name}`),
  };
  return { input, resumen };
}

// ─── Re-sync de un aviso existente con los datos actuales de la propiedad ────

/**
 * Actualiza el item de ML de una propiedad con título, precio, moneda,
 * descripción y fotos actuales. Base: el último payload guardado; si no hay
 * (aviso importado), se reconstruye desde el item de ML.
 */
export async function syncMlPublication(propertyId: string): Promise<{ externalId: string; permalink: string | null; status: string }> {
  const pub = await prisma.propertyPublication.findUnique({ where: { propertyId_portal: { propertyId, portal: ML_PORTAL } } });
  if (!pub?.externalId) throw new AppError(404, "La propiedad no tiene aviso vinculado en MercadoLibre");
  if (pub.status === "closed") throw new AppError(400, "El aviso de MercadoLibre está cerrado: hay que publicarlo de nuevo");
  const prop = await loadProperty(propertyId);
  if (!prop) throw new AppError(404, "Propiedad no encontrada");

  let base = (pub.lastPayload ?? null) as MlPublishInput | null;
  if (!base?.categoryId) {
    const item = await getItem(pub.externalId);
    const it = item as unknown as {
      category_id?: string;
      listing_type_id?: string;
      attributes?: Array<{ id: string; value_id?: string | null; value_name?: string | null }>;
      location?: MlPublishInput["location"];
    };
    base = {
      title: prop.publicationTitle ?? prop.address,
      categoryId: it.category_id ?? "",
      price: prop.operationPrice ?? 0,
      currencyId: normalizeCurrency(prop.operationCurrency),
      listingTypeId: it.listing_type_id ?? "",
      location: it.location ?? {},
      attributes: (it.attributes ?? []).map((a) => ({ id: a.id, value_id: a.value_id ?? null, value_name: a.value_name ?? null })),
      pictures: [],
    };
  }
  const price = prop.operationPrice ?? base.price;
  if (!(price > 0)) throw new AppError(400, "La propiedad no tiene precio cargado");
  const pictures = extractPhotoUrls(prop.photos, prop.coverImageUrl);
  const input: MlPublishInput = {
    ...base,
    title: (prop.publicationTitle ?? prop.address ?? base.title).trim().slice(0, 60),
    price,
    currencyId: normalizeCurrency(prop.operationCurrency),
    description: (prop.description ?? prop.richDescription ?? base.description ?? "").trim() || undefined,
    pictures: pictures.length ? pictures : base.pictures,
  };
  const { publication } = await publishPropertyToMl(propertyId, input);
  return { externalId: publication.externalId!, permalink: publication.permalink, status: publication.status };
}
