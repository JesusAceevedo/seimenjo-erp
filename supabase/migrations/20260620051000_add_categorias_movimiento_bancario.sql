-- 1. TABLA DE CATEGORÍAS DE MOVIMIENTO BANCARIO
CREATE TABLE IF NOT EXISTS public.categorias_movimiento_bancario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    requiere_comprobante BOOLEAN DEFAULT true,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.categorias_movimiento_bancario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa categorias_movimiento" ON public.categorias_movimiento_bancario;
CREATE POLICY "Aislamiento multiempresa categorias_movimiento" ON public.categorias_movimiento_bancario
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

-- 2. SEMBRAR DATOS (Catálogo Inicial)
-- Los movimientos marcados con requiere_comprobante = false no exigirán XML/PDF en el Expediente Digital
INSERT INTO public.categorias_movimiento_bancario (clave, nombre, descripcion, requiere_comprobante, empresa_id) VALUES
('INGRESO_VENTA', 'Cobro de Venta', 'Ingreso por ventas (requiere factura)', true, NULL),
('EGRESO_COMPRA', 'Pago a Proveedor', 'Egreso por compras o gastos (requiere factura)', true, NULL),
('COMISION_BANCO', 'Comisión Bancaria', 'Comisiones cobradas por el banco (ej. manejo de cuenta). No deducible o sin factura.', false, NULL),
('COMISION_TPV', 'Comisión TPV', 'Comisión descontada por Clip, MercadoPago, Parrot, etc.', false, NULL),
('TRASPASO', 'Traspaso entre Cuentas', 'Movimiento de fondos entre cuentas propias de la empresa.', false, NULL),
('PRESTAMO', 'Préstamo Bancario', 'Ingreso por préstamo recibido o pago a capital/intereses.', false, NULL),
('AJUSTE', 'Ajuste Contable', 'Ajustes o redondeos menores.', false, NULL)
ON CONFLICT (clave) DO UPDATE SET 
    nombre = EXCLUDED.nombre, 
    requiere_comprobante = EXCLUDED.requiere_comprobante;

-- 3. AGREGAR A MOVIMIENTOS BANCARIOS
ALTER TABLE public.movimientos_bancarios
ADD COLUMN IF NOT EXISTS categoria_movimiento_id UUID REFERENCES public.categorias_movimiento_bancario(id) ON DELETE SET NULL;

-- 4. PRIVILEGIOS
GRANT ALL ON TABLE public.categorias_movimiento_bancario TO anon, authenticated, service_role;
