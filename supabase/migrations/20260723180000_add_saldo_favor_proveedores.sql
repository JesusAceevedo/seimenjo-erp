-- Migración para la contabilización y seguimiento de Saldo a Favor por Proveedor

-- 1. Agregar campos de saldo a favor en proveedores y gastos
ALTER TABLE public.proveedores 
ADD COLUMN IF NOT EXISTS saldo_favor NUMERIC(15,2) DEFAULT 0.00;

ALTER TABLE public.gastos 
ADD COLUMN IF NOT EXISTS saldo_favor_aplicado NUMERIC(15,2) DEFAULT 0.00;

-- 2. Crear tabla de auditoría para historial de saldo a favor de proveedores
CREATE TABLE IF NOT EXISTS public.historial_saldos_favor_proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    monto NUMERIC(15,2) NOT NULL,
    tipo TEXT CHECK (tipo IN ('abono', 'excedente_conciliacion', 'aplicacion_gasto', 'ajuste')) NOT NULL,
    gasto_id UUID REFERENCES public.gastos(id) ON DELETE SET NULL,
    movimiento_bancario_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE SET NULL,
    concepto TEXT NOT NULL,
    origen_detalle TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS y políticas
ALTER TABLE public.historial_saldos_favor_proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para historial_saldos_favor_proveedores" ON public.historial_saldos_favor_proveedores;
CREATE POLICY "Aislamiento multiempresa para historial_saldos_favor_proveedores" ON public.historial_saldos_favor_proveedores
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

GRANT ALL ON TABLE public.historial_saldos_favor_proveedores TO anon, authenticated, service_role;
