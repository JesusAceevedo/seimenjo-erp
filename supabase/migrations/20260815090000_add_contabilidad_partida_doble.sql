-- MIGRACIÓN: Módulo de Contabilidad de Partida Doble (CUC SAT, Asientos y Configuración)
-- Fecha: 2026-08-15

-- 1. TABLA: cuentas_contables (Catálogo jerárquico CUC SAT)
CREATE TABLE IF NOT EXISTS public.cuentas_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    nivel INT NOT NULL CHECK (nivel >= 1 AND nivel <= 5),
    tipo TEXT NOT NULL CHECK (tipo IN ('activo', 'pasivo', 'capital', 'ingreso', 'costo', 'gasto')),
    naturaleza TEXT NOT NULL CHECK (naturaleza IN ('deudora', 'acreedora')),
    padre_id UUID REFERENCES public.cuentas_contables(id) ON DELETE RESTRICT,
    es_agrupadora BOOLEAN NOT NULL DEFAULT true,
    estatus TEXT NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'inactivo')),
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice único para código por empresa (incluyendo empresa_id NULL para compartidas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cuentas_contables_empresa_codigo 
ON public.cuentas_contables (COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), codigo);

-- 2. TABLA: asientos (Cabecera de Póliza)
CREATE TABLE IF NOT EXISTS public.asientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso', 'traspaso', 'diario')),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    periodo TEXT NOT NULL, -- Formato YYYY-MM
    concepto TEXT NOT NULL,
    uuid_fiscal TEXT,
    referencia_tabla TEXT,
    referencia_id UUID,
    numero_folio INT NOT NULL,
    estatus TEXT NOT NULL DEFAULT 'borrador' CHECK (estatus IN ('borrador', 'contabilizado', 'cancelado')),
    contabilizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_asiento_referencia UNIQUE (empresa_id, referencia_tabla, referencia_id)
);

-- 3. TABLA: asientos_detalle (Líneas de Partida Doble)
CREATE TABLE IF NOT EXISTS public.asientos_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id UUID NOT NULL REFERENCES public.asientos(id) ON DELETE CASCADE,
    cuenta_contable_id UUID NOT NULL REFERENCES public.cuentas_contables(id) ON DELETE RESTRICT,
    cargo NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (cargo >= 0),
    abono NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (abono >= 0),
    concepto TEXT,
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_cargo_xor_abono CHECK (
        (cargo > 0 AND abono = 0) OR (abono > 0 AND cargo = 0)
    )
);

-- 4. TABLA: configuracion_contable (Mapeo empresa key -> cuenta_contable_id)
CREATE TABLE IF NOT EXISTS public.configuracion_contable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    clave TEXT NOT NULL,
    cuenta_contable_id UUID NOT NULL REFERENCES public.cuentas_contables(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_empresa_clave_contable UNIQUE (empresa_id, clave)
);

-- 5. TABLA: saldos_mensuales_cuentas_contables (Cierre mensual de balanza)
CREATE TABLE IF NOT EXISTS public.saldos_mensuales_cuentas_contables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    cuenta_contable_id UUID NOT NULL REFERENCES public.cuentas_contables(id) ON DELETE CASCADE,
    mes TEXT NOT NULL, -- Formato YYYY-MM
    saldo_inicial NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    cargos NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    abonos NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    saldo_final NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    creado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    actualizado_en TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_cuenta_contable_mes UNIQUE (empresa_id, cuenta_contable_id, mes)
);

-- 6. COLUMNA NUEVA EN categorias_gasto
ALTER TABLE public.categorias_gasto 
ADD COLUMN IF NOT EXISTS cuenta_contable_id UUID REFERENCES public.cuentas_contables(id) ON DELETE SET NULL;

