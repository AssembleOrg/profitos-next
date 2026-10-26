// Configuración de la integración con MercadoLibre.
// La app se crea en https://developers.mercadolibre.com.ar (DevCenter).

export const ML = {
  siteId: process.env.ML_SITE_ID ?? "MLA", // MLA = Argentina
  clientId: process.env.ML_CLIENT_ID ?? "",
  clientSecret: process.env.ML_CLIENT_SECRET ?? "",
  // Debe coincidir EXACTO con la Redirect URI configurada en la app de ML.
  redirectUri:
    process.env.ML_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/integrations/mercadolibre/oauth/callback`,
  apiBase: "https://api.mercadolibre.com",
  // El host de auth depende del país: .com.ar para MLA.
  authBase: process.env.ML_AUTH_BASE ?? "https://auth.mercadolibre.com.ar",
} as const;

export const ML_PORTAL = "mercadolibre" as const;

/**
 * Contacto de la inmobiliaria en los avisos de ML (los mismos datos que usa
 * Tokko). Se manda siempre: los únicos avisos de la cuenta que salían sin
 * teléfono eran los nuestros, y ML los cerraba a los 3 minutos (oct 2026).
 * Lo que se cargue en el wizard pisa estos valores campo por campo.
 */
export const ML_DEFAULT_SELLER_CONTACT = {
  contact: "Juliana Profitos Propiedades",
  country_code: "+54",
  area_code: "11",
  phone: "53854029",
  country_code2: "549",
  area_code2: "11",
  phone2: "1153854029",
  email: "profitospropiedades@gmail.com",
} as const;

export function assertMlConfigured() {
  if (!ML.clientId || !ML.clientSecret) {
    throw new Error(
      "MercadoLibre no está configurado: faltan ML_CLIENT_ID / ML_CLIENT_SECRET en el entorno."
    );
  }
}
