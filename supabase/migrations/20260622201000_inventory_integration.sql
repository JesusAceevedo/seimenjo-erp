-- =====================================================================
-- MIGRACIÓN: Integración de Reglas de Negocio de Inventario
-- =====================================================================

-- 1. Agregar campos a gastos para asociarlos al inventario
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS producto_variante_id UUID REFERENCES public.producto_variantes(id);
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS cantidad NUMERIC;

-- 2. Trigger para descontar inventario cuando se crea un detalle de pedido
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

DROP TRIGGER IF EXISTS trg_pedido_detalles_inventario ON public.pedido_detalles;
CREATE TRIGGER trg_pedido_detalles_inventario
AFTER INSERT ON public.pedido_detalles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_pedido_detalles_inventario();

-- 3. Trigger para incrementar inventario cuando se registra un Gasto de Materia Prima
CREATE OR REPLACE FUNCTION public.trigger_gastos_inventario()
RETURNS TRIGGER AS $$
DECLARE
    v_almacen_id UUID;
    v_tipo_categoria TEXT;
    v_costo_unitario NUMERIC;
BEGIN
    IF NEW.categoria_id IS NOT NULL AND NEW.producto_variante_id IS NOT NULL AND NEW.cantidad IS NOT NULL AND NEW.cantidad > 0 THEN
        SELECT tipo INTO v_tipo_categoria FROM public.categorias_gasto WHERE id = NEW.categoria_id;

        IF v_tipo_categoria = 'Materia Prima' THEN
            SELECT id INTO v_almacen_id FROM public.almacenes WHERE empresa_id = NEW.empresa_id AND es_principal = true LIMIT 1;
            
            IF v_almacen_id IS NOT NULL THEN
                v_costo_unitario := NEW.monto / NEW.cantidad;
                PERFORM public.registrar_movimiento_inventario(
                    NEW.empresa_id, 
                    v_almacen_id, 
                    NEW.producto_variante_id, 
                    'Entrada', 
                    NEW.cantidad, 
                    v_costo_unitario, 
                    'Compra Gasto ' || NEW.id, 
                    NULL
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gastos_inventario ON public.gastos;
CREATE TRIGGER trg_gastos_inventario
AFTER INSERT ON public.gastos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_gastos_inventario();
