/**
 * POC: ¿se puede crear una ficha en ArgenProp Gestión con HTTP PLANO (sin
 * navegador en runtime), usando las cookies de una sesión logueada?
 *
 * Toma las cookies del perfil del discovery (donde te logueaste), reproduce el
 * POST de crear ficha (datosgeneralespost) con fetch de Node, y reporta si
 * crea la ficha (302 → /propiedades/{id}). La ficha queda como borrador → borrala.
 *
 *   pnpm exec tsx scripts/scraper/argenprop-publish-http-test.ts
 */
import "dotenv/config";
import { chromium } from "playwright";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";

const DIR = "C:/Users/Aaron/AppData/Local/Temp/argenprop-publish-discovery";
const JSONL = `${DIR}/publish-network.jsonl`;
const PROFILE = `${DIR}/userdata`;
const CREATE_URL = "https://gestion.argenprop.com/wizardproperty/datosgeneralespost";

/** Toma el body del POST de crear capturado (#67) y le cambia el título. */
function capturedBody(): string {
  const lines = fs.readFileSync(JSONL, "utf8").split("\n").filter(Boolean);
  for (const l of lines) {
    const o = JSON.parse(l);
    if (o.phase === "req" && String(o.url).includes("/wizardproperty/datosgeneralespost")) {
      // IdAviso vacío = crea una ficha nueva (no toca la del test).
      return String(o.postData)
        .replace(/Titulo=[^&]*/, "Titulo=PRUEBA%20HTTP%20BORRAR")
        .replace(/IdAviso=[^&]*/, "IdAviso=");
    }
  }
  throw new Error("No encontré el POST datosgeneralespost en la captura.");
}

async function cookiesFromProfile(): Promise<string> {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  }).catch(() => chromium.launchPersistentContext(PROFILE, { headless: false }));
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://gestion.argenprop.com/", { waitUntil: "domcontentloaded" }).catch(() => {});
  const rl = readline.createInterface({ input, output });
  await rl.question("\nConfirmá que estás LOGUEADO en ArgenProp Gestión y apretá Enter... ");
  rl.close();
  const cookies = await ctx.cookies();
  await ctx.close();
  return cookies
    .filter((c) => (c.domain ?? "").includes("argenprop"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function main() {
  const body = capturedBody();
  const cookie = await cookiesFromProfile();
  console.log(`\n→ Cookies argenprop: ${cookie ? "sí" : "NO"}. POST datosgeneralespost (HTTP plano)...`);

  const res = await fetch(CREATE_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      origin: "https://gestion.argenprop.com",
      referer: "https://gestion.argenprop.com/wizardproperty",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    },
    body,
  });

  const location = res.headers.get("location");
  const text = await res.text().catch(() => "");
  console.log(`\n← status: ${res.status}  location: ${location ?? "—"}`);
  if ((res.status === 302 || res.status === 200) && location && /propiedad/i.test(location)) {
    const id = (location.match(/(\d{5,})/) ?? [])[1];
    console.log(`🎉 Ficha creada por HTTP PLANO. IdAviso=${id ?? "?"} → ${location}`);
    console.log(`   Sin navegador en runtime. Borrá la ficha desde el CRM.`);
  } else if (res.status === 302 && location && /login|auth/i.test(location)) {
    console.log("⚠ Redirigió al login → la sesión/cookies no autenticaron.");
  } else {
    console.log(`❓ Respuesta inesperada. Body: ${text.slice(0, 300)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exit(1); });
