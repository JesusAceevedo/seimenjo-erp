-- MIGRACIÓN: Tabla de ajustes mensuales para Factura Global y columna facturado_tercero
-- Permite persistencia colaborativa multi-usuario en el módulo de Factura Público en General

-- 1. Agregar columna facturado_tercero a comprobantes_deposito (si no existe)
ALTER TABLE public.comprobantes_deposito
ADD COLUMN IF NOT EXISTS facturado_tercero BOOLEAN DEFAULT FALSE;

-- 2. Tabla para almacenar ajustes mensuales del módulo de Factura al Público en General
CREATE TABLE IF NOT EXISTS public.factura_global_ajustes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    mes TEXT NOT NULL, -- Formato 'YYYY-MM' o 'GLOBAL'
    monto_manual_terceros NUMERIC(12,2) DEFAULT 0,
    movimientos_excluidos JSONB DEFAULT '[]'::jsonb,
    comprobantes_excluidos JSONB DEFAULT '[]'::jsonb,
    manual_otro_mes JSONB DEFAULT '[]'::jsonb,
    proximo_mes_comprobantes JSONB DEFAULT '[]'::jsonb,
    stay_mes_comprobantes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_empresa_mes_factura_global UNIQUE (empresa_id, mes)
);

-- Habilitar RLS
ALTER TABLE public.factura_global_ajustes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Aislamiento multiempresa para factura_global_ajustes" ON public.factura_global_ajustes;
CREATE POLICY "Aislamiento multiempresa para factura_global_ajustes" ON public.factura_global_ajustes
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Permisos
GRANT ALL ON TABLE public.factura_global_ajustes TO anon, authenticated, service_role;
