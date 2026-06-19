-- =====================================================================
-- MIGRACIÓN SUPABASE: CONCILIACIÓN BANCARIA Y FACTURACIÓN GLOBAL
-- =====================================================================

-- 1. TABLA DE CATÁLOGO DE ESTATUS DE CONCILIACIÓN
CREATE TABLE IF NOT EXISTS public.estatus_conciliacion_bancaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    color TEXT DEFAULT '#9CA3AF', -- Hex color para pintar badges en la UI
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas
ALTER TABLE public.estatus_conciliacion_bancaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para estatus_conciliacion_bancaria" ON public.estatus_conciliacion_bancaria;
CREATE POLICY "Aislamiento multiempresa para estatus_conciliacion_bancaria" ON public.estatus_conciliacion_bancaria
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

-- Sembrar catálogo inicial oficial
INSERT INTO public.estatus_conciliacion_bancaria (clave, nombre, descripcion, color, empresa_id) VALUES
('pendiente', 'Pendiente de Conciliar', 'El movimiento no ha sido verificado o conciliado', '#9CA3AF', NULL),
('comprobado', 'Comprobado', 'Completamente comprobado con XML de factura y/o ticket', '#10B981', NULL),
('incompleto', 'Incompleto', 'Le hace falta algún documento como XML, PDF de Factura o Ticket', '#F59E0B', NULL),
('incompleto_comprobado', 'Incompleto y Comprobado', 'Aparece en el banco y está comprobado, pero le falta algún archivo/documento', '#3B82F6', NULL),
('no_deducible', 'Movimiento no Deducible', 'Falta la factura o no está comprobado en el estado de cuenta (excepto efectivo)', '#EF4444', NULL),
('no_facturable', 'Movimiento no Facturable', 'Comisiones, impuestos, nóminas u otros que no requieren factura deducible', '#8B5CF6', NULL)
ON CONFLICT (clave) DO UPDATE SET 
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    color = EXCLUDED.color;


-- 2. TABLA DE MOVIMIENTOS BANCARIOS (ESTADO DE CUENTA IMPORTADO)
CREATE TABLE IF NOT EXISTS public.movimientos_bancarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL,
    concepto TEXT NOT NULL,
    retiro NUMERIC(12,2) DEFAULT 0.00,
    deposito NUMERIC(12,2) DEFAULT 0.00,
    monto NUMERIC(12,2) NOT NULL, -- Deposito positivo, Retiro negativo
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('Retiro', 'Deposito')),
    referencia TEXT,
    visible_egresos BOOLEAN DEFAULT FALSE,
    visible_ingresos BOOLEAN DEFAULT FALSE,
    estatus_conciliacion_id UUID REFERENCES public.estatus_conciliacion_bancaria(id) ON DELETE SET NULL,
    xml_url TEXT, -- Nombre del archivo en bucket o link de Drive
    pdf_factura_url TEXT,
    pdf_ticket_url TEXT,
    storage_provider TEXT CHECK (storage_provider IN ('Supabase', 'GoogleDrive')) DEFAULT 'Supabase',
    rfc_proveedor TEXT,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas
ALTER TABLE public.movimientos_bancarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para movimientos_bancarios" ON public.movimientos_bancarios;
CREATE POLICY "Aislamiento multiempresa para movimientos_bancarios" ON public.movimientos_bancarios
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());


-- 3. TABLA DE CONCILIACIONES Y AJUSTES MANUALES (RELACIONES N-N)
CREATE TABLE IF NOT EXISTS public.conciliaciones_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE CASCADE,
    gasto_id UUID REFERENCES public.gastos(id) ON DELETE CASCADE,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
    monto_asociado NUMERIC(12,2) NOT NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_only_one_target CHECK (
        (gasto_id IS NOT NULL AND pedido_id IS NULL) OR 
        (pedido_id IS NOT NULL AND gasto_id IS NULL)
    )
);

-- Habilitar RLS y políticas
ALTER TABLE public.conciliaciones_bancarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para conciliaciones_bancarias" ON public.conciliaciones_bancarias;
CREATE POLICY "Aislamiento multiempresa para conciliaciones_bancarias" ON public.conciliaciones_bancarias
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());


-- 4. ACTUALIZAR LAS TABLAS EXISTENTES PARA SOPORTAR RELACIONES
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS movimiento_bancario_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS movimiento_bancario_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE SET NULL;

-- Índices de optimización
CREATE INDEX IF NOT EXISTS idx_gastos_movimiento_bancario ON public.gastos(movimiento_bancario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_movimiento_bancario ON public.pedidos(movimiento_bancario_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha_monto ON public.movimientos_bancarios(fecha, monto);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_movimiento ON public.conciliaciones_bancarias(movimiento_id);


-- 5. CONCESIÓN DE PRIVILEGIOS (GRANTS)
GRANT ALL ON TABLE public.estatus_conciliacion_bancaria TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.movimientos_bancarios TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.conciliaciones_bancarias TO anon, authenticated, service_role;
