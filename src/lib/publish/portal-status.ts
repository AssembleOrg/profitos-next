/**
 * Estado de conexión de cada portal (para badges "conexión viva").
 *  - MercadoLibre: OAuth (PortalToken) con ping real a /users/me.
 *  - ZonaProp / ArgenProp: sesión de navegador guardada (ScraperSession.valid).
 */
import { prisma } from "@/lib/prisma/client";
import { getConnectionStatus } from "@/lib/mercadolibre/oauth";

export type PortalKey = "mercadolibre" | "zonaprop" | "argenprop";

export type PortalConnStatus = {
  portal: PortalKey;
  label: string;
  kind: "oauth" | "session";
  connected: boolean;
  lastOkAt: string | null;
  nickname: string | null;
  needsAction: boolean;
  actionHint: string | null;
};

const SESSION_PORTALS: { portal: PortalKey; label: string }[] = [
  { portal: "zonaprop", label: "ZonaProp" },
  { portal: "argenprop", label: "ArgenProp" },
];

export async function getPortalStatuses(): Promise<PortalConnStatus[]> {
  const [ml, sessions] = await Promise.all([
    getConnectionStatus(),
    prisma.scraperSession.findMany({ where: { portal: { in: SESSION_PORTALS.map((s) => s.portal) } } }),
  ]);
  const byPortal = new Map(sessions.map((s) => [s.portal, s]));

  const result: PortalConnStatus[] = [
    {
      portal: "mercadolibre",
      label: "MercadoLibre",
      kind: "oauth",
      connected: ml.connected,
      lastOkAt: null,
      nickname: ml.nickname,
      needsAction: !ml.connected,
      actionHint: !ml.configured ? "No configurado" : ml.connected ? null : "Conectar MercadoLibre",
    },
  ];

  for (const sp of SESSION_PORTALS) {
    const s = byPortal.get(sp.portal);
    const connected = Boolean(s?.valid);
    // ZonaProp caída: el worker intenta re-loguearse solo (máx 2 intentos,
    // ~15 min entre uno y otro). Mientras le queden intentos no pedimos acción;
    // agotados, recién ahí aparece el aviso de reconexión manual.
    const autoPending =
      sp.portal === "zonaprop" && !connected && (s?.autoAttempts ?? 99) < 2;
    result.push({
      portal: sp.portal,
      label: sp.label,
      kind: "session",
      connected,
      lastOkAt: s?.lastOkAt?.toISOString() ?? null,
      nickname: null,
      needsAction: !connected && !autoPending,
      actionHint: connected
        ? null
        : autoPending
          ? "Reconectando automáticamente…"
          : "Sesión vencida — re-logueá",
    });
  }

  return result;
}
