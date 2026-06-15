/**
 * Genera un link de WhatsApp con mensaje pre-armado para compartir una propiedad.
 */
export function buildPropertyWhatsAppLink(property: {
  address: string;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
  type?: string | null;
  publicUrl?: string | null;
}, phone?: string | null): string {
  const lines: string[] = [];
  lines.push("Hola! Te comparto esta propiedad:");
  lines.push("");
  lines.push(`📍 ${property.address}`);

  if (property.operationPrice) {
    const price = property.operationPrice.toLocaleString("es-AR");
    const currency = property.operationCurrency ?? "USD";
    lines.push(`💰 ${currency} ${price}`);
  }

  if (property.type || property.operationType) {
    const parts: string[] = [];
    if (property.type) parts.push(capitalize(property.type));
    if (property.operationType) parts.push(`en ${property.operationType}`);
    lines.push(`🏠 ${parts.join(" ")}`);
  }

  if (property.publicUrl) {
    lines.push("");
    lines.push(`🔗 ${property.publicUrl}`);
  }

  const text = encodeURIComponent(lines.join("\n"));
  const cleanPhone = phone?.replace(/[\s\-\(\)+]/g, "") ?? "";

  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

/**
 * Genera un link de WhatsApp para contactar directamente a alguien.
 */
export function buildContactWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = toWhatsAppNumber(phone);
  if (message) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${cleanPhone}`;
}

/**
 * Normaliza un teléfono a formato internacional argentino para wa.me.
 * - Limpia símbolos (espacios, guiones, paréntesis, +).
 * - Respeta números que ya traen código de país de Argentina (54), asegurando el 9 de celular.
 * - Saca el 0 de trunk nacional (ej. 011, 0381) y el 15 de celular local.
 * - Antepone "549" (celular Argentina) cuando falta el código de país.
 *
 * Devuelve solo dígitos, sin el +. Cadena vacía si no hay número válido.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (!d) return "";

  // Ya viene con código de país de Argentina.
  if (d.startsWith("54")) {
    let rest = d.slice(2);
    if (rest.startsWith("9")) rest = rest.slice(1);
    // quitar 15 de celular local que pudiera haber quedado tras el código de área
    rest = rest.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
    return "549" + rest;
  }

  // Sacar 0 de trunk nacional (ej. 011 → 11, 0381 → 381).
  if (d.startsWith("0")) d = d.slice(1);
  // Sacar el 15 de celular local: aparece luego del código de área (2-4 dígitos).
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");

  return "549" + d;
}

/**
 * Devuelve el href de wa.me para un teléfono, o null si no hay número válido.
 * Pensado para renderizar links clickeables en la UI.
 */
export function buildWhatsAppHref(phone: string | null | undefined): string | null {
  const cleanPhone = toWhatsAppNumber(phone);
  return cleanPhone ? `https://wa.me/${cleanPhone}` : null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
