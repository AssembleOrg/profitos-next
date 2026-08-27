import "dotenv/config";
import { prisma } from "@/lib/prisma/client";

async function main() {
  for (const portal of ["zonaprop", "argenprop"]) {
    const count = await prisma.scrapedLead.count({ where: { portal } });
    const sample = await prisma.scrapedLead.findFirst({
      where: { portal, contactEmail: { not: null } },
      orderBy: { messageAt: "desc" },
    });
    console.log(`\n===== ${portal.toUpperCase()} (${count} leads) =====`);
    if (sample) {
      console.log({
        section: sample.section,
        externalId: sample.externalId,
        contactName: sample.contactName,
        contactEmail: sample.contactEmail,
        contactPhone: sample.contactPhone,
        messageText: sample.messageText?.slice(0, 80),
        messageAt: sample.messageAt,
        propertyTitle: sample.propertyTitle,
        propertyAddress: sample.propertyAddress,
        propertyUrl: sample.propertyUrl,
        price: sample.price,
        hasPolygon: sample.mapPolygon != null,
      });
    }
  }
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
