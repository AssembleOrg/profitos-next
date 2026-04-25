-- Bucket dedicado para adjuntos del proceso de firmas (propuestas, notas, audios, etc.)
-- Bucket privado: solo accesible vía signed URLs generadas server-side.

INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas', 'firmas', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: usuarios autenticados pueden leer / subir / actualizar / borrar
-- objetos en el bucket "firmas". El control fino se hace en la API (server side)
-- antes de generar signed URLs, por eso a nivel storage damos permiso amplio
-- a authenticated users (mismo patrón que tasaciones).

DROP POLICY IF EXISTS "firmas_authenticated_select" ON storage.objects;
CREATE POLICY "firmas_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'firmas');

DROP POLICY IF EXISTS "firmas_authenticated_insert" ON storage.objects;
CREATE POLICY "firmas_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'firmas');

DROP POLICY IF EXISTS "firmas_authenticated_update" ON storage.objects;
CREATE POLICY "firmas_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'firmas')
  WITH CHECK (bucket_id = 'firmas');

DROP POLICY IF EXISTS "firmas_authenticated_delete" ON storage.objects;
CREATE POLICY "firmas_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'firmas');
