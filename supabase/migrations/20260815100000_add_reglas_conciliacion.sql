-- MIGRACIÓN: Reglas de Conciliación Bancaria y Auditoría de Movimientos
-- Fecha: 2026-08-15

-- 1. TABLA: reglas_conciliacion
CREATE TABLE IF NOT EXISTS public.reglas_conciliacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    nombre TEXT NOT NULL,
    concepto_contiene TEXT,
    monto_min NUMERIC(12,2),
    monto_max NUMERIC(12,2),
    cuenta_bancaria_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE SET NULL,
    rfc_proveedor TEXT,
    es_comision BOOLEAN DEFAULT false,
    categoria_movimiento_id UUID REFERENCES public.categorias_movimiento_bancario(id) ON DELETE SET NULL,
    estatus_conciliacion_id UUID REFERENCES public.estatus_conciliacion_bancaria(id) ON DELETE SET NULL,
    cuenta_contable_id UUID REFERENCES public.cuentas_contables(id) ON DELETE SET NULL,
    es_deducible BOOLEAN DEFAULT true,
    activa BOOLEAN DEFAULT true NOT NULL,
    orden INT DEFAULT 10 NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CAMPOS DE AUDITORÍA EN CONCILIACIONES Y MOVIMIENTOS BANCARIOS
ALTER TABLE public.conciliaciones_bancarias
ADD COLUMN IF NOT EXISTS reconciliado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS desconciliado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reconciliado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3. RLS Y SEGURIDAD
ALTER TABLE public.reglas_conciliacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total para reglas_conciliacion" ON public.reglas_conciliacion;
CREATE POLICY "Acceso total para reglas_conciliacion" ON public.reglas_conciliacion
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON TABLE public.reglas_conciliacion TO authenticated, service_role;
REVOKE ALL ON TABLE public.reglas_conciliacion FROM anon;
