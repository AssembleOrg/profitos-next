/** Helpers puros de la web pública (se usan en servidor y en cliente). */

export const WEB_BASE = "/web";

export const CONTACT = {
  phoneDisplay: "11 5385 4029",
  phoneHref: "tel:+541153854029",
  whatsapp: "5491153854029",
  email: "profitospropiedades@gmail.com",
  address: "Av. Mitre 913, Quilmes",
  instagram: "https://www.instagram.com/jprofitospropiedades/",
  license: "Col. 1011",
  cuit: "27-38698130-8",
} as const;

export function whatsappUrl(text: string): string {
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
}

export type Operation = "venta" | "alquiler" | "temporario";

export function normalizeOperation(raw: string | null | undefined): Operation | null {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("temp")) return "temporario";
  if (value.includes("alquiler")) return "alquiler";
  if (value.includes("venta")) return "venta";
  return null;
}

export const OPERATION_LABEL: Record<Operation, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  temporario: "Alquiler temporario",
};

export function formatPrice(price: number | null, currency: string | null): string {
  if (!price) return "Consultar";
  const isUsd = /usd|u\$s|dolar|dólar/i.test(currency ?? "");
  return `${isUsd ? "USD" : "$"} ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(price)}`;
}

/** Para los pines del mapa: "USD 120 k", "$ 1,2 M". */
export function formatPriceShort(price: number | null, currency: string | null): string {
  if (!price) return "Consultar";
  const sign = isUsd(currency) ? "USD" : "$";
  if (price >= 1_000_000) return `${sign} ${(price / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (price >= 1000) return `${sign} ${Math.round(price / 1000).toLocaleString("es-AR")} k`;
  return `${sign} ${Math.round(price)}`;
}

export function isUsd(currency: string | null): boolean {
  return /usd|u\$s|dolar|dólar/i.test(currency ?? "");
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
