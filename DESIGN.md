---
name: Profitos (V4 · Cálido Expresivo)
description: Back-office y portal de inquilinos de Juliana Profitos Propiedades; canvas crema, tinta casi negra, dorado para lo que cambia.
colors:
  canvas: "#FAF7F2"
  surface: "#FFFFFF"
  surface-elevated: "#F5F1E9"
  ink: "#1B1916"
  ink-hover: "#33302B"
  ink-muted: "#57534A"
  ink-dim: "#6E6A60"
  ink-faint: "#8E897D"
  dark-fg: "#FAF7F2"
  dark-muted: "#B7B2A6"
  border: "#ECE6DA"
  border-strong: "#DFD8C9"
  accent-gold: "#C6A15B"
  terra: "#C56A4A"
  olive: "#6C7A5A"
  warning: "#B27A34"
  danger: "#A94C45"
  info: "#5B7285"
  tint-sand: "#F3EAD9"
  tint-clay: "#F6E3DB"
  tint-sage: "#E9EDE0"
  tint-info: "#E6EBEF"
  scrim: "rgba(20, 19, 15, 0.55)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
  figure-hero:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  figure:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  headline:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
  caption:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
  pill:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
  overline:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  chip: "6px"
  inset: "10px"
  field: "14px"
  tile: "16px"
  list: "18px"
  card: "20px"
  hero: "24px"
  sheet: "28px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-fg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-sm:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-fg}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  button-gold:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.tint-clay}"
    textColor: "{colors.terra}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-hero:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-fg}"
    rounded: "{rounded.hero}"
    padding: "24px"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-fg}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  pill-collected:
    backgroundColor: "{colors.tint-sage}"
    textColor: "{colors.olive}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-pending:
    backgroundColor: "{colors.tint-sand}"
    textColor: "{colors.warning}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-overdue:
    backgroundColor: "{colors.tint-clay}"
    textColor: "{colors.terra}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-info:
    backgroundColor: "{colors.tint-info}"
    textColor: "{colors.info}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-neutral:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-adjust-overdue:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.accent-gold}"
    typography: "{typography.pill}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  calendar-chip-pending:
    backgroundColor: "{colors.tint-sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "4px 6px"
  calendar-chip-adjust:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "4px 6px"
  receipt-stub-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.dark-fg}"
    rounded: "{rounded.list}"
    padding: "16px"
  receipt-stub-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.list}"
    padding: "16px"
---

# Design System: Profitos (V4 · Cálido Expresivo)

## Overview

**Creative North Star: "El escritorio de la inmobiliaria"**

Un escritorio de oficina bien llevado: papel crema, carpetas blancas, tinta casi negra y un único dorado que marca lo que cambia. V4 · Cálido Expresivo es denso pero respirado; el trabajo se lee en cifras grandes en Bricolage Grotesque y todo lo demás habla en Figtree pequeño y preciso. La calidez viene de la paleta (crema, arena, arcilla, salvia), nunca de gradientes ni de decoración.

El sistema es operativo: el celular pesa tanto como la compu, por eso los controles son pills de 44px, las listas son cards en mobile y tablas en desktop, y los modales son hojas que suben desde abajo. Los estados se comunican con tints de fondo y texto del mismo matiz (salvia cobrado, arena a cobrar, arcilla vencido), no con bordes de color; los puntos de estado de 6px quedan para donde no entra un pill (tira de días, leyendas).

La superficie de alquileres extiende el mundo sin cambiar paleta ni tipografía: suma el talón de recibo con línea de corte, los chips del calendario coloreados por estado y la hoja de cobro "split". Las fuentes de verdad siguen siendo `src/app/globals.css` (tokens) y `docs/V4-STYLE-GUIDE.md` (patrones); este archivo las registra tal como quedaron construidas.

**Key Characteristics:**
- Canvas crema, superficies blancas con borde cálido de 1px, sin sombras en reposo.
- Un primario por pantalla: pill de tinta oscura con ícono dorado.
- Bricolage Grotesque solo para títulos, días y cifras (siempre tabulares); Figtree para todo lo demás.
- Estados como tint + texto del mismo matiz, en pills `rounded-full`.
- Dorado reservado para lo que cambia o requiere atención: aumentos, foco, el día de hoy.

## Colors

Una paleta de papel y tinta con un solo acento metálico y tres tierras para estados.

### Primary
- **Tinta de Escritorio** (`ink`): texto principal y relleno sólido del primario, segmentado activo, día seleccionado, card hero y talón del inquilino. En el código vive también como `--color-dark`, `--color-primary` y `--color-olive-mid` (nombres históricos que hoy resuelven a la tinta).
- **Dorado de Aumento** (`accent-gold`): ícono dentro del primario, anillo de foco (outline 2px, offset 2px), anillo del día de hoy, banderas y chips de aumento, check del checkbox, ícono de empty state, porción "a cobrar" de la barra del mes.

