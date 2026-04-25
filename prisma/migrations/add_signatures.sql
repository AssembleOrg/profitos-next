-- Signature proposals (proceso de firma de venta/alquiler) y sus actions de auditoría.

SET search_path TO profitos;

CREATE TABLE IF NOT EXISTS "jp_signature_proposals" (
  "id" text PRIMARY KEY,
  "property_id" text NOT NULL REFERENCES "jp_propiedades"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'propuesta_enviada',
  "title" text,
  "description" text,
  "attachments" jsonb,
  "date_process_started" timestamptz,
  "date_agreed" timestamptz,
  "date_keys_handover" timestamptz,
  "visit_informes_id" text,
  "visit_acordada_id" text,
  "visit_entrega_id" text,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_signature_proposals_property_id_idx"
  ON "jp_signature_proposals" ("property_id");

CREATE INDEX IF NOT EXISTS "jp_signature_proposals_status_idx"
  ON "jp_signature_proposals" ("status");

CREATE INDEX IF NOT EXISTS "jp_signature_proposals_created_by_user_id_idx"
  ON "jp_signature_proposals" ("created_by_user_id");

CREATE TABLE IF NOT EXISTS "jp_signature_proposal_actions" (
  "id" text PRIMARY KEY,
  "proposal_id" text NOT NULL REFERENCES "jp_signature_proposals"("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'nota',
  "from_status" text,
  "to_status" text,
  "date_field" text,
  "description" text,
  "attachments" jsonb,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_signature_proposal_actions_proposal_id_idx"
  ON "jp_signature_proposal_actions" ("proposal_id");

CREATE INDEX IF NOT EXISTS "jp_signature_proposal_actions_created_by_user_id_idx"
  ON "jp_signature_proposal_actions" ("created_by_user_id");
