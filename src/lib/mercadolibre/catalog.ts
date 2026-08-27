// Catálogo de MercadoLibre: árbol de categorías de inmuebles, atributos por
// categoría, tipos de publicación y lugares (provincias/ciudades).
// Endpoints públicos (no requieren token).
import { ML } from "./config";
import { mlFetch } from "./client";

// Raíz "Inmuebles" en MLA.
export const REAL_ESTATE_ROOT = "MLA1459";

export interface MlChildCategory {
  id: string;
  name: string;
  total_items_in_this_category?: number;
}

export interface MlCategory {
  id: string;
  name: string;
  children_categories: MlChildCategory[];
  settings?: { listing_allowed?: boolean; [k: string]: unknown };
  path_from_root?: { id: string; name: string }[];
}

export function getCategory(id: string) {
  return mlFetch<MlCategory>(`/categories/${id}`, { auth: false });
}

// --- Atributos dinámicos por categoría ---
export interface MlAttributeValue {
  id: string;
  name: string;
}
export interface MlAttribute {
  id: string;
  name: string;
  value_type: "string" | "number" | "number_unit" | "boolean" | "list" | string;
  tags?: Record<string, boolean>; // { required: true, ... }
  values?: MlAttributeValue[];
  allowed_units?: { id: string; name: string }[];
  default_unit?: string;
  hint?: string;
}

export function getCategoryAttributes(categoryId: string) {
  return mlFetch<MlAttribute[]>(`/categories/${categoryId}/attributes`, { auth: false });
}

// Solo los atributos que ML marca como requeridos para publicar.
export async function getRequiredAttributes(categoryId: string): Promise<MlAttribute[]> {
  const all = await getCategoryAttributes(categoryId);
  return all.filter((a) => a.tags?.required || a.tags?.catalog_required);
}

// --- Tipos de publicación ---
export interface MlListingType {
  id: string;
  name: string;
}
export function getListingTypes() {
  return mlFetch<MlListingType[]>(`/sites/${ML.siteId}/listing_types`, { auth: false });
}

// Tipos de publicación disponibles + costo para una categoría.
export interface MlListingPrice {
  listing_type_id: string;
  listing_type_name: string;
  listing_exposure?: string;
  requires_picture?: boolean;
  currency_id?: string;
  listing_fee_amount?: number;
}
export function getListingPrices(categoryId: string) {
  return mlFetch<MlListingPrice[]>(`/sites/${ML.siteId}/listing_prices`, {
    auth: false,
    query: { category_id: categoryId },
  });
}

// --- Lugares (para location) ---
export interface MlState {
  id: string;
  name: string;
}
export interface MlCity {
  id: string;
  name: string;
}
export async function getStates(): Promise<MlState[]> {
  const country = await mlFetch<{ states: MlState[] }>(`/countries/${countryCode()}`, {
    auth: false,
  });
  return country.states ?? [];
}
export async function getCities(stateId: string): Promise<MlCity[]> {
  const state = await mlFetch<{ cities: MlCity[] }>(`/states/${stateId}`, { auth: false });
  return state.cities ?? [];
}

function countryCode(): string {
  // MLA -> AR, MLM -> MX, etc.
  const map: Record<string, string> = { MLA: "AR", MLM: "MX", MLB: "BR", MLU: "UY", MLC: "CL" };
  return map[ML.siteId] ?? "AR";
}
