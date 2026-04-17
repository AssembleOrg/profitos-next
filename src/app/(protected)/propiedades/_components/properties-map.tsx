"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons in webpack/next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapProperty {
  id: string;
  address: string;
  geoLat: number;
  geoLong: number;
  operationType?: string | null;
  operationPrice?: number | null;
  operationCurrency?: string | null;
  type?: string | null;
  status?: string;
}

interface PropertiesMapProps {
  properties: MapProperty[];
}

// Buenos Aires area default center
const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];
const DEFAULT_ZOOM = 11;

export function PropertiesMap({ properties }: PropertiesMapProps) {
  const center: [number, number] =
    properties.length > 0
      ? [
          properties.reduce((sum, p) => sum + p.geoLat, 0) / properties.length,
          properties.reduce((sum, p) => sum + p.geoLong, 0) / properties.length,
        ]
      : DEFAULT_CENTER;

  const zoom = properties.length > 0 ? DEFAULT_ZOOM : DEFAULT_ZOOM;

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-[500px] w-full sm:h-[600px]"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties.map((p) => (
          <Marker key={p.id} position={[p.geoLat, p.geoLong]} icon={defaultIcon}>
            <Popup>
              <div className="min-w-[200px]">
                <p className="font-semibold text-gray-900">{p.address}</p>
                {p.operationPrice && (
                  <p className="mt-1 text-sm text-gray-600">
                    {p.operationCurrency ?? "USD"} {p.operationPrice.toLocaleString("es-AR")}
                  </p>
                )}
                {(p.type || p.operationType) && (
                  <p className="text-sm text-gray-500">
                    {p.type}{p.operationType ? ` · ${p.operationType}` : ""}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {properties.length === 0 && (
        <div className="flex h-20 items-center justify-center bg-surface text-sm text-text-muted">
          No hay propiedades con ubicación para mostrar en el mapa
        </div>
      )}
    </div>
  );
}
