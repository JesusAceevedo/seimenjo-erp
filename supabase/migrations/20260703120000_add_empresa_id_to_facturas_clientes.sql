-- Migration: Add empresa_id to facturas_clientes table and configure RLS policy

ALTER TABLE public.facturas_clientes 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Permitir todo a autenticados en facturas_clientes" ON public.facturas_clientes;
DROP POLICY IF EXISTS "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes;

-- Crear política de aislamiento
CREATE POLICY "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Recargar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
