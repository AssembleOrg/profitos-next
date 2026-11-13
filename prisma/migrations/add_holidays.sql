-- Feriados / días no laborables según la calculadora del Colegio de Escribanos
-- de la Provincia de Buenos Aires. El worker los actualiza todos los lunes
-- (mes actual + siguiente); fuera de lo sincronizado se usa el cálculo propio.
-- Idempotente.

CREATE TABLE IF NOT EXISTS "profitos"."jp_holidays" (
  "day" DATE NOT NULL,
  "description" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'colegio',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "jp_holidays_pkey" PRIMARY KEY ("day")
);

-- Cada corrida del chequeo: qué rango miró, qué cambió y cuántos vencimientos recalculó.
CREATE TABLE IF NOT EXISTS "profitos"."jp_holiday_syncs" (
  "id" TEXT NOT NULL,
  "ran_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "range_from" DATE NOT NULL,
  "range_to" DATE NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "added" JSONB,
  "removed" JSONB,
  "recalculated" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "jp_holiday_syncs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "jp_holiday_syncs_ran_at_idx" ON "profitos"."jp_holiday_syncs" ("ran_at");

-- Igual que el resto de las tablas jp_*: solo el backend (rol de la app) las toca.
ALTER TABLE "profitos"."jp_holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profitos"."jp_holiday_syncs" ENABLE ROW LEVEL SECURITY;
