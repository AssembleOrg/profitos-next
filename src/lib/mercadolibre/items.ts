// Publicación / edición / cierre de items (inmuebles) en MercadoLibre.
import { mlFetch } from "./client";

export interface MlAttributeInput {
  id: string;
  value_id?: string | null;
  value_name?: string | null;
}

export interface MlLocationInput {
  address_line?: string;
  zip_code?: string;
  neighborhood?: { id?: string; name?: string };
  city?: { id?: string; name?: string };
  state?: { id?: string; name?: string };
  country?: { id?: string };
  latitude?: number;
  longitude?: number;
}

export interface MlSellerContactInput {
  contact?: string;
  other_info?: string;
  area_code?: string;
  phone?: string;
  area_code2?: string;
  phone2?: string;
  email?: string;
  webpage?: string;
}

// Datos que arma el wizard para publicar.
export interface MlPublishInput {
  title: string;
  categoryId: string;
  price: number;
  currencyId: string; // ARS | USD
  listingTypeId: string;
  location: MlLocationInput;
  attributes: MlAttributeInput[];
  pictures: string[]; // URLs
  sellerContact?: MlSellerContactInput;
  description?: string;
}

export interface MlItem {
  id: string;
  permalink: string;
  status: string;
  [k: string]: unknown;
}

function buildItemBody(input: MlPublishInput) {
  return {
    title: input.title,
    category_id: input.categoryId,
    price: input.price,
    currency_id: input.currencyId,
    available_quantity: 1,
    buying_mode: "classified",
    listing_type_id: input.listingTypeId,
    condition: "not_specified",
    location: {
      ...input.location,
      country: input.location.country ?? { id: "AR" },
    },
    attributes: input.attributes
      .filter((a) => a.value_id || a.value_name)
      .map((a) => ({
        id: a.id,
        ...(a.value_id ? { value_id: a.value_id } : { value_name: a.value_name }),
      })),
    pictures: input.pictures.map((source) => ({ source })),
    ...(input.sellerContact ? { seller_contact: input.sellerContact } : {}),
  };
}

// Crea el item y (si hay) la descripción en texto plano.
export async function publishItem(input: MlPublishInput): Promise<MlItem> {
  const item = await mlFetch<MlItem>("/items", { method: "POST", body: buildItemBody(input) });
  if (input.description) {
    await setDescription(item.id, input.description).catch(() => {});
  }
  return item;
}

// Edita un item existente. `pictures`/`attributes` se reemplazan completos.
export async function updateItem(itemId: string, input: MlPublishInput): Promise<MlItem> {
  const body = buildItemBody(input);
  // No se puede cambiar category_id ni listing_type_id vía PUT; se omiten.
  const { category_id: _c, listing_type_id: _l, buying_mode: _b, ...patch } = body;
  void _c;
  void _l;
  void _b;
  const item = await mlFetch<MlItem>(`/items/${itemId}`, { method: "PUT", body: patch });
  if (input.description !== undefined) {
    await setDescription(itemId, input.description).catch(() => {});
  }
  return item;
}

export function setDescription(itemId: string, plainText: string) {
  return mlFetch(`/items/${itemId}/description`, {
    method: "PUT",
    body: { plain_text: plainText },
  });
}

export function getItem(itemId: string) {
  return mlFetch<MlItem>(`/items/${itemId}`, { query: { include_attributes: "all" } });
}

// status: "paused" | "active" | "closed" (closed es irreversible).
export function setItemStatus(itemId: string, status: "paused" | "active" | "closed") {
  return mlFetch<MlItem>(`/items/${itemId}`, { method: "PUT", body: { status } });
}
