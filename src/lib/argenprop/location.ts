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

export type LocationNames = { province?: string | null; city?: string | null; locality?: string | null; zone?: string | null };

/**
 * Resuelve los IDs de ubicación desde los nombres de la propiedad. Provincia,
 * partido y localidad son obligatorios (el form los pide); barrio es opcional.
 * Lanza un error claro si falta resolver un nivel obligatorio.
 */
export async function resolveLocation(input: LocationNames): Promise<ResolvedLocation> {
  const provincia = matchOption(await getProvincias(), input.province);
  if (!provincia) throw new Error(`Ubicación: no encontré la provincia "${input.province}".`);

  const partido = matchOption(await getPartidos(provincia.Value), input.city ?? input.locality);
  if (!partido) throw new Error(`Ubicación: no encontré el partido para "${input.city ?? input.locality}".`);

  const localidad = matchOption(await getLocalidades(partido.Value), input.locality ?? input.city);
  if (!localidad) throw new Error(`Ubicación: no encontré la localidad para "${input.locality ?? input.city}".`);

  const barrio = matchOption(await getBarrios(localidad.Value), input.zone);
  return {
    idProvincia: provincia.Value,
    idPartido: partido.Value,
    idLocalidad: localidad.Value,
    idBarrio: barrio?.Value,
  };
}
