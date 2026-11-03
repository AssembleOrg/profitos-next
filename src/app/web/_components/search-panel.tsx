"use client";

import { useState } from "react";
import { WEB_BASE } from "@/lib/web/format";
import { IconSearch } from "./icons";
import { Select } from "./select";

const ROOMS = [
  { value: "", label: "Todos" },
  { value: "1", label: "1 ambiente" },
  { value: "2", label: "2 ambientes" },
  { value: "3", label: "3 ambientes" },
  { value: "4", label: "4 ambientes" },
  { value: "5", label: "5 o más" },
];

export function SearchPanel({ types, zones }: { types: string[]; zones: string[] }) {
  const [op, setOp] = useState<"venta" | "alquiler">("venta");
  return (
    <form className="jw-search" action={`${WEB_BASE}/propiedades`} role="search" aria-label="Buscar propiedades">
      <input type="hidden" name="op" value={op} />
      <div className="jw-seg" role="group" aria-label="Operación">
        <button type="button" aria-pressed={op === "venta"} onClick={() => setOp("venta")}>Comprar</button>
        <button type="button" aria-pressed={op === "alquiler"} onClick={() => setOp("alquiler")}>Alquilar</button>
      </div>
      <div className="jw-search-fields">
        <Select name="tipo" label="Tipo" options={[{ value: "", label: "Todos" }, ...types.map((type) => ({ value: type, label: type }))]} />
        <Select name="zona" label="Zona" options={[{ value: "", label: "Todas" }, ...zones.map((zone) => ({ value: zone, label: zone }))]} />
        <Select name="amb" label="Ambientes" options={ROOMS} />
      </div>
      <button type="submit" className="jw-btn jw-btn-primary"><IconSearch /> Buscar</button>
    </form>
  );
}
