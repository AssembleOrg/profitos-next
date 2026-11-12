# A futuro: web pública (leads y marketing)

Ideas para que la web capte más consultas. Todas necesitan backend, por eso quedan para más adelante. Los tiempos son aproximados, para una persona.

## 1. Guardar cada consulta (1 a 2 días) · base de las demás

**Hoy:** los formularios y los botones de WhatsApp solo abren `wa.me`. La consulta no queda registrada en ningún lado. El hueco ya está anotado en `src/app/web/_components/whatsapp-form.tsx`.

**Propuesta:** antes de abrir WhatsApp, se hace un `POST /web/consulta` que crea el caso en el back-office:
- consulta por una propiedad → **Contactos** (`ContactCase`);
- pedido de tasación → **Tasaciones** (`Tasacion`).

Cada caso guarda nombre, teléfono, mensaje, la propiedad, el origen (UTM, referrer) y el `visitorId` que ya genera `src/app/web/actividad`.

**Qué toca:**
- la ruta nueva, con `isSameOrigin` y un límite de pedidos por IP o visitante;
- `whatsapp-form.tsx` y los botones de WhatsApp de la ficha.

**Cuidado:** si la API falla, igual tiene que abrirse WhatsApp. Nunca se puede perder la consulta por un error del servidor.

## 2. "¿Cuánto vale tu propiedad?" (3 a 5 días)

Tasador en 3 pasos (zona → tipo y m² → ambientes) que muestra un **rango orientativo**. Para ver el detalle pide nombre y teléfono, y el lead cae en Tasaciones.

**Datos:** precio por m² de las propiedades **publicadas** del catálogo (`getCatalog()`: `price`, `surface`, `zone`, `type`), con una cantidad mínima de muestras por zona y tipo. Si no alcanzan, no se muestra ningún número: solo "te lo calculamos nosotros".

**Cuidado:** son precios de publicación, no de cierre, y no hay que inventar nada. Hay que decidir si el rango se muestra con esa aclaración o si lo confirma una persona antes de que el visitante lo vea.

## 3. Agendar visita (3 a 4 días)

En la ficha: elegir un día y una franja horaria (mañana o tarde). Cae como pendiente en la **Agenda** del equipo y se confirma a mano por WhatsApp. No hay envío automático, porque no hay API de WhatsApp ni de email.

**Qué toca:** depende de la idea 1 para guardar el pedido, más la integración con el módulo de Agenda.

## 4. Calculadora de cuota UVA (1 a 2 días)

En las propiedades en venta: anticipo + plazo → cuota estimada y sueldo necesario. Termina con "Te asesoramos" por WhatsApp.

- La tasa y la relación cuota/ingreso son constantes editables en el código, con la fecha de la última actualización a la vista.
- La pantalla sola no necesita backend. Guardar el lead depende de la idea 1.

---

## Hecho en esta tanda (solo pantalla)

- Cifras que cuentan desde 0 al aparecer: accesos por tipo, una franja de números del catálogo en la home, "N resultados" en el listado y datos destacados de la ficha (`_components/count-up.tsx`).
- Aparición al bajar, solo con CSS (`animation-timeline`) y respetando "reducir movimiento".
- Vista **Mapa** en el listado (`?vista=mapa`, `_components/listing-map.tsx`), con la coordenada redondeada que ya se publicaba en la ficha.
- Galería a pantalla completa con miniaturas en la compu.
