# Publicación de avisos en ZonaProp

Estado: **motor implementado y validado localmente. Bloqueado para producción**
por la infraestructura de IP residencial (ver "Producción").

## Resumen

ZonaProp **no tiene API pública** de publicación (a diferencia de MercadoLibre).
Publicamos replicando la **API interna del panel de publicador** (`reppro-api`),
la misma técnica que usamos para leer las notificaciones (`leads-api`).

Publicar es un **wizard por pasos**: cada paso es un `POST` a
`/reppro-api/publication/api/v1/posting/STEP_*`. `STEP_OPERATION` (sin
`postingId`) **crea un borrador** y devuelve su id; los demás pasos lo completan.
El aviso queda en estado **DRAFT** hasta un paso final de confirmación
(todavía no relevado — ver "Pendiente").

| Paso | Endpoint | Contenido |
|------|----------|-----------|
| 1. Operación | `POST /posting/STEP_OPERATION` | operación (1=venta) + tipo → **crea el borrador** |
| 2. Ubicación | `POST /posting/STEP_LOCATION` | address, coordinates [lng,lat], location_id |
| 3. Descripción | `POST /posting/STEP_DESCRIPTION` | title, description, internal_code |
| 4. Características | `POST /posting/STEP_MAIN` | features CFT (superficie, ambientes...) |
| 5. Amenities | `POST /posting/STEP_EXTRA` | features |
| 6. Precio | `POST /posting/STEP_PRICE` | currency, amount |
| 7. Fotos | `POST /reipro-api/preview` (multipart) → `POST /posting/STEP_MULTIMEDIA` | sube y adjunta |
| 8. Confirmar | *(pendiente de relevar)* | publica el aviso |

Datos de referencia (GET): `/realestatetypes` (Casa=1, Depto=2, Terreno=26,
PH=2001, Local=5, Oficina=4...), `/realestatetypes/{id}/subtypes`,
`/places/autocomplete`, `/location/geopoint`, `/location/{id}/children`.

## Por qué NO se puede publicar por ZenRows (importante)

Para **leer** usamos ZenRows (la API interna GET pasa con `js_render` +
`premium_proxy`, y el `sessionId` autentica aunque la IP rote). **Escribir NO
funciona por ZenRows.** Probado exhaustivamente contra `STEP_OPERATION`:

| Intento vía ZenRows | Resultado |
|---|---|
| POST + cookie `sessionId` | 403 |
| POST + **todas** las cookies de la sesión | 403 |
| + header `Origin` (hipótesis CSRF) | 403 / 401 |
| + `X-Requested-With` / User-Agent de navegador | 403 / 401 |
| + IP pegajosa (`session_id` de ZenRows) | 401 |

Causa: la creación de aviso exige el **estado de una sesión logueada real**
(cookies + `localStorage` + fingerprint que el panel establece al navegar). Un
proxy **stateless** como ZenRows no lo reproduce → el server responde
**"User not Logged" (401)** o 403. Las **lecturas** toleran esto (basta el
`sessionId`); las **escrituras** no.

**Confirmación:** el mismo `POST` hecho con `fetch` **dentro de un navegador
logueado** (in-page fetch) devuelve **200** y crea el borrador. Es lo que hace
`browser-publish.ts`.

## Arquitectura implementada

- `src/lib/zonaprop/publish.ts` — builders de cada paso (payloads), agnósticos
  de transporte: reciben un `run(url, body)`.
- `src/lib/zonaprop/browser-publish.ts` — el transporte: abre un Chrome con la
  sesión guardada (cookies + **localStorage**, sin esto da "User not Logged"),
  navega el panel (pasa Cloudflare) y ejecuta cada paso con **in-page fetch**.
- Sesión: se reusa la del scraper (`jp_scraper_sessions`, `scripts/scraper/login.ts`).
- Estado de publicación: tabla existente `jp_property_publications`
  (`PropertyPublication`, agnóstica de portal) con `portal="zonaprop"`.

Prueba local: `SCRAPER_HEADLESS=false pnpm exec tsx scripts/scraper/zonaprop-publish-local-test.ts`
(crea un borrador y lo deja en DRAFT — verificar y borrar en el panel).

## Producción (bloqueado)

Publicar corre un **navegador real**, que necesita **IP residencial**: desde la
IP de datacenter de Railway, Cloudflare bloquea la navegación inicial (mismo
motivo que el scraping de ZonaProp). Opciones:

- **Proxy residencial** (`ZONAPROP_PROXY`, ~US$5-10/mes) — ya soportado en
  `browser-publish.ts`. Sirve para leer **y** escribir.
- **Máquina en la oficina** (IP residencial, costo cero, equipo prendido).

Decisión de infra/costo pendiente del tech lead.

## Pendiente (cuando se retome)

1. Relevar el **paso 8 (confirmar/publicar)** — capturar ese request.
2. **Fotos**: subir cada foto de la propiedad a `POST /reipro-api/preview`
   (multipart) y adjuntarlas en `STEP_MULTIMEDIA`.
3. **Mapeo `Property` → payload**: tipos (`realEstateTypeId`), códigos `CFT` de
   características, y resolución de dirección → coordenadas → `location_id`
   (`places/autocomplete` + `geopoint`).
4. **UI**: wizard + botón "Publicar en ZonaProp" (clonar el de MercadoLibre).
5. **Persistencia de sesión completa** validada desde la DB (el POC se validó
   con un perfil de disco logueado; `browser-publish.ts` restaura cookies +
   localStorage desde la DB — confirmar que alcanza).
6. **Loop completo**: una vez publicado, las consultas de ese aviso caen solas
   en el scraper de leads.
