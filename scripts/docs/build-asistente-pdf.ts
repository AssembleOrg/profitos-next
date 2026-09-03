/**
 * Genera public/docs/asistente-ia-casos-de-uso.pdf: guía de casos de uso del
 * asistente IA (chat) para el equipo. Se sirve desde la web y se abre con el
 * ícono "?" del chat (branding.ayudaUrl en rag-webchat).
 *
 *   pnpm exec tsx scripts/docs/build-asistente-pdf.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

// ─── Paleta (globals.css) ────────────────────────────────────────────────────
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  bg: hex("#FAF7F2"),
  surface: hex("#FFFFFF"),
  text: hex("#1B1916"),
  muted: hex("#6B655C"),
  faint: hex("#9A938A"),
  border: hex("#E7E0D4"),
  accent: hex("#C6A15B"),
  accentSoft: hex("#F3EBDB"),
  olive: hex("#6C7A5A"),
  oliveSoft: hex("#E9EDE3"),
  terra: hex("#C56A4A"),
  terraSoft: hex("#F6E4DD"),
  dark: hex("#1B1916"),
};

const PAGE = { w: 595.28, h: 841.89, mx: 48, mt: 56, mb: 54 };
const VERSION = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** WinAnsi no tiene flechas ni símbolos raros: los reemplazamos. */
function safe(s: string): string {
  return s
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/★/g, "*")
    .replace(/✓/g, "ok")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…€]/g, "");
}

type Fonts = { reg: PDFFont; bold: PDFFont; italic: PDFFont };

class Doc {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(public pdf: PDFDocument, public f: Fonts) {}

