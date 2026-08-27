-- Renombra la capa de datos "tokko" a nombres neutros (fuente-agnósticos).
-- RENAME COLUMN preserva los datos existentes. Idempotente (IF EXISTS).

-- jp_propiedades -----------------------------------------------------------
ALTER TABLE jp_propiedades RENAME COLUMN tokko_id TO external_id;
ALTER TABLE jp_propiedades RENAME COLUMN tokko_created_at TO external_created_at;
ALTER TABLE jp_propiedades RENAME COLUMN tokko_updated_at TO external_updated_at;
ALTER INDEX IF EXISTS jp_propiedades_tokko_id_key RENAME TO jp_propiedades_external_id_key;

-- jp_ultimos_contactos -----------------------------------------------------
ALTER TABLE jp_ultimos_contactos RENAME COLUMN tokko_contact_id TO external_id;
ALTER TABLE jp_ultimos_contactos RENAME COLUMN tokko_created_at TO external_created_at;
ALTER TABLE jp_ultimos_contactos RENAME COLUMN tokko_deleted_at TO external_deleted_at;
ALTER INDEX IF EXISTS jp_ultimos_contactos_tokko_contact_id_key RENAME TO jp_ultimos_contactos_external_id_key;

-- source: default y datos existentes 'tokko' -> 'legacy'
ALTER TABLE jp_ultimos_contactos ALTER COLUMN source SET DEFAULT 'legacy';
UPDATE jp_ultimos_contactos SET source = 'legacy' WHERE source = 'tokko';

-- jp_integration_sync_states: clave 'tokko_contacts' -> 'recent_contacts'
UPDATE jp_integration_sync_states SET integration_key = 'recent_contacts' WHERE integration_key = 'tokko_contacts';
