-- Migración para añadir la tabla comprobantes_deposito y su tabla de relación N:N con movimientos
CREATE TABLE IF NOT EXISTS public.comprobantes_deposito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('deposito_ventanilla', 'corte_tarjeta')),
    fecha DATE NOT NULL,
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    descripcion TEXT,
    archivo_url TEXT,
    storage_provider TEXT CHECK (storage_provider IN ('Supabase', 'GoogleDrive')) DEFAULT 'Supabase',
    cuenta_bancaria_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    
    -- Nuevos campos para corte de tarjeta diario
    monto_debito NUMERIC(12,2) DEFAULT 0,
    monto_credito NUMERIC(12,2) DEFAULT 0,
    propina_debito NUMERIC(12,2) DEFAULT 0,
    propina_credito NUMERIC(12,2) DEFAULT 0,
    monto_amex NUMERIC(12,2) DEFAULT 0,
    propina_amex NUMERIC(12,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de relación N:N para vincular múltiples comprobantes con múltiples movimientos bancarios
CREATE TABLE IF NOT EXISTS public.comprobantes_deposito_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id UUID REFERENCES public.comprobantes_deposito(id) ON DELETE CASCADE,
    movimiento_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE CASCADE,
    monto_asociado NUMERIC(12,2) NOT NULL CHECK (monto_asociado > 0),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_comprobante_movimiento UNIQUE (comprobante_id, movimiento_id)
);

-- Habilitar RLS
ALTER TABLE public.comprobantes_deposito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes_deposito_movimientos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Aislamiento multiempresa para comprobantes_deposito" ON public.comprobantes_deposito;
CREATE POLICY "Aislamiento multiempresa para comprobantes_deposito" ON public.comprobantes_deposito
    FOR ALL TO authenticated
    USING (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL)
    WITH CHECK (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para comprobantes_deposito_movimientos" ON public.comprobantes_deposito_movimientos;
CREATE POLICY "Aislamiento multiempresa para comprobantes_deposito_movimientos" ON public.comprobantes_deposito_movimientos
    FOR ALL TO authenticated
    USING (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL)
    WITH CHECK (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL);

-- Grant permissions
GRANT ALL ON TABLE public.comprobantes_deposito TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.comprobantes_deposito_movimientos TO anon, authenticated, service_role;
