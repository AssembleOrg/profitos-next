/**
 * Datos institucionales de la inmobiliaria.
 * Se imprimen en los comprobantes (PDF) de pagos de alquileres.
 * No es información fiscal — para AFIP / facturación se requiere otro flujo.
 *
 * Editá estos strings con los datos reales cuando estén disponibles.
 */
export const INMOBILIARIA = {
  name: "Profitos",
  tagline: "Juliana Profitos · Propiedades",
  // Datos del talonario vigente (impreso 24-06-2026).
  address: "Mitre 913 - Quilmes" as string,
  phone: "11 5385 4029" as string,
  email: "profitospropiedades@gmail.com" as string,
  web: "www.jprofitospropiedades.com.ar" as string,
  cuit: "27-38698130-8" as string,
  /** "01" = punto de venta inicial. Mantener 2 dígitos. */
  receiptPointOfSale: "01",
} as const;

export function formatReceiptNumber(seq: number): string {
  return `${INMOBILIARIA.receiptPointOfSale}-${seq.toString().padStart(8, "0")}`;
}