### Secondary
- **Terracota** (`terra`): links de acción ("Explorar", "Avisarle por WhatsApp"), texto de vencido y de error, descuento de honorarios en la hoja split, texto del botón destructivo.
- **Oliva** (`olive`): éxito/cobrado/vigente, switch encendido, porción "cobrado" de la barra del mes.

### Tertiary
- **Ámbar de Espera** (`warning`): texto de pendiente/parcial/por terminar sobre arena.
- **Pizarra** (`info`): estados informativos o futuros ("Empieza pronto") sobre `tint-info`.
- **Óxido** (`danger`): rojo semántico del sistema heredado; en alquileres el vencido se dice con terracota.

### Neutral
- **Crema de Canvas** (`canvas`): fondo de página, hover de filas y botones secundarios, empty states, pill neutra, fondos de celdas vacías del calendario (al 60%).
- **Hoja Blanca** (`surface`): cards, tablas, campos, hojas modales.
- **Crema Elevada** (`surface-elevated`): superficies secundarias del sistema heredado.
- **Borde Cálido** (`border`) / **Borde Firme** (`border-strong`): bordes de 1px de cards y campos; el firme para hover de campos, checkbox apagado, switch apagado y líneas punteadas.
- **Tinta Media / Tenue / Débil** (`ink-muted`, `ink-dim`, `ink-faint`): labels, metadatos, cabeceras de tabla, placeholders.
- **Sobre Oscuro** (`dark-fg`, `dark-muted`): texto principal y secundario sobre tinta.
- **Tints** (`tint-sand`, `tint-clay`, `tint-sage`, `tint-info`): fondos de pills, chips, KPI tiles, avisos y avatares de iniciales.

### Named Rules
**The Tint-and-Hue Rule.** Un estado es siempre un fondo tint con texto de su mismo matiz: cobrado salvia/oliva, a cobrar arena/ámbar, vencido arcilla/terracota, info gris-azul/pizarra, neutro crema/tinta débil. Nunca un borde de color ni un fondo saturado.

**The Gold Means Change Rule.** El dorado marca lo que se mueve o pide atención (aumentos, foco, hoy). No es color de marca para decorar; si un elemento dorado no anuncia un cambio o un foco, sobra.

**The One Dark Pill Rule.** Una sola pill oscura primaria por pantalla; el resto de las acciones son secundarias blancas con borde, texto o link terracota.

## Typography

**Display Font:** Bricolage Grotesque (pesos 500-700; con Figtree de respaldo)
**Body Font:** Figtree (pesos 300-700; con system-ui)

**Character:** Bricolage aporta el carácter expresivo y algo editorial en títulos y cifras; Figtree es la voz de trabajo, compacta y legible a 11-13.5px. La escala es fina y en pasos de medio punto, típica de una herramienta densa.

### Hierarchy
- **Display** (600, 26px / 28px desde md, line-height 1.25): título de página ("Alquileres", "Hola, Juliana").
- **Figure Hero** (700, 40px, line-height 1, tabular): la cifra protagonista de una card hero oscura (saldo del portal; `text-5xl` en el dashboard).
- **Figure** (700, 26px, tabular): montos de talones y KPI; las cifras secundarias bajan a 15-16px manteniendo Bricolage bold tabular.
- **Title** (600, 17px): encabezado de hojas modales.
- **Headline** (600, 16px; 14-15px en subsecciones): títulos de card y sección, días del calendario (16px tabular).
- **Body** (400, 13.5px): celdas principales, conceptos, inputs (los inputs reales rinden a 16px por la regla anti-zoom de iOS).
- **Label** (600, 12.5px): labels de campo, tabs, botones chicos.
- **Caption** (400, 11.5px): subtítulos, hints, fechas secundarias.
- **Pill** (700, 11px): pills de estado y chips de calendario.
- **Overline** (700, 10.5px, 0.12em, MAYÚSCULAS): solo cabeceras de tabla, días de la semana del calendario y labels de KPI tiles.

### Named Rules
**The Figures Are Display Rule.** Todo monto, número de día o cifra de KPI va en Bricolage con `tabular-nums`; los números nunca bailan al animar.

**The Overline-Only-In-Grids Rule.** Las mayúsculas espaciadas existen solo como cabecera de una grilla (tabla, semana, KPI) y en el wordmark de marca "JULIANA PROFITOS / Propiedades" (identidad, no tipografía de UI). No se usan como rótulo sobre títulos.

## Layout

