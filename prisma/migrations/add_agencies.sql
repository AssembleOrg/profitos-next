-- Inmobiliarias (otras agencias) + vínculo con movimientos compartidos.
SET search_path TO profitos;

CREATE TABLE IF NOT EXISTS "jp_agencies" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "address" text,
  "phone" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_agencies_name_idx"
  ON "jp_agencies" ("name");

ALTER TABLE "jp_account_entries"
  ADD COLUMN IF NOT EXISTS "shared_agency_id" text
    REFERENCES "jp_agencies"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "jp_account_entries_shared_agency_id_idx"
  ON "jp_account_entries" ("shared_agency_id");
