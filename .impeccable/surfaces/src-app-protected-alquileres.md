---
version: 1
slug: "src-app-protected-alquileres"
primary_target: "src/app/(protected)/alquileres"
related_targets: ["src/app/portal"]
---

# Alquileres (admin + portal inquilino)

Scope: todas las pantallas de alquileres del staff (/alquileres agenda, contratos, legajo, nuevo contrato, cobro, recibos/talonario, comprobantes, inquilinos, propietarios) y el portal de inquilinos (/portal). Mode: Operate. Mundo heredado: V4 Cálido Expresivo (docs/V4-STYLE-GUIDE.md); no se cambia paleta ni tipografía.

Audiencia y tarea: Juliana y empleados cobran alquileres tradicionales mensuales, emiten dos recibos por cobro (inquilino por cuenta de terceros / propietario con honorarios descontados), aplican aumentos cada N meses y revisan comprobantes de servicios que suben los inquilinos. Celular tan importante como la compu. Inquilinos: portal mobile-first para ver vencimientos, aumentos, bajar recibos y subir comprobantes.

Restricciones: datos existentes intactos (migración SQL aditiva, sin aplicar a prod sin OK); contratos temporales viejos se ven pero no se crean; honorarios 5% default editable por contrato y por cobro; talonarios con número inicial configurable, correlativo, editable y anulable.

## Direction contract

THESIS: Alquileres es una agenda de vencimientos: el mes es la unidad de trabajo y cada día dice qué cobrar, qué aumentar y qué termina. Rechaza la tabla de contratos con acordeones como pantalla principal.

OWN-WORLD: V4 Cálido Expresivo: canvas crema bg-bg, superficies blancas rounded-[20px], tinta #1B1916, dorado accent para aumentos, sage/sand/clay como estados cobrado/a cobrar/vencido, Bricolage display para cifras y días, Figtree para todo lo demás, pills rounded-full.

STORY: El equipo abre Alquileres, ve el mes con el total a cobrar, cobrado y vencido; toca un día o un vencimiento, cobra en una hoja que muestra en vivo cómo el pago se parte en recibo inquilino y recibo propietario, y emite ambos PDFs numerados. Las banderas doradas avisan qué contrato aumenta.

FIRST VIEWPORT: Desktop: header con título, selector de mes ‹ Octubre 2026 › y primario "Nuevo contrato"; tabs Agenda · Contratos · Recibos · Comprobantes; franja de 4 cifras del mes (a cobrar, cobrado, vencido, honorarios); izquierda calendario mensual 7 columnas donde cada día lleva chips de vencimientos coloreados por estado y banderas doradas de aumento; derecha panel del día seleccionado con la lista de vencimientos y botón Cobrar. Mobile: tira semanal deslizable + agenda vertical por día, cifras en carrusel compacto, primario flotante.

FORM: Agenda de vencimientos, posición 5 de 7 en mi lista, seed key 5dc454c6. Signature move: la hoja de cobro "split" donde el total del inquilino se divide en vivo en dos talones (inquilino / propietario) con honorarios editables.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
