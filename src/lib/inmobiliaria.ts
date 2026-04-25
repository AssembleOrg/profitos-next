/**
 * Datos institucionales de la inmobiliaria.
 * Se imprimen en los comprobantes (PDF) de pagos de alquileres.
 * No es información fiscal — para AFIP / facturación se requiere otro flujo.
 *
 * Editá estos strings con los datos reales cuando estén disponibles.
 */
export const INMOBILIARIA = {
  name: "Profitos",
  tagline: "Juliana Profitos · Inmobiliaria",
  address: "—",
  phone: "—",
  email: "—",
  cuit: "" as string, // opcional
  /** "01" = punto de venta inicial. Mantener 2 dígitos. */
  receiptPointOfSale: "01",
} as const;

export function formatReceiptNumber(seq: number): string {
  return `${INMOBILIARIA.receiptPointOfSale}-${seq.toString().padStart(8, "0")}`;
}
