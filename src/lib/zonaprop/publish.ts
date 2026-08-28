/**
 * Motor de PUBLICACIÓN de avisos en ZonaProp (API interna reppro-api).
 *
 * Publicar es un wizard por pasos: cada paso es un POST a
 * /reppro-api/publication/api/v1/posting/STEP_*. STEP_OPERATION (sin postingId)
 * CREA un borrador y devuelve su id; los demás pasos lo completan. El aviso
 * queda en estado DRAFT hasta un paso final de confirmación (aún no relevado).
 *
 * IMPORTANTE — transporte: la escritura NO funciona por ZenRows (stateless):
 * ZonaProp exige un estado de sesión real (login + fingerprint) que solo tiene
 * un navegador logueado. Ver docs/ZONAPROP-PUBLISH.md. Por eso los pasos no
 * llaman al transporte directo: reciben un `run` que ejecuta el POST DENTRO de
 * un navegador logueado (in-page fetch). Lo provee browser-publish.ts.
 */

const BASE = "https://www.zonaprop.com.ar";
const API = `${BASE}/reppro-api/publication/api/v1`;

/** Respuesta común de cada STEP_*: identifica el borrador y su estado. */
export type StepResult = {
  postingId: string;
  status: string; // DRAFT | ...
  postingPublished: boolean;
};

/** Ejecuta un POST a un endpoint del portal y devuelve el JSON. Lo implementa
 *  el transporte (navegador logueado → in-page fetch). */
export type StepRunner = (url: string, body: unknown) => Promise<StepResult>;

/** Headers que la SPA de ZonaProp manda a reppro-api. */
export function publishHeaders(sessionId: string): Record<string, string> {
  return {
    sessionid: sessionId,
    "x-panel-portal": "ZPAR",
    "content-type": "application/json",
    referer: `${BASE}/panel/publicador-profesionales/main`,
  };
}

// ─── Paso 1: operación + tipo (CREA el borrador) ─────────────────────────────

export type OperationInput = {
  operationType: string; // "1" venta | "2" alquiler | "3" alquiler temporal
  realEstateTypeId: string; // Casa=1, Depto=2, Terreno=26, PH=2001, Local=5...
  realEstateSubTypeId?: string | null;
};

export function createDraft(run: StepRunner, input: OperationInput): Promise<StepResult> {
  return run(`${API}/posting/STEP_OPERATION`, {
    price_operation_type: [{ operation_type: input.operationType }],
    real_estate_type_id: input.realEstateTypeId,
    real_estate_sub_type_id: input.realEstateSubTypeId ?? null,
    postingId: null,
  });
}

// ─── Paso 2: ubicación ───────────────────────────────────────────────────────

export type LocationInput = {
  address: string;
  coordinates: [number, number]; // [lng, lat]
  locationId: string; // ej "V1-E-209345" (de geopoint/children)
  visibility?: "EXACT" | "MID" | "ZONE";
};

export function setLocation(run: StepRunner, postingId: string, input: LocationInput): Promise<StepResult> {
  return run(`${API}/posting/STEP_LOCATION`, {
    address: input.address,
    coordinates: input.coordinates,
    geolocation_visibility: input.visibility ?? "EXACT",
    location_id: input.locationId,
    postingId,
  });
}

// ─── Paso 3: descripción ─────────────────────────────────────────────────────

export type DescriptionInput = { title: string; description: string; internalCode?: string };

export function setDescription(run: StepRunner, postingId: string, input: DescriptionInput): Promise<StepResult> {
  return run(`${API}/posting/STEP_DESCRIPTION`, {
    postingId,
    title: input.title,
    description: input.description,
    internal_code: input.internalCode ?? "",
  });
}

// ─── Paso 4: características principales (superficies, ambientes...) ───────────
// Se expresan como features con feature_id (códigos CFT). value_unit "1" = m2.

export type Feature = { feature_id: string; value?: number; value_unit?: string };

export function setMain(run: StepRunner, postingId: string, features: Feature[]): Promise<StepResult> {
  return run(`${API}/posting/STEP_MAIN`, { features, postingId });
}

// ─── Paso 5: extras / amenities ──────────────────────────────────────────────

export function setExtra(run: StepRunner, postingId: string, features: Feature[] = []): Promise<StepResult> {
  return run(`${API}/posting/STEP_EXTRA`, { postingId, features });
}

// ─── Paso 6: precio ──────────────────────────────────────────────────────────

export type PriceInput = {
  operationType: string;
  currency: string; // "USD" | "ARS"
  amount: number;
  features?: Feature[];
};

export function setPrice(run: StepRunner, postingId: string, input: PriceInput): Promise<StepResult> {
  return run(`${API}/posting/STEP_PRICE`, {
    price_operation_type: [
      { operation_type: input.operationType, prices: [{ currency: input.currency, amount: input.amount }] },
    ],
    features: input.features ?? [],
    postingId,
  });
}

// ─── Orquestación: crear un borrador completo (sin fotos ni confirmación) ─────

export type DraftInput = {
  operation: OperationInput;
  location?: LocationInput;
  description?: DescriptionInput;
  main?: Feature[];
  price?: Omit<PriceInput, "operationType">;
};

/**
 * Crea un borrador y completa los pasos provistos. Devuelve el postingId.
 * NO sube fotos ni confirma (el aviso queda DRAFT). El orden respeta el wizard.
 */
export async function createFullDraft(run: StepRunner, input: DraftInput): Promise<string> {
  const draft = await createDraft(run, input.operation);
  const id = draft.postingId;
  if (input.location) await setLocation(run, id, input.location);
  if (input.description) await setDescription(run, id, input.description);
  if (input.main) await setMain(run, id, input.main);
  if (input.price) await setPrice(run, id, { ...input.price, operationType: input.operation.operationType });
  return id;
}
