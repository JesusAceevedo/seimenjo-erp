-- MIGRACIÓN: Agregar pendiente_deposito_comprobantes a la tabla factura_global_ajustes
-- Permite marcar tickets/cortes (ej. corte BBVA) que aún no tienen depósito en el estado de cuenta
-- como "Pendiente por depositar", para que se reconozcan en el cuadre y en la Factura Global.

ALTER TABLE public.factura_global_ajustes
ADD COLUMN IF NOT EXISTS pendiente_deposito_comprobantes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.factura_global_ajustes.pendiente_deposito_comprobantes IS 'Lista de IDs de comprobantes/tickets marcados como Pendiente por Depositar en el mes';
