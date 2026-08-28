/**
 * Publicación de avisos en ArgenProp Gestión (wizard MVC por form-posts).
 *
 * Flujo (validado con HTTP plano):
 *   1) POST /wizardproperty/datosgeneralespost  → crea la ficha, 302 a
 *      /avisos/editar/{IdAviso}/datoscontacto  (de ahí sale el IdAviso).
 *   2) POST /wizardproperty/datoscontactopost   → datos de contacto.
 *   (Fotos y publicación final: pendientes de relevar.)
 *
 * La ficha queda como borrador (no publicada) hasta asignarle puntos/posición.
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
  /** Keys de fotos ya subidas (ver photos.ts), van en los campos `file`. */
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
  // Un campo `file` por foto subida (key t/{uuid}.ext); si no hay, uno vacío.
  const fileFields: [string, string][] = (input.photos?.length ? input.photos : [""]).map((k) => [
    "file",
    k,
  ]);
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
