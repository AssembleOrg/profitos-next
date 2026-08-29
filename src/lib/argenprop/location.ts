/**
 * Resolución de ubicación en ArgenProp Gestión.
 *
 * ArgenProp usa una jerarquía Provincia → Partido → Localidad → Barrio, cada
 * nivel un dropdown de {Text, Value} (ej: "Buenos Aires" → "PROVINCIA_1"). La
 * propiedad tiene los nombres; acá los resolvemos a los IDs matcheando por
 * nombre (normalizado: sin acentos, sin "Partido de", case-insensitive).
 */
import { gestionGetJson } from "./gestion";

export type Option = { Text: string; Value: string };

export function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/^partido de /, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Matchea un nombre contra las opciones (igualdad normalizada, luego inclusión). */
export function matchOption(options: Option[], name: string | null | undefined): Option | null {
  if (!name) return null;
  const n = normalize(name);
  if (!n) return null;
  const valid = options.filter((o) => o.Value); // descarta "Seleccionar" (Value "")
  return (
    valid.find((o) => normalize(o.Text) === n) ??
    valid.find((o) => normalize(o.Text).includes(n) || n.includes(normalize(o.Text))) ??
    null
  );
}

export const getProvincias = () => gestionGetJson<Option[]>("/Api/Wizard/Provincias/PAIS_1");
export const getPartidos = (provincia: string) => gestionGetJson<Option[]>(`/Api/Wizard/Partidos/${provincia}`);
export const getLocalidades = (partido: string) => gestionGetJson<Option[]>(`/Api/Wizard/Localidades/${partido}`);
export const getBarrios = (localidad: string) => gestionGetJson<Option[]>(`/Api/Wizard/Barrios/${localidad}`);

export type ResolvedLocation = {
  idProvincia: string;
  idPartido: string;
  idLocalidad: string;
  idBarrio?: string;
};

export type LocationNames = {
  province?: string | null;
  city?: string | null;
  locality?: string | null;
  zone?: string | null;
  /** Jerarquía completa del scraper: "Argentina | Región | Partido | Barrio | Localidad". */
  locationFull?: string | null;
};

function firstNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) if (v && v.trim()) return v.trim();
  return null;
}

/**
 * Deriva el nombre de provincia (como lo llama ArgenProp) desde la "región" del
 * scraper. El scraper no guarda provincia, pero sí la región (ej "G.B.A. Zona
 * Sur", "Capital Federal", "Costa Atlántica"), que mapea a una provincia real.
 */
export function deriveProvince(region: string | null | undefined): string | null {
  const r = normalize(region);
  if (!r) return null;
  if (r.includes("capital federal") || r.includes("caba") || r.includes("ciudad autonoma")) return "Capital Federal";
  if (
    r.includes("g.b.a") ||
    r.includes("gba") ||
    r.includes("gran buenos aires") ||
    r.includes("buenos aires") ||
    r.includes("costa atlantica")
  )
    return "Buenos Aires";
  // Otras provincias: la región suele ser la provincia misma (Córdoba, Santa Fe…).
  return (region ?? "").trim() || null;
}

type ParsedLocation = { province: string | null; partido: string | null; localidad: string | null; barrio: string | null };

/** Parsea "Argentina | Región | Partido | [Barrio] | [Localidad]" del scraper. */
export function parseLocationFull(locationFull: string | null | undefined): ParsedLocation {
  const segs = (locationFull ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  // segs[0] = país. Ignoramos.
  const region = segs[1] ?? null;
  const partido = segs[2] ?? null;
  let barrio: string | null = null;
  let localidad: string | null = null;
  const rest = segs.slice(3);
  if (rest.length >= 2) {
    barrio = rest[0];
    localidad = rest[rest.length - 1];
  } else if (rest.length === 1) {
    localidad = rest[0];
  }
  return { province: deriveProvince(region), partido, localidad, barrio };
}

/**
 * Resuelve los IDs de ubicación desde los nombres de la propiedad. Provincia,
 * partido y localidad son obligatorios (el form los pide); barrio es opcional.
 * Usa `locationFull` (jerarquía del scraper) como fuente principal cuando los
 * campos explícitos vienen vacíos — el scraper no guarda `province` pero sí la
 * jerarquía completa. Lanza un error claro si falta un nivel obligatorio.
 */
export async function resolveLocation(input: LocationNames): Promise<ResolvedLocation> {
  const parsed = parseLocationFull(input.locationFull);
  const provinceName = firstNonEmpty(input.province, parsed.province);
  const partidoName = firstNonEmpty(input.city, parsed.partido, input.locality);
  const localidadName = firstNonEmpty(input.locality, parsed.localidad, input.city, parsed.partido);
  const barrioName = firstNonEmpty(parsed.barrio, input.zone);

  const provincia = matchOption(await getProvincias(), provinceName);
  if (!provincia) throw new Error(`Ubicación: no encontré la provincia "${provinceName ?? "?"}".`);

  const partido = matchOption(await getPartidos(provincia.Value), partidoName);
  if (!partido) throw new Error(`Ubicación: no encontré el partido para "${partidoName ?? "?"}".`);

  const localidad = matchOption(await getLocalidades(partido.Value), localidadName);
  if (!localidad) throw new Error(`Ubicación: no encontré la localidad para "${localidadName ?? "?"}".`);

  const barrio = matchOption(await getBarrios(localidad.Value), barrioName);
  return {
    idProvincia: provincia.Value,
    idPartido: partido.Value,
    idLocalidad: localidad.Value,
    idBarrio: barrio?.Value,
  };
}
