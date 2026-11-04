"use client";

import { useEffect } from "react";
import { sendEvent, sessionId } from "./tracker";

const KEYS = ["op", "tipo", "zona", "amb", "dorm", "moneda", "min", "max", "sup", "orden"];

/** Una búsqueda cuenta una vez por sesión: volver atrás o paginar no la repite. */
export function TrackSearch({ values, results }: { values: Record<string, string | undefined>; results: number }) {
  const signature = JSON.stringify([...KEYS, "q"].map((key) => values[key] ?? ""));

  useEffect(() => {
    const parsed = JSON.parse(signature) as string[];
    if (values.ids || parsed.every((value) => !value)) return;
    const filters = Object.fromEntries(KEYS.map((key, index) => [key, parsed[index]]).filter(([, value]) => value));
    const query = parsed[KEYS.length] || undefined;
    let hash = 0;
    for (const char of signature) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    sendEvent({ id: `search-${sessionId()}-${(hash >>> 0).toString(36)}`, type: "search", path: location.pathname + location.search, filters, query, resultsCount: results });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la firma ya resume los filtros.
  }, [signature, results]);

  return null;
}
