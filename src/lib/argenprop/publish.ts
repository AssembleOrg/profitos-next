/**
 * Publicación de avisos en ArgenProp Gestión (wizard MVC por form-posts).
 *
 * Flujo (validado con HTTP plano):
 *   1) POST /wizardproperty/datosgeneralespost  → crea la ficha, 302 a
 *      /avisos/editar/{IdAviso}/datoscontacto  (de ahí sale el IdAviso).
 *   2) POST /wizardproperty/datoscontactopost   → datos de contacto.
 *   3) Publicar = asignar puntos (ver points.ts).
 * Las fotos se suben antes a S3 (photos.ts) y viajan en el paso 1 como
 * `{tipo}.MultimediaModel.Fotos[i].Url = key` (relevado de site.min.js).
 *
 * Sin el paso 3 la ficha queda oculta y la URL pública da 410.
 */
import { gestionPostForm, markGestionOk } from "./gestion";

const num = (v: number | string | undefined | null): string =>
  v === undefined || v === null ? "" : String(v);

// ─── Paso 1: datos del inmueble (crea la ficha) ──────────────────────────────

export type FichaLocation = {
  idPais?: string; // default PAIS_1
  idProvincia: string; // PROVINCIA_x
  idPartido: string; // PARTIDO_x
  idLocalidad: string; // LOCALIDAD_x
  idBarrio?: string; // BARRIO_x
  nombreCalle: string;
  numeroCalle?: string;
  piso?: string;
  departamento?: string;
  latitud?: string;
  longitud?: string;
};

export type FichaCaracteristicas = {
  ambientes?: number;
  dormitorios?: number;
  banos?: number;
  toilettes?: number;
  cocheras?: number;
  plantas?: number;
  superficieCubierta?: number;
  superficieDescubierta?: number;
  superficieTerreno?: number;
  longitudFrente?: number;
  longitudFondo?: number;
  estado?: string; // EstadoPropiedad
  orientacion?: string;
  antiguedad?: number;
};

export type FichaInput = {
  tipoPropiedad: string; // CASA, DEPARTAMENTO, PH, TERRENO, LOCAL...
  tipoUnidad: string; // CASA...
  tipoOperacion: string; // VENTA, ALQUILER
  moneda: string; // USD, ARS
  precio: string; // "100.000"
  titulo: string;
  descripcion: string;
  location: FichaLocation;
  caracteristicas?: FichaCaracteristicas;
  /** Keys de fotos ya subidas (ver photos.ts). */
  photos?: string[];
  /** Prefijo del modelo por tipo (Casa., Departamento.). Default: capitaliza. */
  typePrefix?: string;
};

