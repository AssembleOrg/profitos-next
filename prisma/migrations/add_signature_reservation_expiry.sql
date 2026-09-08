ALTER TABLE "profitos"."jp_signature_proposals"
  ADD COLUMN IF NOT EXISTS "reservation_date" DATE,
  ADD COLUMN IF NOT EXISTS "reservation_term_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "reservation_day_type" TEXT,
  ADD COLUMN IF NOT EXISTS "reservation_expires_at" DATE;

CREATE INDEX IF NOT EXISTS "jp_signature_proposals_reservation_expires_at_idx"
  ON "profitos"."jp_signature_proposals" ("reservation_expires_at");

ALTER TABLE "profitos"."jp_signature_proposals"
  DROP CONSTRAINT IF EXISTS "jp_signature_proposals_reservation_term_days_check";
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD CONSTRAINT "jp_signature_proposals_reservation_term_days_check"
  CHECK ("reservation_term_days" IS NULL OR "reservation_term_days" > 0);

ALTER TABLE "profitos"."jp_signature_proposals"
  DROP CONSTRAINT IF EXISTS "jp_signature_proposals_reservation_day_type_check";
ALTER TABLE "profitos"."jp_signature_proposals"
  ADD CONSTRAINT "jp_signature_proposals_reservation_day_type_check"
  CHECK ("reservation_day_type" IS NULL OR "reservation_day_type" IN ('business', 'calendar'));

CREATE TABLE IF NOT EXISTS "profitos"."jp_signature_reservation_reminders" (
  "id" TEXT NOT NULL,
  "proposal_id" TEXT NOT NULL,
  "offset_days" INTEGER NOT NULL,
  "scheduled_for" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "jp_signature_reservation_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "jp_signature_reservation_reminders_proposal_id_fkey"
    FOREIGN KEY ("proposal_id") REFERENCES "profitos"."jp_signature_proposals"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "jp_signature_reservation_reminders_proposal_id_offset_days_key"
  ON "profitos"."jp_signature_reservation_reminders" ("proposal_id", "offset_days");
CREATE INDEX IF NOT EXISTS "jp_signature_reservation_reminders_scheduled_for_idx"
  ON "profitos"."jp_signature_reservation_reminders" ("scheduled_for");
