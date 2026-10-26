-- Avisos que cambiaron de estado SIN que el sistema lo pidiera (ej: Tokko o
-- MercadoLibre cerraron/pausaron un aviso de ML). Alimenta la alerta del equipo.
-- Idempotente.
ALTER TABLE profitos.jp_property_publications
  ADD COLUMN IF NOT EXISTS external_change_at timestamp(3),
  ADD COLUMN IF NOT EXISTS external_change_detail text;
