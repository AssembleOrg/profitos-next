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
  const cleanPhone = phone.replace(/[\s\-\(\)+]/g, "");
  if (message) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${cleanPhone}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
