const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|headless|lighthouse|pingdom|uptime/i;

export function isBotAgent(agent: string): boolean {
  return BOT.test(agent);
}

export function deviceFrom(agent: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(agent)) return "tablet";
  if (/mobi|iphone|android/i.test(agent)) return "mobile";
  return "desktop";
}

export function browserFrom(agent: string): string {
  if (/edg\//i.test(agent)) return "Edge";
  if (/samsungbrowser/i.test(agent)) return "Samsung";
  if (/firefox|fxios/i.test(agent)) return "Firefox";
  if (/chrome|crios/i.test(agent)) return "Chrome";
  if (/safari/i.test(agent)) return "Safari";
  return "Otro";
}

/** De dónde llegó, a partir del referrer externo y las etiquetas UTM. */
export function channelFrom(referrerHost: string | null, utmSource: string | null, utmMedium: string | null): string {
  const source = (utmSource ?? "").toLowerCase();
  const host = (referrerHost ?? "").toLowerCase();
  if (/cpc|ppc|paid/.test((utmMedium ?? "").toLowerCase())) return "Publicidad";
  const text = `${source} ${host}`;
  if (/instagram/.test(text)) return "Instagram";
  if (/facebook|fb\.|fbclid/.test(text)) return "Facebook";
  if (/whatsapp|wa\.me/.test(text)) return "WhatsApp";
  if (/google|bing|yahoo|duckduckgo/.test(text)) return "Buscadores";
  if (/zonaprop|argenprop|mercadolibre|properati/.test(text)) return "Portales";
  if (/mail/.test(text)) return "Email";
  if (source || host) return "Otros sitios";
  return "Directo";
}