function capitalize(s: string): string {
  const low = s.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

/** Arma los pares del form de "Datos del inmueble" (orden calcado de la captura). */
export function datosGeneralesPairs(input: FichaInput, idAviso = ""): [string, string][] {
  const p = input.typePrefix ?? capitalize(input.tipoPropiedad);
  const c = input.caracteristicas ?? {};
  const loc = input.location;
  // Fotos: un `{tipo}.MultimediaModel.Fotos[i].Url` por key subida (en el
  // orden de la propiedad: la primera es la portada). El input `file` del form
  // va vacío (el navegador sube directo a S3).
  const photoPrefix = p.toLowerCase();
  const fileFields: [string, string][] = [
    ["file", ""],
    ...(input.photos ?? []).map((k, i): [string, string] => [`${photoPrefix}.MultimediaModel.Fotos[${i}].Url`, k]),
  ];
  return [
    ["IdAviso", idAviso],
    ["StepId", "DatosInmueble"],
    ["IsEmprendimiento", "False"],
    ["FromOrigin", ""],
    ["IdEmprendimiento", ""],
    ["EstadoPublicacion", ""],
    ["IsVisible", "False"],
    ["UrlReedirect", "/Propiedades"],
    ["IsSaveExit", "false"],
    ["TipoPropiedad", input.tipoPropiedad],
    ["TipoUnidad", input.tipoUnidad],
    ["TipoOperacion", input.tipoOperacion],
    ["EstadoAviso", "VIGENTE"],
    ["TipoComision", "1"],
    ["moneda", input.moneda],
    ["Precio", input.precio],
    ["Expensas", ""],
    ["TipoExpensas", ""],
    ["Direccion.IdPais", loc.idPais ?? "PAIS_1"],
    ["Direccion.IdProvincia", loc.idProvincia],
    ["Direccion.IdPartido", loc.idPartido],
    ["Direccion.IdLocalidad", loc.idLocalidad],
    ["Direccion.IdBarrio", loc.idBarrio ?? ""],
    ["Direccion.IdCalle", ""],
    ["Direccion.NombreCalle", loc.nombreCalle],
    ["Direccion.NumeroCalle", loc.numeroCalle ?? ""],
    ["Direccion.Piso", loc.piso ?? ""],
    ["Direccion.Departamento", loc.departamento ?? ""],
    ["Direccion.Latitud", loc.latitud ?? ""],
    ["Direccion.Longitud", loc.longitud ?? ""],
    ["Titulo", input.titulo],
    ["Descripcion", input.descripcion],
    ["IncluirTextoAutomatico", "False"],
    [`${p}.CantidadAmbientes`, num(c.ambientes)],
    [`${p}.CantidadDormitorios`, num(c.dormitorios)],
    [`${p}.CantidadBanos`, num(c.banos)],
    [`${p}.CantidadToilettes`, num(c.toilettes)],
    [`${p}.CantidadCocheras`, num(c.cocheras)],
    [`${p}.CantidadPlantas`, num(c.plantas)],
    [`${p}.SuperficieCubierta`, num(c.superficieCubierta)],
    [`${p}.SuperficieDescubierta`, num(c.superficieDescubierta)],
    [`${p}.SuperficieTerreno`, num(c.superficieTerreno)],
    [`${p}.LongitudFrente`, num(c.longitudFrente)],
    [`${p}.LongitudFondo`, num(c.longitudFondo)],
    [`${p}.EstadoPropiedad`, c.estado ?? ""],
    [`${p}.Orientacion`, c.orientacion ?? ""],
    [`${p}.Antiguedad`, num(c.antiguedad)],
    ...fileFields,
  ];
}

/**
 * Crea la ficha (POST datosgeneralespost) y devuelve el IdAviso, que sale del
 * redirect 302 a /avisos/editar/{id}/datoscontacto.
 */
export async function createFicha(input: FichaInput): Promise<string> {
  const res = await gestionPostForm("/wizardproperty/datosgeneralespost", datosGeneralesPairs(input));
  const id = (res.location?.match(/editar\/(\d+)/) ?? [])[1];
  if (!id) {
    throw new Error(`No se pudo crear la ficha (status ${res.status}, location ${res.location ?? "—"}).`);
  }
  await markGestionOk();
  return id;
}

/**
 * Re-guarda los datos (y fotos) de una ficha que ya existe: mismo form con el
 * IdAviso cargado. Se usa para completar una ficha creada antes sin fotos.
 */
export async function updateFicha(idAviso: string, input: FichaInput): Promise<void> {
  const res = await gestionPostForm("/wizardproperty/datosgeneralespost", datosGeneralesPairs(input, idAviso));
  if (!res.location?.includes(`/${idAviso}/`)) {
    throw new Error(`No se pudo actualizar la ficha ${idAviso} (status ${res.status}, location ${res.location ?? "—"}).`);
  }
  await markGestionOk();
}

// ─── Paso 2: datos de contacto ───────────────────────────────────────────────

export type ContactoInput = {
  nombreInmobiliaria: string;
  disponibilidad: string; // "Lunes a Viernes de 10 a 18"
  telefono1?: string;
  telefono2?: string;
  celular?: string;
  whatsapp?: string;
  email: string;
};

export async function setContacto(idAviso: string, input: ContactoInput): Promise<void> {
  await gestionPostForm("/wizardproperty/datoscontactopost", [
    ["NombreInmobiliaria", input.nombreInmobiliaria],
    ["DisponibilidadAtencion", input.disponibilidad],
    ["Telefono1", input.telefono1 ?? ""],
    ["Telefono2", input.telefono2 ?? ""],
    ["Celular", input.celular ?? ""],
    ["WhatsApp", input.whatsapp ?? ""],
    ["Email", input.email],
    ["IdAviso", idAviso],
    ["StepId", "DatosContacto"],
    ["IsEmprendimiento", "False"],
    ["EstadoPublicacion", "VIGENTE"],
    ["IsVisible", "False"],
    ["UrlReedirect", `/propiedades/${idAviso}`],
    ["IsSaveExit", "false"],
  ]);
}
