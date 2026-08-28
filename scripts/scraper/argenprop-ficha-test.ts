/**
 * Prueba del motor de ArgenProp: crea una ficha (borrador) con HTTP plano desde
 * la sesión guardada en la DB. Requiere haber corrido antes:
 *   pnpm exec tsx scripts/scraper/login.ts argenprop-gestion
 *
 * Correr:
 *   pnpm exec tsx scripts/scraper/argenprop-ficha-test.ts
 *
 * La ficha queda como borrador (no publicada) → verificás y borrás del CRM.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma/client";
import { createFicha, setContacto } from "@/lib/argenprop/publish";

async function main() {
  console.log("→ Creando ficha (datosgeneralespost) por HTTP plano...");
  const idAviso = await createFicha({
    tipoPropiedad: "CASA",
    tipoUnidad: "CASA",
    tipoOperacion: "VENTA",
    moneda: "USD",
    precio: "100.000",
    titulo: "PRUEBA MOTOR — BORRAR",
    descripcion: "Ficha de prueba de la integración. No publicar. Borrar.",
    location: {
      idProvincia: "PROVINCIA_1",
      idPartido: "PARTIDO_15",
      idLocalidad: "LOCALIDAD_307",
      idBarrio: "BARRIO_10924",
      nombreCalle: "Av Fangio 14 y 15",
      numeroCalle: "85",
    },
    caracteristicas: { ambientes: 2, superficieCubierta: 80 },
  });
  console.log(`  ✔ Ficha creada: IdAviso=${idAviso}`);

  console.log("→ Guardando datos de contacto (datoscontactopost)...");
  await setContacto(idAviso, {
    nombreInmobiliaria: "Juliana Profitos Propiedades",
    disponibilidad: "Lunes a Viernes de 10 a 18",
    telefono1: "1153854029",
    whatsapp: "1153854029",
    email: "profitospropiedades@gmail.com",
  });
  console.log(`  ✔ Contacto guardado.`);

  console.log(`\n🎉 Motor OK. Ficha ${idAviso} creada por HTTP plano (borrador, no publicada).`);
  console.log(`   Verificala/borrala en: https://gestion.argenprop.com/avisos/editar/${idAviso}/datosinmueble`);

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("✖ Falla:", e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
