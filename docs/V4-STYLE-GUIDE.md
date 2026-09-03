# V4 · Cálido Expresivo — Guía de implementación

Fuente de verdad: diseño Pencil (pencil-new.pen). Este documento traduce ese diseño a
clases Tailwind del proyecto. Los tokens ya están aplicados en `globals.css` — los
nombres de color existentes (`bg-surface`, `text-text-muted`, `border-border`, chips)
ya rinden la paleta V4. Tu trabajo es ajustar FORMAS, TIPOGRAFÍA y PATRONES.

## Reglas duras

- **NO cambiar lógica**: handlers, estados, fetches, condicionales y props quedan intactos.
- Solo `className`, orden/wrappers visuales mínimos y textos de estilo (nunca copy funcional).
- Mobile y desktop: respetar los breakpoints existentes (`sm:`, `md:`, `xl:`); el patrón
  cards-mobile/tabla-desktop se mantiene.
- Nada de gradientes nuevos, ni glassmorphism, ni sombras de color.

## Tokens disponibles (Tailwind)

- Superficies: `bg-bg` (canvas crema), `bg-surface` (blanco), `bg-surface-elevated`
- Tinta: `text-text`, `text-text-muted`, `text-text-faint`
- Bordes: `border-border`, `border-border-strong`
- Oscuro (primario): `bg-dark` `text-dark-fg` `text-dark-muted` (#1B1916 / #FAF7F2 / #B7B2A6)
- Acentos: `text-accent`/`bg-accent` (dorado #C6A15B), `text-terra` (#C56A4A, links de acción),
  `text-olive-light` (#6C7A5A)
- Tints/chips: `bg-sand-chip` (#F3EAD9), `bg-clay-chip` (#F6E3DB), `bg-sage-chip` (#E9EDE0),
  `bg-info-chip` (#E6EBEF) + alias existentes `bg-success-chip` = sage, `bg-warning-chip` = sand,
  `bg-danger-chip` = clay
- Semánticos texto: `text-success` (oliva), `text-warning` (#B27A34), `text-danger` (#A94C45), `text-info`
- Fuentes: `font-sans` = Figtree (default), `font-display` = Bricolage Grotesque

## Patrones V4

### Títulos de página

```
<h1 className="font-display text-[26px] font-semibold text-text md:text-[28px]">Propiedades</h1>
<p className="text-[12.5px] text-text-faint">Mostrando 20 de 128 resultados</p>
```

Subtítulos de sección/cards: `font-display text-base font-semibold text-text`.

### Botones

- **Primario** (uno por pantalla): `inline-flex h-11 items-center gap-2 rounded-full bg-dark px-5 text-[13.5px] font-bold text-dark-fg transition-opacity hover:opacity-90` — el ícono (ej. plus) va `text-accent`.
- **Secundario**: `inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4.5 text-[13.5px] font-semibold text-text-muted hover:bg-bg`
- **Destructivo**: `rounded-full bg-clay-chip px-4 text-[13px] font-bold text-terra` (h-10). Confirmación fuerte: botón sólido `bg-terra text-white rounded-full`.
- **Ghost/link de acción**: usar el componente `<ExploreLink>` (`dashboard/_components/explore-link.tsx`) — "Explorar" en `font-display text-[12.5px] font-bold text-terra`, sin flecha, con subrayado que crece de izquierda a derecha en hover. No repetir el markup inline.
- Botón texto "Cancelar": `text-[13px] font-semibold text-text-faint`.

### Pills de estado (reemplazan dots/badges viejos)

`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold` +

- éxito/activo: `bg-sage-chip text-olive-light`
- pendiente/en espera: `bg-sand-chip text-warning` (texto `#8A7558` ≈ usar `text-warning`)
- peligro/vencido/rechazado: `bg-clay-chip text-terra`
- info/proceso: `bg-info-chip text-info`
- neutro: `bg-bg text-text-faint`

### Cards

`rounded-[20px] border border-border bg-surface p-4 md:p-5` (mobile listas: `rounded-[18px] p-3.5`).
KPI tiles tintados: `rounded-[18px] bg-sand-chip p-4` (o sage/clay según semántica) con
label `text-[10px] font-bold uppercase tracking-[0.12em] text-text-faint` y valor
`font-display text-2xl font-bold`.
Hero/dark card (dashboard): `rounded-3xl bg-dark p-6 text-dark-fg`, número `font-display text-5xl`.

### Tablas (desktop)

Contenedor: `overflow-hidden rounded-[20px] border border-border bg-surface`.
`thead th`: `px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-faint`.
Filas: `border-t border-border` + hover `hover:bg-bg`; celda principal `text-[13.5px] font-bold text-text`
con subtítulo `text-[11.5px] text-text-faint`. Precios/cifras: `font-display font-bold`.

### Inputs y filtros (todo custom, nada nativo visible)

- Campo: contenedor `h-11 rounded-[14px] border border-border bg-surface px-3.5` con label
  arriba `text-[12.5px] font-semibold text-text-muted`. (Los `<select>`/`<input>` nativos
  existentes se conservan pero estilizados: `appearance-none bg-transparent`… + chevron svg.)
- Buscador: `h-11 rounded-full border border-border bg-surface pl-4 pr-3` con ícono lupa
  `text-text-faint`.
- Panel de filtros: card `rounded-[20px] border border-border bg-surface p-4`.
- Chips de filtros activos: `rounded-full bg-sand-chip px-3 py-1.5 text-[12px] font-semibold
text-text-muted` con ✕.
- Checkbox custom: caja `h-5 w-5 rounded-md bg-dark` con check dorado cuando activo /
  `border border-border-strong bg-surface` inactivo.
- Switch: `h-6 w-11 rounded-full` `bg-olive-light` on / `bg-border` off, knob blanco.

### Tabs / segmentados

Contenedor: `inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1`.
Tab activa: `rounded-full bg-dark px-4 py-1.5 text-[12.5px] font-bold text-dark-fg`.
Inactiva: `px-4 py-1.5 text-[12.5px] font-medium text-text-faint hover:text-text`.
Variante suave (sub-tabs): activa `bg-surface shadow-sm` sobre contenedor `bg-bg`.

### Modales / sheets

Ya existe `Sheet`; su superficie debe ser `bg-surface rounded-t-[28px]` (mobile) /
`rounded-3xl` (desktop), scrim `bg-scrim`. Headers de modal: `font-display text-[17px] font-semibold`.
Footer: borde superior `border-t border-border pt-3`, Cancelar texto + primario pill.

### Avatares con iniciales

`flex h-9 w-9 items-center justify-center rounded-full bg-sand-chip font-display text-[12px] font-bold text-text-muted` (alternar sand/sage/clay por índice si la lista lo hace).

### Paginación

Botones circulares `h-9 w-9 rounded-full`; página activa `bg-dark text-dark-fg font-bold`;
prev/next `border border-border bg-surface`. Info `text-[12.5px] text-text-faint`.

### Empty states

`rounded-[20px] bg-bg px-6 py-8 text-center` con círculo `h-12 w-12 rounded-full bg-sand-chip`

- ícono dorado, título `font-display text-[15px] font-semibold`, texto `text-[12.5px] text-text-faint`.

### Micro

- Radios: nunca menores a `rounded-xl` en contenedores; controles pill `rounded-full`.
- Duraciones: `transition-*` 150-200ms, sin bounces nuevos.
- No abusar de mayúsculas: solo labels overline de tablas/KPIs.
