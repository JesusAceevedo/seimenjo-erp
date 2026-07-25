-- Migración para la tabla de cargas de estados de cuenta e integración con movimientos_bancarios

CREATE TABLE IF NOT EXISTS public.cargas_estados_cuenta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_archivo TEXT NOT NULL,
    fecha_carga TIMESTAMPTZ DEFAULT NOW(),
    cuenta_bancaria_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    total_registros INT DEFAULT 0,
    total_depositos NUMERIC(15,2) DEFAULT 0,
    total_retiros NUMERIC(15,2) DEFAULT 0,
    registrado_por UUID,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar relación en movimientos_bancarios
ALTER TABLE public.movimientos_bancarios
ADD COLUMN IF NOT EXISTS carga_id UUID REFERENCES public.cargas_estados_cuenta(id) ON DELETE CASCADE;

-- Permisos y RLS
ALTER TABLE public.cargas_estados_cuenta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para cargas_estados_cuenta" ON public.cargas_estados_cuenta;
CREATE POLICY "Aislamiento multiempresa para cargas_estados_cuenta" ON public.cargas_estados_cuenta
    FOR ALL TO authenticated
    USING (
        empresa_id IS NULL OR 
        is_superusuario() OR 
        empresa_id IN (SELECT empresa_id FROM public.empresas_usuario_pivot WHERE usuario_id = auth.uid()) OR
        (SELECT auth.uid()) IS NOT NULL
    )
    WITH CHECK (
        empresa_id IS NULL OR 
        is_superusuario() OR 
        empresa_id IN (SELECT empresa_id FROM public.empresas_usuario_pivot WHERE usuario_id = auth.uid()) OR
        (SELECT auth.uid()) IS NOT NULL
    );

GRANT ALL ON TABLE public.cargas_estados_cuenta TO anon, authenticated, service_role;
