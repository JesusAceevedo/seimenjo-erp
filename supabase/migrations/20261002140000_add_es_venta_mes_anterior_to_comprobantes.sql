-- MIGRACIÓN: Agregar es_venta_mes_anterior y mes_venta a comprobantes_deposito
-- Permite identificar ingresos que entraron en el mes pero corresponden a ventas de meses anteriores, excluyéndolos de la Factura Global

ALTER TABLE public.comprobantes_deposito
ADD COLUMN IF NOT EXISTS es_venta_mes_anterior BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mes_venta TEXT;

COMMENT ON COLUMN public.comprobantes_deposito.es_venta_mes_anterior IS 'Indica si el ticket o depósito corresponde a ventas diferidas de un mes previo';
COMMENT ON COLUMN public.comprobantes_deposito.mes_venta IS 'Período o mes al que corresponden originalmente las ventas (ej. YYYY-MM)';
