/**
 * WORKER always-on de Railway. Dos responsabilidades:
 *
 *  1) Loop periódico: procesa la cola de publicaciones y corre el scraper de
 *     leads respetando la política de horarios (igual que run-worker, pero en un
 *     proceso que queda prendido en vez de un cron one-shot).
 *
 *  2) Login remoto (opción B): expone un servidor HTTP+WS que le permite al
 *     cliente arreglar una sesión vencida desde la web, viendo la pantalla del
 *     navegador del worker por VNC (noVNC) y logueándose a mano. Ver relogin.ts.
 *
 * Todo sobre UN solo puerto público (Railway expone uno): API, visor noVNC y el
 * bridge WebSocket→VNC. Gate por token HMAC firmado por la web.
 */
import "dotenv/config";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { prisma } from "@/lib/prisma/client";
import { runScraperLeads } from "@/lib/scraper/run";
import { processPendingPublishJobs } from "@/lib/publish/portales";
import { verifyReloginToken } from "@/lib/scraper/relogin-token";
import { refreshZonapropCredits } from "@/lib/publish/credits";
import {
  startReloginSession,
  finishReloginSession,
  cancelReloginSession,
  isReloginActive,
  VNC_PORT,
} from "@/lib/scraper/relogin";

const PORT = Number(process.env.PORT ?? 8080);
const TICK_MS = Number(process.env.SCRAPER_TICK_MS ?? 15 * 60_000); // el throttle real lo decide schedule.ts
const NOVNC_DIR = path.resolve(process.cwd(), "node_modules/@novnc/novnc");

// ---------------------------------------------------------------------------
// 1) Loop periódico (cola de publicaciones + scraper de leads)
// ---------------------------------------------------------------------------
// Un solo navegador (Brave+proxy) a la vez sobre el display Xvfb: este mutex lo
// comparten el tick del scraper y el disparo on-demand de la cola.
let browserBusy = false;

/**
 * Procesa la cola de publicaciones YA (disparado por la web al encolar, para no
 * esperar al próximo tick). Si el navegador está ocupado o hay login remoto, no
 * hace nada: los jobs quedan pending y el próximo tick los toma.
 */
async function processQueueNow(): Promise<{ processed: number; deferred: boolean }> {
  if (browserBusy || isReloginActive()) return { processed: 0, deferred: true };
  browserBusy = true;
  try {
    const { processed } = await processPendingPublishJobs();
    if (processed) {
      console.log(`[worker] Publicaciones procesadas (on-demand): ${processed}`);
      // El cupo cambió: refrescamos con el mismo navegador ya "caliente".
      await refreshZonapropCredits().catch((e) => console.warn("[worker] refresh créditos:", e instanceof Error ? e.message : e));
    }
    return { processed, deferred: false };
  } finally {
    browserBusy = false;
  }
}

/** Refresca el cupo de créditos (GET gratis). Respeta el mutex del navegador. */
async function refreshCredits(): Promise<{ ok: boolean; error?: string }> {
  if (browserBusy || isReloginActive()) return { ok: false, error: "worker ocupado" };
  browserBusy = true;
  try {
    await refreshZonapropCredits();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  } finally {
    browserBusy = false;
  }
}

async function tick(): Promise<void> {
  if (browserBusy) return;
  // Mientras hay un login remoto abierto, no lanzamos otro navegador (chocarían
  // en el mismo display Xvfb y competirían por el proxy).
  if (isReloginActive()) {
    console.log("[worker] tick salteado: login remoto en curso.");
    return;
  }
  browserBusy = true;
  try {
    const { processed } = await processPendingPublishJobs();
    if (processed) {
      console.log(`[worker] Publicaciones procesadas: ${processed}`);
      await refreshZonapropCredits().catch(() => {});
    }
    const result = await runScraperLeads(false);
    if (!result.ran) {
      console.log(`[worker] scraper salteado (${result.decision.reason}).`);
    } else {
      for (const p of result.portals) {
        if (p.ok) console.log(`[worker] ${p.portal} OK:`, JSON.stringify(p.result));
        else console.warn(`[worker] ${p.portal} FALLÓ: ${p.error}`);
      }
    }
  } catch (e) {
    console.warn("[worker] Error en tick:", e instanceof Error ? e.message : e);
  } finally {
    browserBusy = false;
  }
}

// ---------------------------------------------------------------------------
// 2) HTTP: API de re-login + visor noVNC estático
// ---------------------------------------------------------------------------
function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  const payload = type === "application/json" ? JSON.stringify(body) : String(body);
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(payload);
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/** Sirve estáticos de noVNC (node_modules/@novnc/novnc), sin path traversal. */
function serveNovnc(res: http.ServerResponse, rel: string) {
  const clean = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(NOVNC_DIR, clean);
  if (!file.startsWith(NOVNC_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return send(res, 404, "not found", "text/plain");
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "max-age=3600" });
  fs.createReadStream(file).pipe(res);
}