  newPage() {
    this.page = this.pdf.addPage([PAGE.w, PAGE.h]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE.w, height: PAGE.h, color: C.bg });
    this.pages.push(this.page);
    this.y = PAGE.h - PAGE.mt;
  }
  ensure(h: number) {
    if (this.y - h < PAGE.mb) this.newPage();
  }
  get width() {
    return PAGE.w - PAGE.mx * 2;
  }

  wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) <= maxW) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  text(text: string, opts: { size?: number; font?: PDFFont; color?: RGB; x?: number; maxW?: number; lh?: number; after?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.font ?? this.f.reg;
    const x = opts.x ?? PAGE.mx;
    const maxW = opts.maxW ?? PAGE.w - PAGE.mx - x;
    const lh = opts.lh ?? size * 1.42;
    const lines = this.wrap(text, font, size, maxW);
    for (const line of lines) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? C.text });
      this.y -= lh;
    }
    this.y -= opts.after ?? 0;
  }

  h1(title: string, subtitle?: string) {
    this.ensure(70);
    this.page.drawText(safe(title), { x: PAGE.mx, y: this.y - 22, size: 22, font: this.f.bold, color: C.text });
    this.y -= 30;
    if (subtitle) this.text(subtitle, { size: 10.5, color: C.muted, after: 6 });
    this.page.drawLine({ start: { x: PAGE.mx, y: this.y }, end: { x: PAGE.w - PAGE.mx, y: this.y }, thickness: 1, color: C.border });
    this.y -= 16;
  }

  section(n: number, title: string, subtitle: string) {
    this.ensure(90);
    if (this.y < PAGE.h - PAGE.mt - 10) this.y -= 8;
    // número en círculo + título
    const cx = PAGE.mx + 12;
    const cy = this.y - 13;
    this.page.drawCircle({ x: cx, y: cy, size: 12, color: C.dark });
    const num = String(n);
    const nw = this.f.bold.widthOfTextAtSize(num, 11);
    this.page.drawText(num, { x: cx - nw / 2, y: cy - 4, size: 11, font: this.f.bold, color: C.bg });
    this.page.drawText(safe(title), { x: PAGE.mx + 32, y: this.y - 18, size: 16, font: this.f.bold, color: C.text });
    this.y -= 28;
    this.text(subtitle, { size: 10, color: C.muted, x: PAGE.mx + 32, after: 10 });
  }

  chip(label: string, x: number, y: number, fill: RGB, color: RGB): number {
    const size = 8;
    const w = this.f.bold.widthOfTextAtSize(safe(label), size) + 12;
    this.page.drawRectangle({ x, y: y - 11, width: w, height: 14, color: fill, borderColor: fill, borderRadius: 7 } as never);
    this.page.drawText(safe(label), { x: x + 6, y: y - 7, size, font: this.f.bold, color });
    return w;
  }

  /** Tarjeta de caso de uso: título + chips + descripción + ejemplos + nota. */
  card(c: { title: string; chips?: { label: string; tone: "accent" | "olive" | "terra" }[]; body: string; examples?: string[]; note?: string }) {
    const size = 10;
    const innerX = PAGE.mx + 14;
    const innerW = this.width - 28;
    const bodyLines = this.wrap(c.body, this.f.reg, size, innerW);
    const exLines = (c.examples ?? []).flatMap((e) => this.wrap(`“${e}”`, this.f.italic, 9.5, innerW - 12));
    const noteLines = c.note ? this.wrap(c.note, this.f.reg, 8.8, innerW) : [];
    const h =
      14 + 16 + bodyLines.length * 14.2 + (exLines.length ? 8 + 11 + exLines.length * 13 : 0) + (noteLines.length ? 8 + noteLines.length * 12 : 0) + 14;
    this.ensure(h + 10);
    const top = this.y;
    this.page.drawRectangle({ x: PAGE.mx, y: top - h, width: this.width, height: h, color: C.surface, borderColor: C.border, borderWidth: 0.8, borderRadius: 10 } as never);
    this.page.drawRectangle({ x: PAGE.mx, y: top - h, width: 3, height: h, color: C.accent });
    let y = top - 14;
    this.page.drawText(safe(c.title), { x: innerX, y: y - 9, size: 11.5, font: this.f.bold, color: C.text });
    let cx = innerX + this.f.bold.widthOfTextAtSize(safe(c.title), 11.5) + 10;
    for (const ch of c.chips ?? []) {
      const [fill, col] = ch.tone === "accent" ? [C.accentSoft, hex("#8A6A2A")] : ch.tone === "olive" ? [C.oliveSoft, C.olive] : [C.terraSoft, C.terra];
      cx += this.chip(ch.label, cx, y - 1, fill, col) + 6;
    }
    y -= 16;
    for (const line of bodyLines) {
      y -= 14.2;
      this.page.drawText(line, { x: innerX, y: y + 3, size, font: this.f.reg, color: C.text });
    }
    if (exLines.length) {
      y -= 8;
      this.page.drawText("EJEMPLOS", { x: innerX, y: y - 6, size: 7.5, font: this.f.bold, color: C.faint });
      y -= 11;
      for (const line of exLines) {
        y -= 13;
        this.page.drawText(line, { x: innerX + 12, y: y + 3, size: 9.5, font: this.f.italic, color: C.muted });
      }
    }
    if (noteLines.length) {
      y -= 8;
      for (const line of noteLines) {
        y -= 12;
        this.page.drawText(line, { x: innerX, y: y + 3, size: 8.8, font: this.f.reg, color: C.terra });
      }
    }
    this.y = top - h - 10;
  }

  bullets(items: string[], opts: { color?: RGB; size?: number } = {}) {
    const size = opts.size ?? 10;
    for (const it of items) {
      const lines = this.wrap(it, this.f.reg, size, this.width - 16);
      this.ensure(lines.length * 14);
      this.page.drawCircle({ x: PAGE.mx + 4, y: this.y - size + 3.5, size: 1.6, color: C.accent });
      let first = true;
      for (const line of lines) {
        this.page.drawText(line, { x: PAGE.mx + 14, y: this.y - size, size, font: this.f.reg, color: opts.color ?? C.text });
        this.y -= 14;
        first = false;
      }
      void first;
      this.y -= 2;
    }
  }

  /** Bloque de conversación de ejemplo. */
  chat(title: string, turns: { who: "VOS" | "BOT"; text: string }[]) {
    this.ensure(50);
    this.text(title, { size: 11, font: this.f.bold, after: 4 });
    for (const t of turns) {
      const isBot = t.who === "BOT";
      const size = 9.5;
      const maxW = this.width - 60;
      const lines = this.wrap(t.text, this.f.reg, size, maxW - 20);
      const h = lines.length * 13 + 14;
      this.ensure(h + 6);
      const x = isBot ? PAGE.mx : PAGE.mx + 60;
      const w = Math.min(maxW, Math.max(...lines.map((l) => this.f.reg.widthOfTextAtSize(l, size))) + 20);
      this.page.drawRectangle({ x, y: this.y - h, width: w, height: h, color: isBot ? C.surface : C.accentSoft, borderColor: C.border, borderWidth: 0.6, borderRadius: 9 } as never);
      this.page.drawText(t.who, { x: x + 10, y: this.y - 9, size: 6.5, font: this.f.bold, color: C.faint });
      let y = this.y - 12;
      for (const line of lines) {
        y -= 13;
        this.page.drawText(line, { x: x + 10, y: y + 4, size, font: this.f.reg, color: C.text });
      }
      this.y -= h + 6;
    }
    this.y -= 8;
  }

  footers() {
    const total = this.pages.length;
    this.pages.forEach((p, i) => {
      const label = safe(`Profitos · Asistente IA · Guía de casos de uso · ${VERSION}`);
      p.drawLine({ start: { x: PAGE.mx, y: 34 }, end: { x: PAGE.w - PAGE.mx, y: 34 }, thickness: 0.6, color: C.border });
      p.drawText(label, { x: PAGE.mx, y: 22, size: 8, font: this.f.reg, color: C.faint });
      const pg = `Página ${i + 1} de ${total}`;
      p.drawText(pg, { x: PAGE.w - PAGE.mx - this.f.reg.widthOfTextAtSize(pg, 8), y: 22, size: 8, font: this.f.reg, color: C.faint });
    });
  }
}

