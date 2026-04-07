CREATE TABLE IF NOT EXISTS "jp_ultimos_contactos" (
  "id" text PRIMARY KEY,
  "tokko_contact_id" integer NOT NULL UNIQUE,
  "source" text NOT NULL DEFAULT 'tokko',
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "cellphone" text,
  "lead_status" text,
  "is_company" boolean,
  "is_owner" boolean,
  "agent_id" integer,
  "agent_name" text,
  "agent_email" text,
  "agent_phone" text,
  "tags" jsonb,
  "tokko_created_at" timestamptz,
  "tokko_deleted_at" timestamptz,
  "raw_payload" jsonb,
  "sync_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_ultimos_contactos_tokko_created_at_idx"
  ON "jp_ultimos_contactos" ("tokko_created_at" DESC);

CREATE INDEX IF NOT EXISTS "jp_ultimos_contactos_created_at_idx"
  ON "jp_ultimos_contactos" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "jp_integration_sync_states" (
  "id" text PRIMARY KEY,
  "integration_key" text NOT NULL UNIQUE,
  "last_offset" integer NOT NULL DEFAULT 0,
  "last_total_count" integer NOT NULL DEFAULT 0,
  "last_run_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_integration_sync_states_key_idx"
  ON "jp_integration_sync_states" ("integration_key");
