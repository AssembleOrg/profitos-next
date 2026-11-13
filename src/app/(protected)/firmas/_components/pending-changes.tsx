"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Guarda un bloque; devuelve false si no se pudo (validación o error). */
export type SaveFn = () => Promise<boolean>;

interface PendingRegistry {
  register: (key: string, save: SaveFn | null) => void;
}

const PendingContext = createContext<PendingRegistry | null>(null);

/**
 * Cambios sin guardar del detalle de una firma: cada bloque editable avisa si
 * tiene algo pendiente, y el pie puede guardar todo junto o frenar el cierre.
 */
export function usePendingChanges() {
  const savers = useRef(new Map<string, SaveFn>());
  const [count, setCount] = useState(0);

  const register = useCallback((key: string, save: SaveFn | null) => {
    if (save) savers.current.set(key, save);
    else savers.current.delete(key);
    setCount(savers.current.size);
  }, []);

  const saveAll = useCallback(async () => {
    for (const save of [...savers.current.values()]) {
      if (!(await save())) return false;
    }
    return true;
  }, []);

  const registry = useMemo<PendingRegistry>(() => ({ register }), [register]);
  return { dirty: count > 0, saveAll, registry };
}

export function PendingProvider({ registry, children }: Readonly<{ registry: PendingRegistry; children: ReactNode }>) {
  return <PendingContext.Provider value={registry}>{children}</PendingContext.Provider>;
}

/** Un bloque se anota como pendiente mientras `dirty` sea true. */
export function useRegisterPending(key: string, dirty: boolean, save: SaveFn) {
  const registry = useContext(PendingContext);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const stable = useCallback(() => saveRef.current(), []);
  useEffect(() => {
    registry?.register(key, dirty ? stable : null);
  }, [registry, key, dirty, stable]);
  useEffect(() => () => registry?.register(key, null), [registry, key]);
}
