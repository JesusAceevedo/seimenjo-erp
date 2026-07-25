-- MIGRACIÓN: Agregar constraints de validación, índices faltantes y columnas de fecha de creación
-- Fecha: 2026-07-25

-- 1. Constraints de validación (usando NOT VALID para no fallar por registros históricos existentes)
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS chk_precio_total_positivo;
ALTER TABLE public.pedidos ADD CONSTRAINT chk_precio_total_positivo CHECK (precio_total >= 0) NOT VALID;

ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS chk_monto_positivo;
ALTER TABLE public.gastos ADD CONSTRAINT chk_monto_positivo CHECK (monto >= 0) NOT VALID;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS chk_rfc_longitud;
ALTER TABLE public.clientes ADD CONSTRAINT chk_rfc_longitud CHECK (rfc IS NULL OR length(rfc) BETWEEN 12 AND 13) NOT VALID;

ALTER TABLE public.empleados_detalle DROP CONSTRAINT IF EXISTS chk_curp_longitud;
ALTER TABLE public.empleados_detalle ADD CONSTRAINT chk_curp_longitud CHECK (curp IS NULL OR length(curp) = 18) NOT VALID;

ALTER TABLE public.empleados_detalle DROP CONSTRAINT IF EXISTS chk_nss_longitud;
ALTER TABLE public.empleados_detalle ADD CONSTRAINT chk_nss_longitud CHECK (nss IS NULL OR length(nss) = 11) NOT VALID;

ALTER TABLE public.recibos_nomina DROP CONSTRAINT IF EXISTS chk_sueldo_neto_positivo;
ALTER TABLE public.recibos_nomina ADD CONSTRAINT chk_sueldo_neto_positivo CHECK (sueldo_neto >= 0) NOT VALID;

-- 2. Índices de optimización para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_gastos_fecha_empresa ON public.gastos(empresa_id, fecha_gasto);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_empresa ON public.pedidos(empresa_id, fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_movimientos_bancarios_mes ON public.movimientos_bancarios(empresa_id, mes_conciliacion);
CREATE INDEX IF NOT EXISTS idx_asistencia_diaria_fecha ON public.asistencia_diaria(empleado_id, fecha);
CREATE INDEX IF NOT EXISTS idx_checadas_timestamp ON public.asistencia_checadas_raw(empresa_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_comprobantes_deposito_empresa ON public.comprobantes_deposito(empresa_id, fecha);

-- 3. Agregar creado_en a tablas base que no tenian timestamp de creación
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.categorias_gasto ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.pedido_detalles ADD COLUMN IF NOT EXISTS creado_en TIMESTAMPTZ DEFAULT NOW();
