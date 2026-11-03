"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/** Radio del área: cubre el redondeo de la coordenada, que no se publica exacta. */
const AREA_RADIUS_METERS = 200;
/** Cartografía oficial del IGN: nomenclatura argentina, Islas Malvinas incluidas. */
const TILES = "https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/mapabase_gris@EPSG%3A3857@png/{z}/{x}/{y}.png";

export function ZoneMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((module) => {
      const L = module.default;
      if (cancelled || !container.current) return;
      const touch = window.matchMedia("(pointer: coarse)").matches;
      map = L.map(container.current, {
        center: [lat, lng],
        zoom: 15,
        minZoom: 12,
        maxZoom: 18,
        scrollWheelZoom: false,
        // En el celular un dedo mueve la página, no el mapa.
        dragging: !touch,
        attributionControl: false,
      });
      L.control.attribution({ prefix: false }).addAttribution('<a href="https://www.ign.gob.ar/" target="_blank" rel="noreferrer">Argenmap · IGN</a>').addTo(map);
      let errors = 0;
      let loaded = 0;
      L.tileLayer(TILES, { tms: true, maxNativeZoom: 18, maxZoom: 18 })
        .on("tileload", () => { loaded += 1; })
        .on("tileerror", () => {
          errors += 1;
          if (errors >= 4 && loaded === 0) setFailed(true);
        })
        .addTo(map);
      L.circle([lat, lng], { radius: AREA_RADIUS_METERS, color: "#000", weight: 2, fillColor: "#000", fillOpacity: 0.1, interactive: false }).addTo(map);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  return (
    <div className="jw-map" role="img" aria-label={title}>
      <div ref={container} className="jw-map-canvas" />
      {failed && <p className="jw-map-error">El mapa no está disponible en este momento.</p>}
    </div>
  );
}