Contenido sobre canvas crema con cards blancas. Patrón constante: cards apiladas en mobile, tabla en desktop (`md:`). Ritmo de 20px entre bloques (`gap-5`), 16px de padding de card en mobile y 20px desde md, 6px entre label y campo, 12px entre título de sección y contenido. Breakpoints de Tailwind: `sm` 640px (las hojas pasan de bottom sheet a diálogo centrado), `md` 768px (tablas, calendario de 7 columnas), `lg`/`xl` para columnas extra. En mobile el contenido reserva 96px + safe area para la barra flotante inferior.

Las vistas de trabajo se arman como "lista + detalle": en desktop, calendario mensual de 7 columnas a la izquierda y panel del día a la derecha; en mobile, tira de días deslizable con snap y agenda vertical. Las hojas complejas usan dos columnas (`1fr` + 340px) con la columna derecha sticky.

## Elevation & Depth

Plano por defecto, con capas tonales: crema detrás, blanco encima, borde cálido de 1px como separación. Las sombras son cortas, cálidas y teñidas con la tinta; aparecen en elementos flotantes (hojas, menús, knob del switch), no en cards en reposo. El scrim de modales es tinta al 55% con blur leve. Las barras sticky (topbar, header del portal) usan canvas translúcido al 85% con blur: es la única transparencia del sistema.

### Shadow Vocabulary
- **Flotante bajo** (`box-shadow: 0 4px 12px rgba(27, 25, 22, 0.07)`): popovers y menús.
- **Flotante medio** (`box-shadow: 0 10px 28px rgba(27, 25, 22, 0.10)`): paneles elevados.
- **Hoja** (`box-shadow: 0 18px 48px rgba(27, 25, 22, 0.18), 0 3px 10px rgba(27, 25, 22, 0.08)`): hojas modales y diálogos.

### Named Rules
**The Border-Not-Shadow Rule.** Una card en reposo se separa del canvas con su borde de 1px, no con sombra.

## Shapes

Esquinas generosas y graduadas por escala: 6px para chips del calendario y checkbox, 10px para inputs embebidos, 14px para campos y avisos, 16px para celdas de la tira de días, 18px para cards de lista y talones, 20px para cards y tablas, 24px para la card hero y diálogos desktop, 28px para el borde superior de hojas mobile. Todo control (botón, tab, pill, buscador, avatar, paginación) es `rounded-full`. Ningún contenedor baja de 12px.

La línea punteada es parte del vocabulario del mundo de papel: marca lo que se corta o lo que termina (línea de corte del talón, conector de honorarios, chip "Termina", contrato por terminar).

## Components

### Buttons
Táctiles y concretos: pills sólidas, sin gradientes.
- **Shape:** pill completa (9999px); 44px de alto el estándar, 36px el chico.
- **Primary:** tinta con texto crema, 13.5px bold, 20px de padding lateral, ícono en dorado. Hover baja opacidad al 90%.
- **Secondary:** blanco con borde cálido, texto tinta media semibold; hover a canvas y texto tinta.
- **Gold:** dorado con texto tinta, 36px; solo para aplicar un aumento.
- **Danger:** arcilla con texto terracota (40px); confirmación fuerte en terracota sólida con texto blanco.
- **Text / Link:** "Cancelar" en 13px tinta débil; link de acción en Bricolage 12.5px bold terracota con subrayado en hover.
- **Focus / Disabled:** outline dorado 2px, offset 2px; deshabilitado al 50%.

### Chips (status pills)
- **Style:** pill, 11px bold, 4px x 10px, tint + texto del mismo matiz (ver The Tint-and-Hue Rule).
- **Mapeo de vencimientos:** a cobrar y parcial arena/ámbar, vencido arcilla/terracota, cobrado salvia/oliva, condonado crema/tinta débil.
- **Mapeo de contratos:** vigente salvia, por terminar arena, empieza pronto info, finalizado neutro.
- **Aumento:** arena con bandera dorada; aumento sin aplicar en tinta con texto dorado (el único estado que invierte).
- **Filtros activos:** arena, 12px semibold, tinta media, con ✕.

### Cards / Containers
- **Corner Style:** 20px (cards de lista mobile 18px).
- **Background:** blanco; KPI tiles tintados en arena/salvia/arcilla; hero en tinta (24px, 24px de padding).
- **Shadow Strategy:** ninguna en reposo (ver Elevation & Depth).
- **Border:** 1px borde cálido.
- **Internal Padding:** 16px, 20px desde md.

### Inputs / Fields
- **Style:** 44px de alto, 14px de radio, blanco con borde cálido, 14px de padding lateral; label arriba en 12.5px semibold, hint debajo en 11.5px tinta débil. Selects y dates nativos ocultos bajo un control custom con chevron.
- **Focus:** el borde pasa a dorado (sin outline); hover a borde firme.
- **Checkbox:** caja de 20px, 6px de radio; activa en tinta con check dorado, inactiva blanca con borde firme.
- **Switch:** 44x24 pill, oliva encendido, borde firme apagado, knob blanco.
- **Disabled:** opacidad 60%.

