-- Refuerzo de reserva + vencimientos agendados en Google Calendar (bandeja 13/11).
-- Idempotente: se puede correr más de una vez.

ALTER TABLE "profitos"."jp_signature_proposals"
  ADD COLUMN IF NOT EXISTS "has_reinforcement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reinforcement_date" DATE,
  ADD COLUMN IF NOT EXISTS "reinforcement_term_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "reinforcement_day_type" TEXT,
  ADD COLUMN IF NOT EXISTS "reinforcement_expires_at" DATE,
  ADD COLUMN IF NOT EXISTS "reservation_calendar_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reservation_calendar_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reinforcement_calendar_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reinforcement_calendar_user_id" TEXT;

ALTER TABLE "profitos"."jp_signature_proposals"
  DROP CONSTRAINT IF EXISTS "jp_signature_proposals_reinforcement_term_days_check";
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD CONSTRAINT "jp_signature_proposals_reinforcement_term_days_check"
  CHECK ("reinforcement_term_days" IS NULL OR "reinforcement_term_days" > 0);

ALTER TABLE "profitos"."jp_signature_proposals"
  DROP CONSTRAINT IF EXISTS "jp_signature_proposals_reinforcement_day_type_check";
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD CONSTRAINT "jp_signature_proposals_reinforcement_day_type_check"
  CHECK ("reinforcement_day_type" IS NULL OR "reinforcement_day_type" IN ('business', 'calendar'));

-- Los avisos (15 días, 5 días y el día) ahora pueden ser de la reserva o del refuerzo.
ALTER TABLE "profitos"."jp_signature_reservation_reminders"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'reserva';

ALTER TABLE "profitos"."jp_signature_reservation_reminders"
  DROP CONSTRAINT IF EXISTS "jp_signature_reservation_reminders_kind_check";
ALTER TABLE "profitos"."jp_signature_reservation_reminders"
  ADD CONSTRAINT "jp_signature_reservation_reminders_kind_check"
  CHECK ("kind" IN ('reserva', 'refuerzo'));

-- El único viejo (proposal_id, offset_days) impediría guardar los avisos del refuerzo.
DROP INDEX IF EXISTS "profitos"."jp_signature_reservation_reminders_proposal_id_offset_days_key";
-- Nombre que espera Prisma (Postgres corta en 63 caracteres).
DROP INDEX IF EXISTS "profitos"."jp_signature_reservation_reminders_proposal_id_kind_offset_days";
CREATE UNIQUE INDEX IF NOT EXISTS "jp_signature_reservation_reminders_proposal_id_kind_offset__key"
  ON "profitos"."jp_signature_reservation_reminders" ("proposal_id", "kind", "offset_days");

-- Sobres en resguardo: monto dejado en la reserva (sobre 1) y en el refuerzo (sobre 2).
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD COLUMN IF NOT EXISTS "reservation_amount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reservation_currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "reinforcement_amount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reinforcement_currency" TEXT NOT NULL DEFAULT 'USD';

-- Comprador y vendedor: vinculados a Contactos (jp_clientes).
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD COLUMN IF NOT EXISTS "buyer_client_id" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_client_id" TEXT;

ALTER TABLE "profitos"."jp_signature_proposals"
  DROP CONSTRAINT IF EXISTS "jp_signature_proposals_buyer_client_id_fkey";
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD CONSTRAINT "jp_signature_proposals_buyer_client_id_fkey"
  FOREIGN KEY ("buyer_client_id") REFERENCES "profitos"."jp_clientes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profitos"."jp_signature_proposals"
  DROP CONSTRAINT IF EXISTS "jp_signature_proposals_seller_client_id_fkey";
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD CONSTRAINT "jp_signature_proposals_seller_client_id_fkey"
  FOREIGN KEY ("seller_client_id") REFERENCES "profitos"."jp_clientes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "jp_signature_proposals_buyer_client_id_idx"
  ON "profitos"."jp_signature_proposals" ("buyer_client_id");
CREATE INDEX IF NOT EXISTS "jp_signature_proposals_seller_client_id_idx"
  ON "profitos"."jp_signature_proposals" ("seller_client_id");
