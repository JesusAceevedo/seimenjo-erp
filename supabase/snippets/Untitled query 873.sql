-- =====================================================================
-- 12. ACTUALIZACIÓN DE ESTATUS DE PEDIDOS (ENTREGADO)
-- =====================================================================
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estatus_pedido_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estatus_pedido_check CHECK (estatus_pedido = ANY (ARRAY['Pendiente'::text, 'Pagado'::text, 'Cancelado'::text, 'Facturado'::text, 'Entregado'::text]));
