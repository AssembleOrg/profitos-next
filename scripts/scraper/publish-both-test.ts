/**
 * Prueba de publicación en AMBOS portales — crea un BORRADOR en cada uno.
 * NO publica (quedan draft) → verificás y borrás.
 *
 *   SCRAPER_CHROME_PATH=/usr/bin/brave-browser SCRAPER_HEADLESS=false \
 *     pnpm exec tsx scripts/scraper/publish-both-test.ts
 */
import "dotenv/config";
import { publishDraftViaBrowser } from "@/lib/zonaprop/browser-publish";
import { getProvincias, getPartidos, getLocalidades, getBarrios, matchOption } from "@/lib/argenprop/location";
import { createFicha } from "@/lib/argenprop/publish";

const TITLE = "PRUEBA API BORRADOR NO PUBLICAR BORRAR";
const DESC =
  "Este es un borrador de prueba generado por la integracion automatica de publicacion. " +
  "No corresponde a una propiedad real y no debe publicarse bajo ninguna circunstancia. " +
  "Por favor ignorar y eliminar este borrador. Texto de relleno para cumplir el minimo de longitud.";

async function zonaprop(): Promise<string> {
  return publishDraftViaBrowser({
    operation: { operationType: "1", realEstateTypeId: "1", realEstateSubTypeId: "42" },
    description: { title: TITLE, description: DESC },
  });
}

async function argenprop(): Promise<{ id: string; where: string }> {
  // Códigos REALES tomados del wizard (garantiza IDs válidos para el borrador).
  // Se descartan los placeholders ("Seleccione...", Value vacío).
  const real = (opts: { Text: string; Value: string }[]) => opts.filter((o) => o.Value?.trim());
  const provs = real(await getProvincias());
  const prov = matchOption(provs, "Capital Federal") ?? matchOption(provs, "Buenos Aires") ?? provs[0];
  const partidos = real(await getPartidos(prov.Value));
  const partido = partidos[0];
  const locs = real(await getLocalidades(partido.Value));
  const loc = locs[0];
  // CABA (y varias localidades) EXIGEN barrio; sin él el wizard re-renderiza (200, sin redirect).
  const barrios = real(await getBarrios(loc.Value));
  const barrio = barrios[0];
  console.log(`  · ubicación: ${prov.Text} / ${partido.Text} / ${loc.Text}${barrio ? " / " + barrio.Text : ""}`);

  const id = await createFicha({
    tipoPropiedad: "DEPARTAMENTO",
    tipoUnidad: "DEPARTAMENTO",
    tipoOperacion: "VENTA",
    moneda: "USD",
    precio: "100000",
    titulo: TITLE,
    descripcion: DESC,
    location: {
      idProvincia: prov.Value,
      idPartido: partido.Value,
      idLocalidad: loc.Value,
      idBarrio: barrio?.Value,
      nombreCalle: "Calle de Prueba",
      numeroCalle: "123",
    },
    caracteristicas: { ambientes: 2, dormitorios: 1, banos: 1, superficieCubierta: 50 },
  });
  return { id, where: `${prov.Text} / ${partido.Text} / ${loc.Text}` };
}

/** Crea un borrador de prueba en cada portal. Reusable (lo llama el worker). */
export async function publishBothDrafts(): Promise<{
  zonaprop: string | null;
  argenprop: { id: string; where: string } | null;
}> {
  console.log("→ ZonaProp: creando borrador...");
  let zp: string | null = null;
  try {
    zp = await zonaprop();
    console.log(`  ✔ ZonaProp draft postingId=${zp}`);
  } catch (e) {
    console.log(`  ✖ ZonaProp falló: ${e instanceof Error ? e.message : e}`);
  }

  console.log("→ ArgenProp: creando borrador (HTTP gestión)...");
  let ap: { id: string; where: string } | null = null;
  try {
    ap = await argenprop();
    console.log(`  ✔ ArgenProp ficha IdAviso=${ap.id} (${ap.where})`);
  } catch (e) {
    console.log(`  ✖ ArgenProp falló: ${e instanceof Error ? e.message : e}`);
  }

  console.log("\n─── RESULTADO ───");
  if (zp) console.log(`ZonaProp:  DRAFT ${zp} → https://www.zonaprop.com.ar/panel/publicador-profesionales/edition?postingId=${zp}`);
  if (ap) console.log(`ArgenProp: DRAFT ${ap.id} → https://gestion.argenprop.com/avisos/editar/${ap.id}/datosinmueble`);
  return { zonaprop: zp, argenprop: ap };
}

// Ejecutado directo desde la terminal (no importado).
if (process.argv[1] && /publish-both-test\.ts$/.test(process.argv[1])) {
  publishBothDrafts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("✖ Falla:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
