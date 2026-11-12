"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { formatPrice, formatPriceShort } from "@/lib/web/format";
import { track } from "./tracker";

export type MapPin = {
  key: string;
  href: string;
  title: string;
  meta: string;
  price: number | null;
  /** Precio "desde" cuando el pin agrupa varias unidades del mismo edificio. */
  fromPrice: number | null;
  currency: string | null;
  cover: string | null;
  /** Ya redondeada en el catálogo: no es la ubicación exacta. */
  lat: number;
  lng: number;
};

/** Misma cartografía que el mapa de la ficha (zone-map). */
const TILES = "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{y}.png";
const QUILMES: [number, number] = [-34.72, -58.26];
/** Lejos se ven puntos; desde este zoom, la pastilla con el precio (si no, 190 precios se pisan). */
const PRICE_ZOOM = 15;

/** Encuadre: el núcleo alrededor de la mediana, para que una propiedad en la costa no aleje todo el mapa. */
function core(pins: MapPin[]): MapPin[] {
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const lat = median(pins.map((pin) => pin.lat));
  const lng = median(pins.map((pin) => pin.lng));
  const near = pins.filter((pin) => Math.abs(pin.lat - lat) < 0.25 && Math.abs(pin.lng - lng) < 0.25);
  return near.length ? near : pins;
}

/** Los textos vienen de la base: se arma con textContent, nunca con HTML. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function popup(pin: MapPin): HTMLElement {
  const link = el("a", "jw-pin-card");
  link.href = pin.href;
  if (pin.cover) {
    const img = el("img", "");
    img.src = pin.cover;
    img.alt = "";
    link.append(img);
  }
  const body = el("span", "jw-pin-card-body");
  const price = pin.fromPrice ? `Desde ${formatPrice(pin.fromPrice, pin.currency)}` : formatPrice(pin.price, pin.currency);
  body.append(el("strong", "", price), el("span", "", pin.title), el("small", "", pin.meta));
  link.append(body);
  link.addEventListener("click", () => track("map_open", { label: pin.key }));
  return link;
}

export function ListingMap({ pins }: { pins: MapPin[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((module) => {
      const L = module.default;
      if (cancelled || !container.current) return;
      leaflet.current = L;
      map.current = L.map(container.current, { center: QUILMES, zoom: 13, minZoom: 7, maxZoom: 18, scrollWheelZoom: false, attributionControl: false });
      L.control.attribution({ prefix: false }).addAttribution('<a href="https://www.ign.gob.ar/" target="_blank" rel="noreferrer">Argenmap · IGN</a>').addTo(map.current);
      let errors = 0;
      let loaded = 0;
      L.tileLayer(TILES, { tms: true, maxNativeZoom: 18, maxZoom: 18 })
        .on("tileload", () => { loaded += 1; })
        .on("tileerror", () => {
          errors += 1;
          if (errors >= 4 && loaded === 0) setFailed(true);
        })
        .addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      const shell = container.current.parentElement;
      const syncZoom = () => shell?.setAttribute("data-far", String((map.current?.getZoom() ?? 0) < PRICE_ZOOM));
      map.current.on("zoomend", syncZoom);
      syncZoom();
      track("map_view", { label: "listado" });
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Los pines se redibujan cuando cambian los filtros, sin volver a crear el mapa.
  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    for (const pin of pins) {
      const label = pin.fromPrice ? formatPriceShort(pin.fromPrice, pin.currency) : formatPriceShort(pin.price, pin.currency);
      // Sin tamaño fijo: la pastilla mide lo que su texto, centrada arriba del punto (ver .jw-pin en web.css).
      const icon = L.divIcon({ className: "jw-pin", html: el("span", "", label), iconSize: undefined, iconAnchor: [0, 0], popupAnchor: [0, -30] });
      L.marker([pin.lat, pin.lng], { icon, title: `${pin.title}, ${label}`, riseOnHover: true })
        .bindPopup(() => popup(pin), { closeButton: false, minWidth: 220, maxWidth: 260, className: "jw-pin-popup" })
        .addTo(layer.current);
    }
    if (pins.length) map.current.fitBounds(L.latLngBounds(core(pins).map((pin) => [pin.lat, pin.lng])), { padding: [48, 48], maxZoom: 16 });
  }, [pins, ready]);

  return (
    <div className="jw-map jw-map-list">
      <div ref={container} className="jw-map-canvas" />
      {failed && <p className="jw-map-error">El mapa no está disponible en este momento.</p>}
      {ready && pins.length === 0 && <p className="jw-map-error">Ninguna de estas propiedades tiene ubicación cargada.</p>}
    </div>
  );
}