-- 7. ÍNDICES DE OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_asientos_empresa_periodo ON public.asientos(empresa_id, periodo);
CREATE INDEX IF NOT EXISTS idx_asientos_fecha ON public.asientos(fecha);
CREATE INDEX IF NOT EXISTS idx_asientos_referencia ON public.asientos(referencia_tabla, referencia_id);
CREATE INDEX IF NOT EXISTS idx_asientos_detalle_asiento ON public.asientos_detalle(asiento_id);
CREATE INDEX IF NOT EXISTS idx_asientos_detalle_cuenta ON public.asientos_detalle(cuenta_contable_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contables_mes ON public.saldos_mensuales_cuentas_contables(empresa_id, mes);

-- 8. RLS Y POLÍTICAS DE ACCESO
ALTER TABLE public.cuentas_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asientos_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_contable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos_mensuales_cuentas_contables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total para cuentas_contables" ON public.cuentas_contables;
CREATE POLICY "Acceso total para cuentas_contables" ON public.cuentas_contables
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Acceso total para asientos" ON public.asientos;
CREATE POLICY "Acceso total para asientos" ON public.asientos
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Acceso total para asientos_detalle" ON public.asientos_detalle;
CREATE POLICY "Acceso total para asientos_detalle" ON public.asientos_detalle
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Acceso total para configuracion_contable" ON public.configuracion_contable;
CREATE POLICY "Acceso total para configuracion_contable" ON public.configuracion_contable
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Acceso total para saldos_mensuales_cuentas_contables" ON public.saldos_mensuales_cuentas_contables;
CREATE POLICY "Acceso total para saldos_mensuales_cuentas_contables" ON public.saldos_mensuales_cuentas_contables
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Permisos
GRANT ALL ON TABLE public.cuentas_contables TO authenticated, service_role;
GRANT ALL ON TABLE public.asientos TO authenticated, service_role;
GRANT ALL ON TABLE public.asientos_detalle TO authenticated, service_role;
GRANT ALL ON TABLE public.configuracion_contable TO authenticated, service_role;
GRANT ALL ON TABLE public.saldos_mensuales_cuentas_contables TO authenticated, service_role;

REVOKE ALL ON TABLE public.cuentas_contables FROM anon;
REVOKE ALL ON TABLE public.asientos FROM anon;
REVOKE ALL ON TABLE public.asientos_detalle FROM anon;
REVOKE ALL ON TABLE public.configuracion_contable FROM anon;
REVOKE ALL ON TABLE public.saldos_mensuales_cuentas_contables FROM anon;

-- 9. FUNCIÓN SECUENCIAL DE FOLIO POR EMPRESA Y PERIODO
CREATE OR REPLACE FUNCTION public.siguiente_folio_asiento(p_empresa_id UUID, p_periodo TEXT)
RETURNS INT AS $$
DECLARE
    v_siguiente INT;
BEGIN
    SELECT COALESCE(MAX(numero_folio), 0) + 1
    INTO v_siguiente
    FROM public.asientos
    WHERE empresa_id = p_empresa_id AND periodo = p_periodo;
    
    RETURN v_siguiente;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. SEED DEL CATÁLOGO CUC SAT BASE (Nivel 1 y 2 estándar)
DO $$
DECLARE
    id_act UUID := gen_random_uuid();
    id_efec UUID := gen_random_uuid();
    id_banc UUID := gen_random_uuid();
    id_caja UUID := gen_random_uuid();
    id_cxc UUID := gen_random_uuid();
    id_iva_acred UUID := gen_random_uuid();
    id_iva_pend_acred UUID := gen_random_uuid();
    
    id_pas UUID := gen_random_uuid();
    id_cxp UUID := gen_random_uuid();
    id_iva_tras UUID := gen_random_uuid();
    id_iva_pend_tras UUID := gen_random_uuid();
    id_ret_isr UUID := gen_random_uuid();
    id_ret_iva UUID := gen_random_uuid();
    
    id_cap UUID := gen_random_uuid();
    id_cap_soc UUID := gen_random_uuid();
    
    id_ing UUID := gen_random_uuid();
    id_ing_ven UUID := gen_random_uuid();
    
    id_cos UUID := gen_random_uuid();
    id_cos_ven UUID := gen_random_uuid();
    
    id_gas UUID := gen_random_uuid();
    id_gas_gen UUID := gen_random_uuid();
    id_gas_com UUID := gen_random_uuid();
BEGIN
    -- 1. ACTIVO
    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_act, NULL, '100.00', 'ACTIVO', 1, 'activo', 'deudora', NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_efec, NULL, '101.00', 'Efectivo y Equivalentes', 2, 'activo', 'deudora', id_act, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_caja, NULL, '101.01', 'Caja y Caja Chica', 3, 'activo', 'deudora', id_efec, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_banc, NULL, '102.01', 'Bancos Nacionales', 3, 'activo', 'deudora', id_efec, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_cxc, NULL, '105.01', 'Clientes / Cuentas por Cobrar', 3, 'activo', 'deudora', id_act, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_iva_acred, NULL, '118.01', 'IVA Acreditable Pagado', 3, 'activo', 'deudora', id_act, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_iva_pend_acred, NULL, '118.02', 'IVA Pendiente de Acreditar', 3, 'activo', 'deudora', id_act, false)
    ON CONFLICT DO NOTHING;

    -- 2. PASIVO
    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_pas, NULL, '200.00', 'PASIVO', 1, 'pasivo', 'acreedora', NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_cxp, NULL, '201.01', 'Proveedores / Cuentas por Pagar', 3, 'pasivo', 'acreedora', id_pas, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_iva_tras, NULL, '208.01', 'IVA Trasladado Cobrado', 3, 'pasivo', 'acreedora', id_pas, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_iva_pend_tras, NULL, '208.02', 'IVA Pendiente de Trasladar', 3, 'pasivo', 'acreedora', id_pas, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_ret_isr, NULL, '216.01', 'Impuestos Retenidos de ISR', 3, 'pasivo', 'acreedora', id_pas, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_ret_iva, NULL, '216.02', 'Impuestos Retenidos de IVA', 3, 'pasivo', 'acreedora', id_pas, false)
    ON CONFLICT DO NOTHING;

    -- 3. CAPITAL
    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_cap, NULL, '300.00', 'CAPITAL CONTABLE', 1, 'capital', 'acreedora', NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_cap_soc, NULL, '301.01', 'Capital Social', 2, 'capital', 'acreedora', id_cap, false)
    ON CONFLICT DO NOTHING;

    -- 4. INGRESOS
    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_ing, NULL, '400.00', 'INGRESOS', 1, 'ingreso', 'acreedora', NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_ing_ven, NULL, '401.01', 'Ventas y Servicios', 2, 'ingreso', 'acreedora', id_ing, false)
    ON CONFLICT DO NOTHING;

    -- 5. COSTOS
    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_cos, NULL, '500.00', 'COSTOS', 1, 'costo', 'deudora', NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_cos_ven, NULL, '501.01', 'Costo de Ventas', 2, 'costo', 'deudora', id_cos, false)
    ON CONFLICT DO NOTHING;

    -- 6. GASTOS
    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_gas, NULL, '600.00', 'GASTOS', 1, 'gasto', 'deudora', NULL, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_gas_gen, NULL, '601.01', 'Gastos Generales de Operación', 2, 'gasto', 'deudora', id_gas, false)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.cuentas_contables (id, empresa_id, codigo, nombre, nivel, tipo, naturaleza, padre_id, es_agrupadora)
    VALUES (id_gas_com, NULL, '601.02', 'Comisiones Bancarias y TPV', 2, 'gasto', 'deudora', id_gas, false)
    ON CONFLICT DO NOTHING;
END $$;
