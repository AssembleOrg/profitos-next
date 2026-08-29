-- Cola de publicación: soporte de activación (publicar ONLINE) + plan.
ALTER TABLE jp_publish_jobs ADD COLUMN IF NOT EXISTS activate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jp_publish_jobs ADD COLUMN IF NOT EXISTS plan TEXT;
