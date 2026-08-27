-- Campos que MercadoLibre (y otros portales) necesitan y no existían.
ALTER TABLE jp_propiedades ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE jp_propiedades ADD COLUMN IF NOT EXISTS province TEXT;
