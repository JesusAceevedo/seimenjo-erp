-- Migration: Fix trigger_pedido_detalles_inventario to resolve creado_por using auth.uid() instead of querying it from public.pedidos
-- Since public.pedidos does not contain a creado_por column.

CREATE OR REPLACE FUNCTION public.trigger_pedido_detalles_inventario()
RETURNS TRIGGER AS $$
DECLARE
    v_empresa_id UUID;
    v_almacen_id UUID;
    v_creado_por UUID;
BEGIN
    SELECT empresa_id INTO v_empresa_id
    FROM public.pedidos WHERE id = NEW.pedido_id;

    -- Obtener el ID del usuario de staff que realiza la operación, si está autenticado
    SELECT id INTO v_creado_por
    FROM public.usuarios_staff
    WHERE id = auth.uid()
    LIMIT 1;

    SELECT id INTO v_almacen_id
    FROM public.almacenes WHERE empresa_id = v_empresa_id AND es_principal = true LIMIT 1;

    IF v_almacen_id IS NOT NULL AND NEW.variante_id IS NOT NULL THEN
        PERFORM public.registrar_movimiento_inventario(
            v_empresa_id, 
            v_almacen_id, 
            NEW.variante_id, 
            'Salida', 
            NEW.cantidad, 
            0, 
            'Venta Pedido ' || NEW.pedido_id, 
            v_creado_por
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
