import type { NextRequest } from "next/server";
import { withHandler, AppError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/api/auth";
import {
  REAL_ESTATE_ROOT,
  getCategory,
  getCategoryAttributes,
  getListingPrices,
  getStates,
  getCities,
} from "@/lib/mercadolibre/catalog";

// Proxy dinámico al catálogo de ML. ?resource=category|attributes|listing_prices|states|cities
// Alimenta los pasos del wizard sin hardcodear nada.
export const GET = withHandler(async (request: NextRequest) => {
  await getAuthContext();
  const sp = request.nextUrl.searchParams;
  const resource = sp.get("resource") ?? "category";
  const id = sp.get("id") ?? undefined;
  const path = request.nextUrl.pathname;

  switch (resource) {
    case "category": {
      const data = await getCategory(id ?? REAL_ESTATE_ROOT);
      return ok(data, "Categoría", path);
    }
    case "attributes": {
      if (!id) throw new AppError(400, "Falta 'id' (categoría)");
      const data = await getCategoryAttributes(id);
      return ok(data, "Atributos", path);
    }
    case "listing_prices": {
      if (!id) throw new AppError(400, "Falta 'id' (categoría)");
      const priceRaw = sp.get("price");
      const price = priceRaw ? Number(priceRaw) : undefined;
      const data = await getListingPrices(id, Number.isFinite(price) ? price : undefined);
      return ok(data, "Tipos de publicación", path);
    }
    case "states": {
      const data = await getStates();
      return ok(data, "Provincias", path);
    }
    case "cities": {
      if (!id) throw new AppError(400, "Falta 'id' (provincia)");
      const data = await getCities(id);
      return ok(data, "Ciudades", path);
    }
    default:
      throw new AppError(400, `resource inválido: ${resource}`);
  }
});
