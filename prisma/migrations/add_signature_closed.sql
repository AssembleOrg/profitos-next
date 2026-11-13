-- Cierre de operación: la firma sale de la lista de Estado de firmas (queda en
-- el filtro "Cerradas") y sus honorarios ya se registraron como cobrados.
-- Idempotente.
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closed_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "jp_signature_proposals_closed_at_idx"
  ON "profitos"."jp_signature_proposals" ("closed_at");
