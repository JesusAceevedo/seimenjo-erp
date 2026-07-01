-- =====================================================================
-- 1. TABLA PARA FACTURAS DE CLIENTES (INGRESOS / VENTAS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS facturas_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    
    -- Datos Críticos del XML del SAT
    uuid_fiscal UUID NOT NULL UNIQUE, -- El folio fiscal del XML (Evita duplicados)
    serie_folio TEXT,                 -- Ejemplo: "A-1542"
    fecha_emision TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_timbrado TIMESTAMP WITH TIME ZONE,
    
    -- Desglose Financiero del XML
    subtotal NUMERIC(12,2) NOT NULL,
    iva_trasladado NUMERIC(12,2) DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL,
    
    -- Relaciones con tus catálogos globales
    forma_pago_id UUID REFERENCES formas_pago(id),
    estatus_factura_id UUID REFERENCES estatus_factura(id),
    uso_cfdi_clave TEXT, -- Se puede amarrar con la clave de tu tabla 'usos_cfdi'
    
    -- URLs de Almacenamiento (Storage)
    xml_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para la nueva tabla
ALTER TABLE facturas_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a autenticados en facturas_clientes" 
    ON facturas_clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- 2. MODIFICACIÓN DE LA TABLA DE GASTOS EXISTENTE (EGRESOS)
-- =====================================================================
-- Agregamos las columnas necesarias para almacenar el desglose del XML de proveedores

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS uuid_fiscal UUID UNIQUE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_timbrado TIMESTAMP WITH TIME ZONE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva_acreditable NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS forma_pago_id UUID REFERENCES formas_pago(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS estatus_factura_id UUID REFERENCES estatus_factura(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS pdf_url TEXT; -- Para complementar tu xml_url existente

-- Nota: Tu columna 'gastos.monto' funcionará directamente como el 'Total' del XML.