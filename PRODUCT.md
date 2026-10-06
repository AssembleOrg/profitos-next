# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Equipo de la inmobiliaria** (Juliana Profitos, dueña, y empleados). Trabajan en la compu de la oficina, pero el celular es igual de importante: cargan cobros, miran vencimientos y emiten recibos desde el teléfono. Hoy llevan los alquileres en una planilla de Excel con una hoja por propiedad administrada y llenan recibos en talonarios de papel.
- **Inquilinos (clientes)**. Entran a un portal propio con email y contraseña para subir comprobantes de servicios pagados, descargar los recibos PDF de sus pagos, ver cuándo vence cada pago y enterarse de los próximos aumentos. Uso mayormente desde el celular.
- **Propietarios (locadores)** no usan el sistema; reciben el recibo de propietario.

## Product Purpose

Sistema interno de Juliana Profitos Propiedades (Quilmes). El módulo de alquileres reemplaza la planilla y el talonario: legajo de cada contrato con sus condiciones, cobro mensual, recibos numerados para inquilino y propietario, avisos de aumento y portal para inquilinos. Éxito: el equipo cobra, emite recibos y sabe qué alquiler hay que aumentar sin abrir Excel ni escribir a mano.

## Operating Context

- Cada cobro produce dos recibos: al inquilino ("Recibo por cuenta de terceros": por mandato del locador se recibe del locatario) con alquiler + municipal + servicios = total; y al propietario ("Recibo") con el mismo total menos honorarios de administración.
- Talonario físico actual: numeración `0001-0000xxxx`, conceptos alquiler, impuestos municipales (período), AySA, Edesur, Metrogas, honorarios, otros, punitorios; pesos o dólares; fecha; firma y aclaración.
- Condiciones distintas por contrato (acuerdo entre partes): algunos pagan alquiler + servicios, otros solo alquiler; el municipal a veces lo paga el propietario y se le cobra al inquilino.
- Aumentos: cada N meses según un concepto (IPC, etc.). Si el índice sale después del vencimiento (el IPC sale el día 10), se cobra el alquiler normal y la diferencia después, anotada en el recibo.
- Notas libres en recibos (ej. "abona diferencia de aumento en noviembre", seguro aparte).

## Capabilities and Constraints

- Solo alquiler tradicional (mensual). Los contratos temporales existentes se conservan y se ven, pero no se crean nuevos.
- Honorarios en %: por defecto 5%, editable por contrato y por mes; cada pago guarda el % y el monto aplicados.
- Recibos: talonario con número inicial configurable, correlativo automático, número editable por recibo y posibilidad de anular números.
- Legajo: propiedad (ya cargadas en el sistema), inquilino (DNI/CUIT, referencia/nota), monto, cláusula de aumento (cada cuánto, concepto, monto nuevo lo pone la admin a mano, sin validaciones), servicios que paga, garantía, anticipo/depósito.
- Día a día: fecha de pago, si pagó, si pagó servicios, si subió comprobantes; marcar pagado lo suma a la caja y genera el PDF.
- Datos existentes en producción se conservan: cambios de base solo aditivos (SQL manual idempotente en `prisma/migrations`, schema `profitos`, tablas `jp_*`).
- Staff entra con Google (lista blanca); inquilinos con email y contraseña, separados del staff.
- No hay entidad propietario todavía; no hay envío de emails ni WhatsApp API (solo links `wa.me`).

## Brand Commitments

- Juliana Profitos Propiedades · Col. 1011 · CUIT 27-38698130-8 · Mitre 913, Quilmes · Tel. 11 5385 4029 · profitospropiedades@gmail.com · www.jprofitospropiedades.com.ar.
- Sistema visual V4 "Cálido Expresivo" (`docs/V4-STYLE-GUIDE.md`, tokens en `globals.css`).

## Evidence on Hand

- Planilla Excel de ejemplo y fotos de ambos talonarios; video explicativo transcripto (fuera del repo, en `~/Pistech/profitos/contexto/`).

## Product Principles

1. Cada contrato es un acuerdo propio: las condiciones se configuran, no se asumen.
2. Lo que hoy se escribe a mano (recibo, número, total, honorarios) lo calcula el sistema y la persona solo corrige.
3. Nada se pierde: lo cobrado, lo emitido y lo anulado queda registrado.
4. El celular es tan importante como la compu.
