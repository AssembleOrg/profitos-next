"use client";

import { useEffect } from "react";

/**
 * Pide la ubicación UNA vez por sesión, al entrar desde un dispositivo, para
 * mostrar en "Mi perfil → Dispositivos" desde dónde se entró. No es
 * seguimiento: con la ubicación (o el "no") guardada no se vuelve a pedir.
 */
export function SessionLocationOnce({ sessionId }: Readonly<{ sessionId: string }>) {
  useEffect(() => {
    const key = `profitos:ubicacion:${sessionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sin storage: igual se pide una vez por carga
    }
    if (!("geolocation" in navigator)) return;

    const send = (body: unknown) =>
      fetch("/api/perfil/sesiones/ubicacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => undefined);

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        send({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) send({ denied: true });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  }, [sessionId]);

  return null;
}
