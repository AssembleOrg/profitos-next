-- Follow-ups assigned by admins and audit actions per property

CREATE TABLE IF NOT EXISTS "jp_property_followups" (
  "id" text PRIMARY KEY,
  "title" text,
  "notes" text,
  "status" text NOT NULL DEFAULT 'pendiente',
  "due_date" timestamptz,
  "property_id" text NOT NULL REFERENCES "jp_propiedades"("id") ON DELETE CASCADE,
  "assigned_to_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "assigned_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_property_followups_property_id_idx"
  ON "jp_property_followups" ("property_id");

CREATE INDEX IF NOT EXISTS "jp_property_followups_assigned_to_user_id_idx"
  ON "jp_property_followups" ("assigned_to_user_id");

CREATE INDEX IF NOT EXISTS "jp_property_followups_assigned_by_user_id_idx"
  ON "jp_property_followups" ("assigned_by_user_id");

CREATE TABLE IF NOT EXISTS "jp_followup_actions" (
  "id" text PRIMARY KEY,
  "followup_id" text NOT NULL REFERENCES "jp_property_followups"("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'nota',
  "description" text NOT NULL,
  "action_at" timestamptz NOT NULL,
  "shown_to_name" text,
  "scheduled_date" timestamptz,
  "scheduled_time" text,
  "metadata" jsonb,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_followup_actions_followup_id_idx"
  ON "jp_followup_actions" ("followup_id");

CREATE INDEX IF NOT EXISTS "jp_followup_actions_created_by_user_id_idx"
  ON "jp_followup_actions" ("created_by_user_id");

