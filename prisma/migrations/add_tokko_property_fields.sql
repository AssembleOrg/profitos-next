-- Tokko synchronization support for properties

ALTER TABLE "jp_propiedades"
  ADD COLUMN IF NOT EXISTS "tokko_id" integer,
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "real_address" text,
  ADD COLUMN IF NOT EXISTS "address_complement" text,
  ADD COLUMN IF NOT EXISTS "publication_title" text,
  ADD COLUMN IF NOT EXISTS "reference_code" text,
  ADD COLUMN IF NOT EXISTS "public_url" text,
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "rich_description" text,
  ADD COLUMN IF NOT EXISTS "age" integer,
  ADD COLUMN IF NOT EXISTS "room_amount" integer,
  ADD COLUMN IF NOT EXISTS "bathroom_amount" integer,
  ADD COLUMN IF NOT EXISTS "suite_amount" integer,
  ADD COLUMN IF NOT EXISTS "parking_lot_amount" integer,
  ADD COLUMN IF NOT EXISTS "floors_amount" integer,
  ADD COLUMN IF NOT EXISTS "orientation" text,
  ADD COLUMN IF NOT EXISTS "disposition" text,
  ADD COLUMN IF NOT EXISTS "total_surface" double precision,
  ADD COLUMN IF NOT EXISTS "roofed_surface" double precision,
  ADD COLUMN IF NOT EXISTS "surface" double precision,
  ADD COLUMN IF NOT EXISTS "surface_measurement" text,
  ADD COLUMN IF NOT EXISTS "expenses" double precision,
  ADD COLUMN IF NOT EXISTS "operation_type" text,
  ADD COLUMN IF NOT EXISTS "operation_price" double precision,
  ADD COLUMN IF NOT EXISTS "operation_currency" text,
  ADD COLUMN IF NOT EXISTS "location_full" text,
  ADD COLUMN IF NOT EXISTS "location_short" text,
  ADD COLUMN IF NOT EXISTS "branch_name" text,
  ADD COLUMN IF NOT EXISTS "branch_office" text,
  ADD COLUMN IF NOT EXISTS "producer_name" text,
  ADD COLUMN IF NOT EXISTS "geo_lat" double precision,
  ADD COLUMN IF NOT EXISTS "geo_long" double precision,
  ADD COLUMN IF NOT EXISTS "cover_image_url" text,
  ADD COLUMN IF NOT EXISTS "photos" jsonb,
  ADD COLUMN IF NOT EXISTS "videos" jsonb,
  ADD COLUMN IF NOT EXISTS "tags" jsonb,
  ADD COLUMN IF NOT EXISTS "extra_attributes" jsonb,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "tokko_created_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "tokko_updated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "raw_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "sync_at" timestamptz;

ALTER TABLE "jp_propiedades"
  ALTER COLUMN "user_id" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "jp_propiedades_tokko_id_key"
  ON "jp_propiedades" ("tokko_id")
  WHERE "tokko_id" IS NOT NULL;

