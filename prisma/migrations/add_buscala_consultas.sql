-- Historial local de consultas de personas (informes de Buscala) desde Profitos.
-- Idempotente. Las tablas del proyecto viven en el schema `profitos`.
SET search_path TO profitos;

CREATE TABLE IF NOT EXISTS "jp_buscala_consultas" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "jp_users"("id") ON DELETE CASCADE,
  "identifier" text NOT NULL,
  "kind" text NOT NULL,
  "buscala_report_id" text NOT NULL,
  "label" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "jp_buscala_consultas_created_at_idx"
  ON "jp_buscala_consultas" ("created_at");
CREATE INDEX IF NOT EXISTS "jp_buscala_consultas_user_id_idx"
  ON "jp_buscala_consultas" ("user_id");
