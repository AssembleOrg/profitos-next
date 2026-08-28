/**
 * Prueba LOCAL del motor de publicación (browser-publish). Crea un BORRADOR en
 * ZonaProp desde la sesión guardada. NO publica (queda DRAFT) → verificás y borrás.
 *
 * Local corre por tu IP de casa (sin proxy). En producción (Railway) hay que
 * setear ZONAPROP_PROXY (IP residencial). Requiere sesión de ZonaProp válida
 * (scripts/scraper/login.ts) — si dice "User not Logged", re-logueá.
 *
 * Correr headed:
 *   SCRAPER_HEADLESS=false pnpm exec tsx scripts/scraper/zonaprop-publish-local-test.ts
 */
import "dotenv/config";
import { publishDraftViaBrowser } from "@/lib/zonaprop/browser-publish";

async function main() {
  console.log("→ Creando borrador de prueba vía navegador...");
  const id = await publishDraftViaBrowser({
    // Valores conocidos-válidos de la captura: Casa=1, subtipo=42, venta=1.
    operation: { operationType: "1", realEstateTypeId: "1", realEstateSubTypeId: "42" },
    description: {
      title: "PRUEBA API — BORRAR",
      description: "Borrador de prueba de la integración de publicación. No publicar. Borrar.",
    },
  });
  console.log(`\n🎉 Borrador creado: postingId=${id} (status DRAFT, no publicado)`);
  console.log(`   Borralo en: https://www.zonaprop.com.ar/panel/publicador-profesionales/edition?postingId=${id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✖ Falla:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
