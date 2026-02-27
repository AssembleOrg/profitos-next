-- Create jp_propiedades table
CREATE TABLE IF NOT EXISTS "jp_propiedades" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "zone" TEXT,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'activa',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "jp_propiedades_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "jp_propiedades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "jp_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create jp_clientes table
CREATE TABLE IF NOT EXISTS "jp_clientes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "jp_clientes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "jp_clientes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "jp_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Update jp_visitas: add property_id and client_id, remove old text fields
ALTER TABLE "jp_visitas" ADD COLUMN IF NOT EXISTS "property_id" TEXT;
ALTER TABLE "jp_visitas" ADD COLUMN IF NOT EXISTS "client_id" TEXT;

-- Add foreign keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jp_visitas_property_id_fkey') THEN
        ALTER TABLE "jp_visitas"
            ADD CONSTRAINT "jp_visitas_property_id_fkey"
            FOREIGN KEY ("property_id") REFERENCES "jp_propiedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jp_visitas_client_id_fkey') THEN
        ALTER TABLE "jp_visitas"
            ADD CONSTRAINT "jp_visitas_client_id_fkey"
            FOREIGN KEY ("client_id") REFERENCES "jp_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Drop old columns if they exist
ALTER TABLE "jp_visitas" DROP COLUMN IF EXISTS "client_name";
ALTER TABLE "jp_visitas" DROP COLUMN IF EXISTS "client_phone";
ALTER TABLE "jp_visitas" DROP COLUMN IF EXISTS "property_address";
