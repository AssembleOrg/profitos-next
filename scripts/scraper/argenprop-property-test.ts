/**
 * Crea una ficha en ArgenProp desde una PROPIEDAD REAL de la DB (mapeo completo:
 * tipo, operación, precio, características, ubicación resuelta). Borrador → borrar.
 *
 * Requiere sesión: pnpm exec tsx scripts/scraper/login.ts argenprop-gestion
 *
 *   pnpm exec tsx scripts/scraper/argenprop-property-test.ts [propertyId]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma/client";
import { propertyToFicha } from "@/lib/argenprop/mapping";
import { createFicha, setContacto } from "@/lib/argenprop/publish";

async function pickProperty(id?: string) {
  if (id) return prisma.property.findUnique({ where: { id } });
  // Nota: hoy todas están soft-deleted (se sacó Tokko); ignoramos deletedAt para
  // probar el mapeo con datos reales.
  return prisma.property.findFirst({
    where: {
      city: { not: null },
      operationPrice: { not: null },
      address: { not: "" },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function main() {
  const property = await pickProperty(process.argv[2]);
  if (!property) {
    console.error("✖ No encontré una propiedad con provincia/ciudad/precio. Pasá un id: ...property-test.ts <id>");
    process.exit(1);
  }
  console.log(`→ Propiedad: ${property.id}`);
  console.log(`  ${property.type} · ${property.operationType} · ${property.operationCurrency} ${property.operationPrice}`);
  console.log(`  ${property.address} — ${property.city}, ${property.province} (${property.zone ?? "s/zona"})`);

  console.log("\n→ Mapeando y resolviendo ubicación...");
  const ficha = await propertyToFicha(property);
  console.log(`  tipo=${ficha.tipoPropiedad} op=${ficha.tipoOperacion} ${ficha.moneda} ${ficha.precio}`);
  console.log(`  ubicación: ${ficha.location.idProvincia}/${ficha.location.idPartido}/${ficha.location.idLocalidad}/${ficha.location.idBarrio ?? "s/barrio"}`);
  console.log(`  calle="${ficha.location.nombreCalle}" nro="${ficha.location.numeroCalle}"`);

  console.log("\n→ Creando ficha...");
  const idAviso = await createFicha(ficha);
  await setContacto(idAviso, {
    nombreInmobiliaria: "Juliana Profitos Propiedades",
    disponibilidad: "Lunes a Viernes de 10 a 18",
    telefono1: "1153854029",
    whatsapp: "1153854029",
    email: "profitospropiedades@gmail.com",
  });

  console.log(`\n🎉 Ficha creada desde propiedad real. IdAviso=${idAviso} (borrador, no publicada).`);
  console.log(`   https://gestion.argenprop.com/avisos/editar/${idAviso}/datosinmueble`);
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("✖ Falla:", e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
