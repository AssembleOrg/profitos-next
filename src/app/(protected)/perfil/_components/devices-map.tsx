"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  active: boolean;
  current: boolean;
}

function FitBounds({ points }: Readonly<{ points: MapPoint[] }>) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [28, 28], maxZoom: 14 });
  }, [map, points]);
  return null;
}

/** Mapa de desde dónde se entró. Dorado = este dispositivo, oscuro = abierta, gris = cerrada. */
export function DevicesMap({ points }: Readonly<{ points: MapPoint[] }>) {
  return (
    <div className="isolate overflow-hidden rounded-2xl border border-border">
      <MapContainer center={[-34.72, -58.26]} zoom={12} className="h-[220px] w-full md:h-[260px]" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.current ? 9 : 7}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillOpacity: 0.95,
              fillColor: p.current ? "#C6A15B" : p.active ? "#1B1916" : "#8E897D",
            }}
          >
            <Tooltip>{p.label}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
