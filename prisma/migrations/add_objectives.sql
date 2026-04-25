-- Objective cards (todo-list style) assigned to a user for a date range,
-- with their items (checklist tasks) tracked individually.

SET search_path TO profitos;

CREATE TABLE IF NOT EXISTS "jp_objective_cards" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL,
  "description" text,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status_override" text,
  "assigned_to_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_by_user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_objective_cards_assigned_period_idx"
  ON "jp_objective_cards" ("assigned_to_user_id", "start_date", "end_date");

CREATE INDEX IF NOT EXISTS "jp_objective_cards_period_idx"
  ON "jp_objective_cards" ("start_date", "end_date");

CREATE TABLE IF NOT EXISTS "jp_objective_items" (
  "id" text PRIMARY KEY,
  "card_id" text NOT NULL REFERENCES "jp_objective_cards"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "position" integer NOT NULL DEFAULT 0,
  "evaluated_by_user_id" text REFERENCES "jp_users"("id") ON DELETE SET NULL,
  "evaluated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_objective_items_card_id_idx"
  ON "jp_objective_items" ("card_id");