async function main() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Profitos · Asistente IA · Guía de casos de uso");
  pdf.setAuthor("Profitos");
  const f: Fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const d = new Doc(pdf, f);
  d.newPage();

  // Cabecera
  d.page.drawText("PROFITOS", { x: PAGE.mx, y: d.y - 10, size: 9, font: f.bold, color: C.accent });
  d.page.drawText(safe("Juliana Profitos · Inmobiliaria"), { x: PAGE.mx + 62, y: d.y - 10, size: 9, font: f.reg, color: C.faint });
  d.y -= 26;
  d.h1("Asistente IA", `Guía de casos de uso para el equipo. Qué le podés pedir al chat, qué hace solo, qué te pide confirmar y qué no hace. Versión ${VERSION}.`);

  d.section(0, "Cómo funciona", "Lo esencial antes de empezar.");
  d.bullets([
    "Dónde está: el botón flotante del chat, en cualquier pantalla de Profitos. En el celular arranca arriba a la derecha; lo podés arrastrar y dejar donde te quede cómodo (se acuerda por dispositivo).",
    "Sabe quién sos: entra con tu usuario de Profitos. No te pide el email. Los permisos son los tuyos: un empleado ve/hace lo suyo; un admin, todo.",
    "Consulta datos reales del sistema: nunca inventa números, direcciones ni estados. Si no tiene una herramienta para algo, te lo dice y te indica desde qué pantalla se hace.",
    "Acciones con confirmación: todo lo que modifica algo (crear, pausar, publicar, editar, tomar, borrar) te lo explica primero en una frase y espera tu “sí” o “no”. Hasta que no confirmás, no pasa nada.",
    "Identificar una propiedad: por código de referencia (JAP…) o dirección. Si hay varias que coinciden (p. ej. un edificio con varias unidades) te pregunta cuál.",
    "Links: cuando genera una ficha, un reporte o te manda a una pantalla, te da el link completo; se abre con tu sesión de Profitos.",
    "Fechas en formato natural (“mañana a las 15”, “del 1 al 30 de septiembre”); él las traduce.",
    "También responde consultas generales breves (una duda, un cálculo, redactar un mensaje) y vuelve al negocio. No da asesoramiento legal ni financiero personalizado.",
  ]);

  d.section(1, "Consultas (solo lectura)", "Preguntas que responde al instante con datos del sistema.");
  d.card({
    title: "Resumen del día",
    body: "Arranque de jornada en una sola respuesta: alertas, contactos nuevos y en espera por vencer, seguimientos vencidos, agenda de hoy, objetivos en riesgo, estado de portales y cupo de ZonaProp, cuotas de alquiler vencidas (admin).",
    examples: ["¿Qué hay hoy?", "Dame el resumen del día", "¿Cómo venimos?", "Novedades"],
  });
  d.card({
    title: "Propiedades",
    body: "Busca por dirección, código, ciudad/zona, tipo, operación o estado. Devuelve precio, ambientes, superficie y en qué portales está publicada.",
    examples: ["¿Cuántas propiedades activas en venta tenemos en Bernal?", "Buscame Uriburu 1734", "¿Qué precio tiene JAP9086827?", "¿Dónde está publicada Alvear 1160?"],
  });
  d.card({
    title: "Contactos (central de mensajes)",
    body: "Consultas que llegaron por ZonaProp, ArgenProp y MercadoLibre, con estado (nuevo, tomado, en espera, descartado), quién los atiende y conteos por portal. Podés filtrar por nombre, teléfono o propiedad.",
    examples: ["¿Cuántos contactos nuevos hay?", "¿Qué consultas entraron de ZonaProp?", "¿Quién tomó el contacto de Saavedra 278?", "Buscame el contacto de Juan Pérez"],
  });
  d.card({
    title: "Estado de portales y cupo",
    body: "Conexión de ZonaProp / ArgenProp / MercadoLibre, cupo de créditos de ZonaProp por plan y publicaciones por estado. Si el cupo está bajo, avisa aunque no lo preguntes.",
    examples: ["¿Cuánto cupo de ZonaProp queda?", "¿Están conectados los portales?", "¿Cuántas publicaciones activas hay en ArgenProp?"],
  });
  d.card({
    title: "Seguimientos",
    body: "Seguimientos abiertos por propiedad y responsable; sólo los vencidos si lo pedís.",
    examples: ["¿Qué seguimientos vencidos tengo?", "Seguimientos de Valentina", "¿Qué hay pendiente sobre Mitre 1200?"],
  });
  d.card({
    title: "Objetivos",
    body: "Tarjetas de objetivos vigentes (o históricas) con progreso de items, por persona.",
    examples: ["¿Cómo van los objetivos de esta semana?", "Objetivos de Gonzalo", "¿Qué items me faltan?"],
  });
  d.card({
    title: "Agenda",
    chips: [{ label: "admin: todos", tone: "olive" }],
    body: "Visitas y eventos en un rango (por defecto hoy a 7 días). Empleado: los suyos; admin: los de todo el equipo o de alguien puntual.",
    examples: ["¿Qué visitas tengo mañana?", "Agenda de la semana", "¿Qué tiene agendado Juliana el viernes?"],
  });
  d.card({
    title: "Clientes",
    body: "Busca por nombre, teléfono o email. Trae datos, link de WhatsApp, visitas, contactos tomados y seguimientos vinculados.",
    examples: ["Buscame al cliente Juan Pérez", "¿Tenemos algún cliente con el 11 3521 4585?", "Historial de María González"],
  });
  d.card({
    title: "Tasaciones",
    body: "Lista o busca tasaciones por dirección y estado, con responsable y link a cada una.",
    examples: ["¿Qué tasaciones hay en curso?", "Tasación de Matienzo 261"],
  });
  d.card({
    title: "Alquileres",
    body: "Tres vistas: contratos vigentes por vencer, cuotas vencidas / parciales / a vencer (con estado real según pagos y días de gracia) y cobros del mes con comisión y neto a propietarios.",
    examples: ["¿Qué contratos vencen en los próximos 60 días?", "¿Qué cuotas están vencidas?", "¿Cuánto cobramos en agosto?"],
  });
  d.card({
    title: "Ficha de propiedad (PDF)",
    body: "Link a la ficha PDF de una propiedad y a la ficha para el dueño (con los comentarios ya cargados).",
    examples: ["Dame la ficha de Uriburu 1734 piso 3 B", "Ficha para el dueño de JAP9086827"],
  });
  d.card({
    title: "Reporte de desempeño (PDF)",
    chips: [{ label: "admin: cualquiera · empleado: el propio", tone: "olive" }],
    body: "Reporte por empleado y período: objetivos y estado de cada item, visitas, seguimientos, contactos tomados, clientes nuevos y KPIs. Te resume lo principal y te da el link al PDF. Te pregunta desde/hasta si no lo dijiste.",
    examples: ["Armame mi reporte de agosto", "Reporte de Valentina del 1 al 31 de julio"],
  });

  d.section(2, "Acciones (con confirmación)", "Modifican datos. El bot te dice qué va a hacer y espera tu sí/no.");
  const conf = { label: "pide confirmación", tone: "accent" as const };
  d.card({
    title: "Tomar / esperar / transferir un contacto",
    chips: [conf],
    body: "Sobre un contacto de la central de mensajes: tomarlo (crea o reusa el cliente y abre un seguimiento a tu nombre), pasarlo a espera (se descarta solo a los 3 días), restaurarlo a nuevos o transferirlo a otro usuario. Si ya lo tomó otro, te lo dice.",
    examples: ["Tomá el contacto de Juan Pérez por Uriburu 1734", "Pasá a espera la consulta de ZonaProp de Alvear 1160", "Transferile a Valentina el contacto de María"],
  });
  d.card({
    title: "Crear objetivo",
    chips: [conf],
    body: "Crea una tarjeta de objetivo con período, asignados e items (checklist). Te pide lo que falte antes de crear.",
    examples: ["Creale a Gonzalo un objetivo para esta semana: 5 visitas y 10 llamadas", "Objetivo mensual para todo el equipo: captar 3 propiedades"],
  });
  d.card({
    title: "Agendar visita / evento",
    chips: [conf],
    body: "Agenda visita, firma, tasación, entrega de llaves u otro, a tu nombre, con propiedad y cliente. Si tenés Google Calendar conectado, también lo crea ahí. Sin hora de fin, dura 1 hora.",
    examples: ["Agendame una visita mañana a las 15 en Mitre 1200 con Juan Pérez", "Firma el viernes 10:30 en la oficina"],
  });
  d.card({
    title: "Crear seguimiento",
    chips: [conf, { label: "admin: a cualquiera", tone: "olive" }],
    body: "Abre un seguimiento sobre una propiedad, con título, notas y vencimiento. Un empleado lo crea para sí mismo; un admin puede asignárselo a otro.",
    examples: ["Creame un seguimiento para llamar al dueño de Alvear 1160 el lunes", "Asignale a Valentina un seguimiento de Saavedra 278"],
  });
  d.card({
    title: "Registrar acción de seguimiento",
    chips: [conf],
    body: "Anota una visita realizada, llamada, mensaje o nota en el seguimiento abierto de una propiedad; opcionalmente lo cierra como hecho.",
    examples: ["Anotá que hice la visita de Uriburu 1734 3º B con la familia López", "Llamé al dueño de Alsina 120, no atendió", "Cerrá el seguimiento de Mitre 1200, ya está hecho"],
  });
  d.card({
    title: "Crear cliente",
    chips: [conf],
    body: "Da de alta un cliente con nombre, teléfono, email y notas. Si ya existe uno con ese teléfono/email, te avisa y pregunta antes de duplicar.",
    examples: ["Cargá al cliente Juan Pérez, 11 3521 4585", "Nuevo cliente: María González, maria@gmail.com"],
  });
  d.card({
    title: "Iniciar tasación",
    chips: [conf],
    body: "Crea una tasación en borrador a tu nombre (se completa desde la web) y te da el link.",
    examples: ["Iniciá una tasación de Rivadavia 500", "Arrancá la tasación de JAP8721249"],
  });
  d.card({
    title: "Pausar / dar de baja / reactivar un aviso",
    chips: [conf],
    body: "Cambia el estado de una publicación ya existente en ZonaProp, ArgenProp o MercadoLibre. Primero identifica la propiedad y te explica qué implica en ese portal. ZonaProp y ArgenProp los aplica el worker en unos minutos; MercadoLibre es inmediato.",
    examples: ["Pausá en ZonaProp el aviso de Uriburu 1734 piso 1 B", "Reactivá en MercadoLibre JAP9086827", "Dá de baja Alvear 1160 en ArgenProp"],
    note: "ZonaProp: “pausar” finaliza el aviso (queda offline) y “reactivar” lo republica con un plan (usa cupo); “dar de baja” lo archiva y para volver hay que publicarlo de nuevo. MercadoLibre: dar de baja es irreversible.",
  });
  d.card({
    title: "Publicar en un portal",
    chips: [conf],
    body: "ZonaProp (con plan Simple / Destacado / Súper Destacado) y ArgenProp: encola la publicación y el worker la procesa en minutos. MercadoLibre: publica al instante infiriendo categoría, características, ubicación y fotos desde la propiedad; si le falta algo (una característica obligatoria, la ciudad, o no hay publicación gratuita) te lo pregunta antes.",
    examples: ["Publicá Mitre 1200 en ArgenProp", "Publicá JAP8721249 en ZonaProp con plan Destacado", "Publicá Alvear 1160 en MercadoLibre"],
    note: "En MercadoLibre nunca elige una publicación paga por su cuenta: si no hay gratuita, te muestra las opciones con su costo y vos decidís. Si a la propiedad le faltan datos obligatorios (provincia, localidad, precio, una foto), te los pide antes de publicar.",
  });
  d.card({
    title: "Sincronizar avisos",
    chips: [conf],
    body: "Después de editar precio, título o descripción, actualiza los avisos ya publicados con los datos actuales: MercadoLibre al instante y ZonaProp vía worker. Podés sincronizar un portal o todos.",
    examples: ["Sincronizá los avisos de Uriburu 1734 3º B", "Actualizá el aviso de MercadoLibre de JAP9086827"],
    note: "ArgenProp no se re-sincroniza desde el sistema: se edita en Gestión de ArgenProp.",
  });
  d.card({
    title: "Editar propiedad",
    chips: [conf],
    body: "Cambia precio, moneda, estado (activa/vendida/alquilada/suspendida), título de publicación o descripción. Después te ofrece sincronizar los avisos.",
    examples: ["Bajá el precio de Uriburu 1734 3º B a 650.000", "Marcá Alvear 1160 como alquilada", "Cambiale la descripción a JAP9086827: …"],
  });
  d.card({
    title: "Ficha para el dueño con comentarios",
    chips: [conf],
    body: "Guarda visitas totales, visitas del mes, quejas/observaciones y mejoras/sugerencias, y te da el link al PDF para el dueño.",
    examples: ["Armá la ficha del dueño de Uriburu 1734 3º B: 12 visitas totales, 4 este mes, se quejan del precio, sugerir pintar"],
  });
  d.card({
    title: "Registrar pago de alquiler",
    chips: [conf],
    body: "Registra el cobro de una cuota (por propiedad + mes, o eligiendo la cuota) con monto, comisión y método; genera el recibo PDF con número correlativo, igual que desde la web.",
    examples: ["Registrá el pago de septiembre de Abril Lote 0: 220.000, comisión 22.000, transferencia", "Cobré la cuota vencida de Alsina 120, 310.000 en efectivo"],
    note: "Antes de confirmar revisá propiedad, inquilino, cuota y montos: el número de recibo no se reutiliza.",
  });
  d.card({
    title: "Eliminar",
    chips: [conf, { label: "irreversible", tone: "terra" }],
    body: "Borra una propiedad, un cliente, un seguimiento (sólo admin) o una tasación, con los mismos permisos que la web. Te repite qué va a borrar y espera tu confirmación explícita.",
    examples: ["Borrá la propiedad JAP8692505", "Eliminá al cliente duplicado Juan Perez (el sin teléfono)", "Borrá la tasación de prueba de Rivadavia 500"],
    note: "Si la propiedad tiene avisos activos en portales, primero te propone darlos de baja; sólo si insistís la borra igual.",
  });

  d.section(3, "Lo que NO hace (y dónde se hace)", "Límites que quedan del lado humano.");
  d.bullets([
    "No reconecta portales: si una sesión se cayó, el sistema intenta solo (ZonaProp, 2 intentos) y si no, botón Reconectar en Propiedades -> Portales (la contraseña nunca pasa por el chat).",
    "No re-sincroniza avisos de ArgenProp: se editan en Gestión de ArgenProp.",
    "No reactiva un aviso archivado de ZonaProp ni uno cerrado de MercadoLibre: hay que publicarlo de nuevo.",
    "No carga ni edita fotos: Propiedades -> editar -> pestaña Fotos (arrastrá y soltá).",
    "No da asesoramiento legal, contable ni financiero personalizado.",
  ]);

  d.section(4, "Ejemplos de conversación", "Cómo se ve una interacción típica.");
  d.chat("Pausar un aviso (con confirmación)", [
    { who: "VOS", text: "Pausá en ZonaProp el aviso de Uriburu 1734 piso 1 B" },
    { who: "BOT", text: "Encontré Uriburu 1734 Piso 1 Departamento B (JAP8721249), con aviso activo en ZonaProp. Pausar lo finaliza: queda offline y para volver hay que republicarlo (usa cupo). ¿Confirmás?" },
    { who: "VOS", text: "Sí" },
    { who: "BOT", text: "Listo, baja temporal encolada; el worker la aplica en unos minutos." },
  ]);
  d.chat("Publicar en MercadoLibre (el bot pregunta lo que falta)", [
    { who: "VOS", text: "Publicá Alvear 1160 en MercadoLibre" },
    { who: "BOT", text: "Alvear 1160 (JAP9086827): categoría Departamentos · Venta, 8 fotos, USD 120.000. Falta la característica obligatoria Antigüedad. ¿Cuántos años tiene?" },
    { who: "VOS", text: "15" },
    { who: "BOT", text: "Voy a publicarla con publicación gratuita. ¿Confirmás?" },
    { who: "VOS", text: "Sí" },
    { who: "BOT", text: "Publicada en MercadoLibre (active): https://departamento.mercadolibre.com.ar/MLA-…" },
  ]);
  d.chat("Tomar un contacto", [
    { who: "VOS", text: "Tomá el contacto de Juan Pérez por Uriburu 1734" },
    { who: "BOT", text: "Juan Pérez consultó por ZonaProp sobre Uriburu 1734 Piso 3 B. Lo tomo a tu nombre: se crea el cliente y un seguimiento. ¿Confirmás?" },
    { who: "VOS", text: "Dale" },
    { who: "BOT", text: "Tomado: cliente creado y seguimiento asignado a vos." },
  ]);
  d.chat("Propiedad ambigua", [
    { who: "VOS", text: "Dame la ficha de Uriburu 1734" },
    { who: "BOT", text: "Hay 5 unidades en Uriburu 1734: piso 0 PB, piso 1 A, piso 1 B, piso 3 B y piso 5 A. ¿Cuál querés?" },
    { who: "VOS", text: "La del 3º B" },
    { who: "BOT", text: "Acá está la ficha de Uriburu 1734 Piso 3º Departamento B: https://…/api/propiedades/…/pdf" },
  ]);
  d.chat("Arranque del día", [
    { who: "VOS", text: "¿Qué hay hoy?" },
    { who: "BOT", text: "Alertas: 270 contactos nuevos sin tomar, 1 seguimiento vencido (Montevideo 1082) y 6 cuotas de alquiler vencidas. Hoy no tenés visitas. Portales conectados; cupo de ZonaProp: Simple 9/200, Destacado 13/40, Súper Destacado 10/40. ¿Te traigo las cuotas vencidas?" },
  ]);

  d.section(5, "Consejos", "Para sacarle más jugo.");
  d.bullets([
    "Sé concreto con la propiedad: “Uriburu 1734 3º B” resuelve directo; “Uriburu 1734” te va a preguntar cuál.",
    "Para acciones, dale todo en una frase (qué, dónde, cuándo, con quién) y el bot sólo te pide lo que falte.",
    "Si te muestra una URL, abrila desde el mismo chat: ya va con tu sesión.",
    "Antes de confirmar un borrado o una publicación paga, leé bien lo que el bot repite: es lo que va a pasar.",
    "Si algo no lo puede hacer, te dice desde qué pantalla se hace. Si te lo dice mal, avisá: se corrige en el conocimiento del bot.",
  ]);

  d.footers();
  const out = path.join(process.cwd(), "public/docs/asistente-ia-casos-de-uso.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await pdf.save());
  console.log(`✓ ${out} (${d.pages.length} páginas)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
