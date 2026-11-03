---
version: 1
slug: "src-app-web-page-tsx"
primary_target: "src/app/web/page.tsx"
related_targets: ["src/app/web/propiedades/page.tsx","src/app/web/p/[slug]/page.tsx"]
---

# Web pública (Tokko replacement)

Scope: `src/app/web` — inicio, listado y ficha. Mode: Persuade (inicio), con listado y ficha de tarea. Mundo propio de esta superficie: NO reemplaza DESIGN.md, que gobierna el back-office V4.
Audience: familias e inversores de Quilmes y zona sur, sobre todo en celular; propietarios que piden tasación.
Job: encontrar una propiedad y consultar por WhatsApp. Constraints: colores de marca negro/blanco/grises/rojo; datos públicos desde Profitos; nunca exponer realAddress, ownerReportData, rawPayload.
Unresolved: marca "destacada", tabla de emprendimientos, destino de formularios, dominio, sitemap/redirecciones.

## Direction contract
THESIS: portal inmobiliario clásico premium, tocado sin ironía: la propiedad en foto grande y el buscador a mano. Rechaza la plantilla densa de Tokko.
OWN-WORLD: negro puro en encabezado, emprendimientos y pie; fondo gris iOS #F2F2F7 con superficies blancas; rojo #C93F2C solo para venta, foco y favorita; verde solo en el botón flotante de WhatsApp, heredado de la web anterior. Schibsted Grotesk. Componentes estilo iOS, pedido por Charly: radios 10/14/20, control segmentado, listas agrupadas, hojas inferiores con deslizamiento. Sin backdrop-filter en elementos repetidos. Mapa IGN en gris.
STORY: el visitante ve edificios reales de Quilmes, busca, compara precios claros y consulta por WhatsApp sin formularios largos.
FIRST VIEWPORT: encabezado negro de 68 px; foto a sangre de edificio; titular grande a la izquierda abajo; panel blanco con segmentado Comprar/Alquilar, Tipo, Zona, Ambientes, Buscar; epígrafe del edificio arriba a la derecha. Accesos por tipo debajo.
FORM: canon de la categoría, elegido por el usuario; seed d31a6699. Firma: crossfade del hero, foto compartida tarjeta→ficha, lista de emprendimientos que maneja la imagen.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
