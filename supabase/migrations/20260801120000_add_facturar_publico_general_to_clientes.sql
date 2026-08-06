-- MIGRACIÓN: Añadir campo facturar_publico_general a la tabla clientes
-- Permite marcar clientes cuyas ventas deben acumularse en la Bolsa Mensual de Facturación Global / Público en General.

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS facturar_publico_general BOOLEAN DEFAULT FALSE;

-- Actualizar comentarios y conceder permisos
COMMENT ON COLUMN public.clientes.facturar_publico_general IS 'Si es true, las ventas de este cliente se agrupan automáticamente en la bolsa de factura global al público en general';
