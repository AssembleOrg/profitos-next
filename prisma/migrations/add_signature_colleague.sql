-- Firmas: operación con colega (inmobiliaria + nombre + % de honorarios compartido).
-- Las propiedades en cartera de un colega se crean como ficha mínima con
-- source = 'colega' (no aparecen en Propiedades). Idempotente.
ALTER TABLE profitos.jp_signature_proposals
  ADD COLUMN IF NOT EXISTS with_colleague boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS colleague_agency_id text,
  ADD COLUMN IF NOT EXISTS colleague_name text,
  ADD COLUMN IF NOT EXISTS colleague_share_percent double precision;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jp_signature_proposals_colleague_agency_id_fkey'
  ) THEN
    ALTER TABLE profitos.jp_signature_proposals
      ADD CONSTRAINT jp_signature_proposals_colleague_agency_id_fkey
      FOREIGN KEY (colleague_agency_id) REFERENCES profitos.jp_agencies(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jp_signature_proposals_with_colleague_idx
  ON profitos.jp_signature_proposals (with_colleague);
