-- MIGRACIÓN: Agregar no_es_venta_movimientos a la tabla factura_global_ajustes
-- Permite clasificar depósitos bancarios como reembolsos, traspasos u otros no operativos

ALTER TABLE public.factura_global_ajustes
ADD COLUMN IF NOT EXISTS no_es_venta_movimientos JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.factura_global_ajustes.no_es_venta_movimientos IS 'Lista de movimientos bancarios del estado de cuenta marcados como No es Venta (ej. reembolsos, traspasos) con su motivo';
