/**
 * Emprendimientos publicados en la web actual. Profitos todavía no tiene una
 * tabla para ellos: este listado es provisorio hasta sumarla al sistema.
 */
export type Development = {
  name: string;
  address: string;
  zone: string;
  /** Mes de entrega publicado, AAAA-MM. Si ya pasó no se muestra hasta confirmarlo. */
  deliveryMonth: string;
  summary: string;
  image: string;
  /** La imagen es un render de un edificio todavía sin terminar. */
  illustrative?: boolean;
};

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function deliveryLabel(item: Development, now = new Date()): string | null {
  const [year, month] = item.deliveryMonth.split("-").map(Number);
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return null;
  return `Entrega ${MONTHS[month - 1]} ${year}`;
}

export const DEVELOPMENTS: Development[] = [
  {
    name: "Anton 7",
    address: "Lavalle 1162",
    zone: "Quilmes",
    deliveryMonth: "2029-12",
    summary:
      "Unidades de 2, 3 y 4 ambientes y penthouses, con terraza propia y parrilla. Piscina, solarium, SUM, gimnasio, sauna y coworking.",
    image: "/web/emprendimientos/anton-7.jpg",
    illustrative: true,
  },
  {
    name: "Anton Chill",
    address: "Alvear 1160",
    zone: "Quilmes",
    deliveryMonth: "2028-01",
    summary:
      "Arquitectura contemporánea con amplias terrazas con parrilla y ventanales de piso a techo. Gimnasio, pileta, solarium y SUM.",
    image: "/web/emprendimientos/anton-chill.jpg",
    illustrative: true,
  },
  {
    name: "Mitre 1144 · Anton",
    address: "Mitre 1144",
    zone: "Quilmes",
    deliveryMonth: "2026-12",
    summary:
      "En pleno centro de Quilmes, a pocas cuadras de la Avenida Guido y con acceso rápido a la Autopista. Gimnasio, solarium, parrilla y SUM.",
    image: "/web/emprendimientos/mitre-1144.jpg",
  },
  {
    name: "Lavalle & Solís · Anton",
    address: "Lavalle 1102",
    zone: "Quilmes",
    deliveryMonth: "2026-01",
    summary:
      "Hall de doble altura y cocheras opcionales. Residencias de dos, tres y cuatro ambientes con balcones aterrazados y parrilla.",
    image: "/web/emprendimientos/lavalle-solis.jpg",
  },
  {
    name: "San Martín 870",
    address: "San Martín 870",
    zone: "Quilmes",
    deliveryMonth: "2024-12",
    summary:
      "Edificio terminado de diez niveles en Quilmes Centro, a metros de Av. Brandsen, con unidades funcionales de diseño moderno.",
    image: "/web/emprendimientos/san-martin-870.jpg",
  },
  {
    name: "Andrés Baranda 163",
    address: "Andrés Baranda 163",
    zone: "Quilmes Oeste",
    deliveryMonth: "2026-06",
    summary:
      "Departamentos de 2 ambientes semipisos sobre Andrés Baranda, con acceso rápido a los centros comerciales de Quilmes y Bernal.",
    image: "/web/emprendimientos/andres-baranda-163.jpg",
  },
];