### Navigation
- **Tabs / segmentados:** contenedor pill blanco con borde y 4px de padding; activa en tinta con texto crema 12.5px bold; inactiva 12.5px medium tinta débil, hover tinta. Variante suave: activa blanca con sombra mínima sobre contenedor crema.
- **Selector de mes:** ‹ Mes Año › en el header junto al primario.
- **Paginación:** círculos de 36px, activa en tinta.

### Sheets
Hojas modales de Radix: en mobile suben desde abajo con 28px de radio superior, handle de 40x4px y hasta 92dvh; desde `sm` son diálogos centrados de 24px. Encabezado en Bricolage 17px; footer con borde superior, "Cancelar" de texto y primario pill.

### Receipt Stub (talón con línea de corte)
Cada recibo que se emite se dibuja como un talón de talonario: card de 18px, 16px de padding, título en Bricolage 14px, subtítulo en caption, número `N° 0001-` + input numérico en una pill embebida (crema sobre blanco, blanco al 10% sobre tinta). Una línea punteada de borde a borde con dos muescas circulares de 16px en el color de la superficie anfitriona separa el encabezado del monto; debajo, el titular en 12px y el monto en Figure (26px). El talón del inquilino es oscuro (tinta), el del propietario es blanco con borde; deshabilitado baja al 40%.

### Split Sheet (hoja de cobro)
Dos columnas: conceptos y datos del cobro a la izquierda, a la derecha una columna sticky de 340px con los dos talones apilados. Entre ellos, un conector vertical punteado de 2px en borde firme sostiene la línea de honorarios: input pill de porcentaje, link terracota "usar N%" si se editó, y el descuento en Bricolage 14px bold terracota. Los montos se recalculan en vivo con una transición de 160-180ms (opacidad + 3-4px de desplazamiento).

### Agenda Calendar
Grilla de 7 columnas dentro de una card de 20px, celdas de 132px de alto mínimo separadas por bordes de 1px, fines de semana en crema al 40%, día seleccionado en arena al 60%. Número del día en Bricolage 16px dentro de un círculo de 32px: seleccionado en tinta, hoy con anillo dorado. Cada celda muestra hasta tres chips de 6px de radio, en este orden: aumentos (dorado sólido, texto tinta, bandera), vencimientos (tint por estado, dirección en 11px semibold + monto corto en 10.5px tabular), "+N más", y finales de contrato (borde punteado, texto tinta débil). En mobile se convierte en una tira de días de 48px de ancho con snap y puntos de estado de 6px.

### Month Summary Bar
Una barra pill de 8px (12px desde `sm`) sobre crema, repartida en oliva (cobrado), dorado (a cobrar) y terracota (vencido), con la leyenda debajo: punto de 6px + label 11.5px + cifra en Bricolage. Anima el ancho en 400ms con `cubic-bezier(0.16, 1, 0.3, 1)`.

### Empty State
Bloque crema de 20px, círculo arena de 48px con ícono dorado, título Bricolage 15px y texto 12.5px tinta débil, máximo `max-w-sm`.

## Do's and Don'ts

### Do:
- **Do** usar los nombres de token de `globals.css` (`bg-surface`, `text-text-muted`, `bg-sand-chip`, `bg-dark`) en vez de hex sueltos.
- **Do** poner toda cifra en Bricolage bold con `tabular-nums`.
- **Do** mantener un único primario oscuro por pantalla, con su ícono en dorado.
- **Do** expresar estados con el mapeo tint + matiz de los pills (salvia cobrado, arena a cobrar, arcilla vencido).
- **Do** usar el anillo de foco dorado (outline 2px, offset 2px) en todo control que no sea un campo; los campos cambian el borde a dorado.
- **Do** usar línea punteada para lo que se corta o termina (talones, finales de contrato).
- **Do** mantener las transiciones en 150-200ms con easing de salida (`cubic-bezier(0.16, 1, 0.3, 1)`).

### Don't:
- **Don't** sumar gradientes, sombras de color ni sombras en cards en reposo.
- **Don't** usar mayúsculas espaciadas fuera de cabeceras de tabla, días de la semana, labels de KPI y el wordmark de marca.
- **Don't** bajar un contenedor de 12px de radio ni dar esquinas cuadradas a controles.
- **Don't** marcar estados con bordes de color o puntos solos cuando hay espacio para un pill.
- **Don't** usar el dorado como decoración: solo para aumentos, foco y hoy.
- **Don't** sumar rebotes nuevos en las animaciones.
