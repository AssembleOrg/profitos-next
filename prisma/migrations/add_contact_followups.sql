CREATE TABLE IF NOT EXISTS "jp_contact_followups" (
  "id" text PRIMARY KEY,
  "recent_contact_id" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pendiente',
  "notes" text,
  "assigned_to_user_id" text,
  "assigned_by_user_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "jp_contact_followups_recent_contact_id_fkey"
    FOREIGN KEY ("recent_contact_id") REFERENCES "jp_ultimos_contactos"("id") ON DELETE CASCADE,
  CONSTRAINT "jp_contact_followups_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "jp_users"("id") ON DELETE SET NULL,
  CONSTRAINT "jp_contact_followups_assigned_by_user_id_fkey"
    FOREIGN KEY ("assigned_by_user_id") REFERENCES "jp_users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "jp_contact_followups_status_idx"
  ON "jp_contact_followups" ("status");
CREATE INDEX IF NOT EXISTS "jp_contact_followups_assigned_to_user_id_idx"
  ON "jp_contact_followups" ("assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "jp_contact_followups_updated_at_idx"
  ON "jp_contact_followups" ("updated_at" DESC);

CREATE TABLE IF NOT EXISTS "jp_contact_followup_actions" (
  "id" text PRIMARY KEY,
  "followup_id" text NOT NULL,
  "type" text NOT NULL DEFAULT 'nota',
  "description" text NOT NULL,
  "audio_url" text,
  "action_at" timestamptz NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "jp_contact_followup_actions_followup_id_fkey"
    FOREIGN KEY ("followup_id") REFERENCES "jp_contact_followups"("id") ON DELETE CASCADE,
  CONSTRAINT "jp_contact_followup_actions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "jp_users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "jp_contact_followup_actions_followup_id_idx"
  ON "jp_contact_followup_actions" ("followup_id");
CREATE INDEX IF NOT EXISTS "jp_contact_followup_actions_action_at_idx"
  ON "jp_contact_followup_actions" ("action_at" DESC);

CREATE TABLE IF NOT EXISTS "jp_contact_followup_status_changes" (
  "id" text PRIMARY KEY,
  "followup_id" text NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "note" text NOT NULL,
  "changed_by_user_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "jp_contact_followup_status_changes_followup_id_fkey"
    FOREIGN KEY ("followup_id") REFERENCES "jp_contact_followups"("id") ON DELETE CASCADE,
  CONSTRAINT "jp_contact_followup_status_changes_changed_by_user_id_fkey"
    FOREIGN KEY ("changed_by_user_id") REFERENCES "jp_users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "jp_contact_followup_status_changes_followup_id_idx"
  ON "jp_contact_followup_status_changes" ("followup_id");
CREATE INDEX IF NOT EXISTS "jp_contact_followup_status_changes_created_at_idx"
  ON "jp_contact_followup_status_changes" ("created_at" DESC);
