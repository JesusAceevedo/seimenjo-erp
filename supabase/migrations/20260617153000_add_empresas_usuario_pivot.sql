-- Migration: Add empresas_usuario_pivot table for multi-company assignment
CREATE TABLE IF NOT EXISTS public.empresas_usuario_pivot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios_staff(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    UNIQUE (usuario_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE public.empresas_usuario_pivot ENABLE ROW LEVEL SECURITY;

-- Crear políticas
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en empresas_usuario_pivot" ON public.empresas_usuario_pivot;
CREATE POLICY "Permitir todo a usuarios autenticados en empresas_usuario_pivot" 
    ON public.empresas_usuario_pivot FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Otorgar permisos
GRANT ALL ON TABLE public.empresas_usuario_pivot TO anon, authenticated, service_role;
