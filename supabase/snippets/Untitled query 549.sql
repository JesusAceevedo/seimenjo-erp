-- =====================================================================
-- 15. POLÍTICAS DE RLS PARA TABLAS DE CONFIGURACIÓN Y ACCESO
-- =====================================================================

-- modulos_empresa
ALTER TABLE public.modulos_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en modulos_empresa" ON public.modulos_empresa;
CREATE POLICY "Permitir todo a autenticados en modulos_empresa" 
    ON public.modulos_empresa FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- empresas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en empresas" ON public.empresas;
CREATE POLICY "Permitir todo a autenticados en empresas" 
    ON public.empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- perfiles_seguridad
ALTER TABLE public.perfiles_seguridad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en perfiles_seguridad" ON public.perfiles_seguridad;
CREATE POLICY "Permitir todo a autenticados en perfiles_seguridad" 
    ON public.perfiles_seguridad FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- usuarios_staff
ALTER TABLE public.usuarios_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en usuarios_staff" ON public.usuarios_staff;
CREATE POLICY "Permitir todo a autenticados en usuarios_staff" 
    ON public.usuarios_staff FOR ALL TO authenticated USING (true) WITH CHECK (true);