/** Página del visor: canvas noVNC que se conecta al bridge WS del worker. */
function viewerHtml(token: string): string {
  const t = JSON.stringify(token);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reconectar portal</title>
<style>html,body{margin:0;height:100%;background:#1a1a1a;overflow:hidden}
#screen{width:100vw;height:100vh}#msg{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ddd;font:14px system-ui}</style>
</head><body>
<div id="msg">Conectando al navegador…</div>
<div id="screen"></div>
<script type="module">
import RFB from '/novnc/core/rfb.js';
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const url = proto + '://' + location.host + '/relogin/ws?token=' + encodeURIComponent(${t});
const rfb = new RFB(document.getElementById('screen'), url, {});
rfb.scaleViewport = true;
rfb.resizeSession = false;
rfb.addEventListener('connect', () => { document.getElementById('msg').style.display='none'; });
rfb.addEventListener('disconnect', (e) => {
  document.getElementById('msg').style.display='flex';
  document.getElementById('msg').textContent = 'Conexión cerrada.';
});
</script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url ?? "/", "http://localhost");
  const p = u.pathname;

  if (p === "/health") return send(res, 200, { ok: true, relogin: isReloginActive(), busy: browserBusy });

  // Disparo on-demand de la cola de publicaciones: la web lo pincha al encolar
  // para no esperar al tick. Responde YA y procesa en background.
  if (p === "/process" && req.method === "POST") {
    const body = await readJson(req);
    if (!verifyReloginToken(String(body.token ?? ""))) return send(res, 401, { message: "token inválido" });
    void processQueueNow().catch((e) => console.warn("[worker] /process:", e instanceof Error ? e.message : e));
    return send(res, 202, { accepted: true });
  }

  // Refresca el cupo de créditos en vivo (GET gratis) y lo cachea en la DB.
  if (p === "/credits/refresh" && req.method === "POST") {
    const body = await readJson(req);
    if (!verifyReloginToken(String(body.token ?? ""))) return send(res, 401, { message: "token inválido" });
    const r = await refreshCredits();
    return send(res, r.ok ? 200 : 503, r);
  }

  if (p.startsWith("/novnc/")) return serveNovnc(res, p.slice("/novnc/".length));

  if (p === "/relogin/view" && req.method === "GET") {
    const token = u.searchParams.get("token");
    if (!verifyReloginToken(token)) return send(res, 401, "token inválido", "text/plain");
    return send(res, 200, viewerHtml(token!), "text/html; charset=utf-8");
  }

  if (p === "/relogin/start" && req.method === "POST") {
    const body = await readJson(req);
    const portal = verifyReloginToken(String(body.token ?? ""));
    if (!portal) return send(res, 401, { message: "token inválido" });
    if (browserBusy) return send(res, 503, { message: "El worker está ocupado; probá de nuevo en unos segundos." });
    try {
      const r = await startReloginSession(portal);
      return send(res, 200, r);
    } catch (e) {
      return send(res, 500, { message: e instanceof Error ? e.message : "error" });
    }
  }

  if (p === "/relogin/finish" && req.method === "POST") {
    const body = await readJson(req);
    if (!verifyReloginToken(String(body.token ?? ""))) return send(res, 401, { message: "token inválido" });
    const r = await finishReloginSession(String(body.sessionId ?? ""));
    return send(res, r.ok ? 200 : 409, r);
  }

  if (p === "/relogin/cancel" && req.method === "POST") {
    const body = await readJson(req);
    if (!verifyReloginToken(String(body.token ?? ""))) return send(res, 401, { message: "token inválido" });
    await cancelReloginSession();
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { message: "not found" });
});

// --- Bridge WebSocket ↔ VNC (x11vnc en 127.0.0.1:VNC_PORT) ---
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const u = new URL(req.url ?? "/", "http://localhost");
  if (u.pathname !== "/relogin/ws" || !verifyReloginToken(u.searchParams.get("token"))) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const tcp = net.connect(VNC_PORT, "127.0.0.1");
    tcp.on("data", (d) => ws.readyState === ws.OPEN && ws.send(d));
    tcp.on("close", () => ws.close());
    tcp.on("error", () => ws.close());
    ws.on("message", (m) => tcp.write(m as Buffer));
    ws.on("close", () => tcp.destroy());
    ws.on("error", () => tcp.destroy());
  });
});

server.listen(PORT, () => {
  console.log(`[worker] servidor escuchando en :${PORT} (relogin + health)`);
});

// Primer tick al arrancar + loop periódico.
void tick();
setInterval(() => void tick(), TICK_MS);
// Cupo inicial para la web (con delay, para no chocar con el primer tick).
setTimeout(() => void refreshCredits(), 20_000);

async function shutdown() {
  await cancelReloginSession().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
