-- MIGRACIÓN: Actualizar función registrar_movimiento_inventario para usar 'actualizado_en'
-- Fecha: 2026-07-31

CREATE OR REPLACE FUNCTION public.registrar_movimiento_inventario(
    p_empresa_id UUID,
    p_almacen_id UUID,
    p_producto_variante_id UUID,
    p_tipo_movimiento TEXT,
    p_cantidad NUMERIC,
    p_costo_unitario NUMERIC,
    p_referencia TEXT,
    p_creado_por UUID
) RETURNS void AS $$
DECLARE
    v_cantidad_actual NUMERIC;
    v_costo_promedio NUMERIC;
    v_nueva_cantidad NUMERIC;
    v_nuevo_costo_promedio NUMERIC;
BEGIN
    -- Asegurar que exista el registro en inventario_stock
    INSERT INTO public.inventario_stock (empresa_id, almacen_id, producto_variante_id, cantidad_actual, costo_promedio)
    VALUES (p_empresa_id, p_almacen_id, p_producto_variante_id, 0, 0)
    ON CONFLICT (almacen_id, producto_variante_id) DO NOTHING;

    -- Bloquear el registro para actualización concurrente
    SELECT cantidad_actual, costo_promedio 
    INTO v_cantidad_actual, v_costo_promedio
    FROM public.inventario_stock
    WHERE almacen_id = p_almacen_id AND producto_variante_id = p_producto_variante_id
    FOR UPDATE;

    -- Calcular nueva cantidad y costo promedio
    IF p_tipo_movimiento = 'Entrada' THEN
        v_nueva_cantidad := v_cantidad_actual + p_cantidad;
        -- Fórmula Costo Promedio Ponderado: ((StockActual * CostoPromedioActual) + (NuevasUnidades * NuevoCosto)) / TotalUnidades
        IF v_nueva_cantidad > 0 THEN
            v_nuevo_costo_promedio := ((v_cantidad_actual * v_costo_promedio) + (p_cantidad * p_costo_unitario)) / v_nueva_cantidad;
        ELSE
            v_nuevo_costo_promedio := p_costo_unitario;
        END IF;
    ELSIF p_tipo_movimiento = 'Salida' THEN
        v_nueva_cantidad := v_cantidad_actual - p_cantidad;
        v_nuevo_costo_promedio := v_costo_promedio; -- El costo promedio no cambia en salidas
    ELSIF p_tipo_movimiento = 'Ajuste' THEN
        v_nueva_cantidad := v_cantidad_actual + p_cantidad; -- p_cantidad puede ser positivo o negativo
        v_nuevo_costo_promedio := v_costo_promedio; -- En ajustes, mantenemos el costo promedio, o se puede usar costo 0.
    ELSIF p_tipo_movimiento = 'Transferencia' THEN
        v_nueva_cantidad := v_cantidad_actual + p_cantidad; -- Será negativo en el origen, positivo en destino
        v_nuevo_costo_promedio := v_costo_promedio;
    END IF;

    -- Insertar el movimiento en el historial
    INSERT INTO public.movimientos_inventario (
        empresa_id, almacen_id, producto_variante_id, tipo_movimiento, cantidad, costo_unitario, referencia, creado_por
    ) VALUES (
        p_empresa_id, p_almacen_id, p_producto_variante_id, p_tipo_movimiento, p_cantidad, p_costo_unitario, p_referencia, p_creado_por
    );

    -- Actualizar el inventario usando el nombre de columna normalizado 'actualizado_en'
    UPDATE public.inventario_stock
    SET cantidad_actual = v_nueva_cantidad,
        costo_promedio = v_nuevo_costo_promedio,
        actualizado_en = timezone('utc'::text, now())
    WHERE almacen_id = p_almacen_id AND producto_variante_id = p_producto_variante_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recargar esquema de PostgREST
NOTIFY pgrst, 'reload schema';
