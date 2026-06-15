-- Adjuntos (notas de voz, imágenes, archivos) en todas las notas del sistema.
-- Columna jsonb nullable que guarda un array de { kind, path, name, size, mime }.
-- Los modelos de acción de firmas, vencimientos y pagos ya tenían attachments.

-- Notas de acción de seguimiento de propiedades
ALTER TABLE profitos.jp_followup_actions
  ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Notas de acción de seguimiento de consultas (ya tenía audio_url; sumamos attachments uniformes)
ALTER TABLE profitos.jp_contact_followup_actions
  ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Notas de cliente (contactos manuales)
ALTER TABLE profitos.jp_clientes
  ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Notas de inquilino
ALTER TABLE profitos.jp_tenants
  ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Notas de contrato de alquiler
ALTER TABLE profitos.jp_rental_contracts
  ADD COLUMN IF NOT EXISTS attachments jsonb;

-- Notas/descripción de visitas (agenda)
ALTER TABLE profitos.jp_visitas
  ADD COLUMN IF NOT EXISTS attachments jsonb;
