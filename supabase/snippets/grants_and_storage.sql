-- Grants para roles de Supabase
GRANT ALL ON TABLE public.sucursales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.modulos_empresa TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.perfiles_seguridad TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.usuarios_staff TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.configuracion_ticket TO anon, authenticated, service_role;

-- Crear buckets en Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
('empresas-logos', 'empresas-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
('empresas-csd', 'empresas-csd', false, 1048576, ARRAY['application/octet-stream', 'application/x-x509-ca-cert', 'application/pkcs8', 'application/x-pkcs12']),
('csd-private', 'csd-private', false, 1048576, ARRAY['application/octet-stream', 'application/x-x509-ca-cert', 'application/pkcs8', 'application/x-pkcs12']),
('ticket-assets', 'ticket-assets', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
('productos-imagenes', 'productos-imagenes', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
('facturas', 'facturas', false, 10485760, ARRAY['text/xml', 'application/xml', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para empresas-logos (Público)
DROP POLICY IF EXISTS "Permitir select público en empresas-logos" ON storage.objects;
CREATE POLICY "Permitir select público en empresas-logos" 
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'empresas-logos');

DROP POLICY IF EXISTS "Permitir insert/update/delete a autenticados en empresas-logos" ON storage.objects;
CREATE POLICY "Permitir insert/update/delete a autenticados en empresas-logos" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'empresas-logos') 
    WITH CHECK (bucket_id = 'empresas-logos');

-- Políticas de Storage para csd-private (Privado)
DROP POLICY IF EXISTS "Permitir todo a autenticados en csd-private" ON storage.objects;
CREATE POLICY "Permitir todo a autenticados en csd-private" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'csd-private') 
    WITH CHECK (bucket_id = 'csd-private');

-- Políticas de Storage para empresas-csd (Privado)
DROP POLICY IF EXISTS "Permitir todo a autenticados en empresas-csd" ON storage.objects;
CREATE POLICY "Permitir todo a autenticados en empresas-csd" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'empresas-csd') 
    WITH CHECK (bucket_id = 'empresas-csd');

-- Políticas de Storage para ticket-assets (Público)
DROP POLICY IF EXISTS "Permitir select público en ticket-assets" ON storage.objects;
CREATE POLICY "Permitir select público en ticket-assets" 
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'ticket-assets');

DROP POLICY IF EXISTS "Permitir insert/update/delete a autenticados en ticket-assets" ON storage.objects;
CREATE POLICY "Permitir insert/update/delete a autenticados en ticket-assets" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'ticket-assets') 
    WITH CHECK (bucket_id = 'ticket-assets');

-- Políticas de Storage para productos-imagenes (Público)
DROP POLICY IF EXISTS "Permitir select público en productos-imagenes" ON storage.objects;
CREATE POLICY "Permitir select público en productos-imagenes" 
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'productos-imagenes');

DROP POLICY IF EXISTS "Permitir insert/update/delete a autenticados en productos-imagenes" ON storage.objects;
CREATE POLICY "Permitir insert/update/delete a autenticados en productos-imagenes" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'productos-imagenes') 
    WITH CHECK (bucket_id = 'productos-imagenes');

-- Políticas de Storage para facturas (Privado)
DROP POLICY IF EXISTS "Permitir todo a autenticados en facturas" ON storage.objects;
CREATE POLICY "Permitir todo a autenticados en facturas" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'facturas') 
    WITH CHECK (bucket_id = 'facturas');
