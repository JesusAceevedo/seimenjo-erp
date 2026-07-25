-- MIGRACIÓN: Actualizar función trigger block_operation_on_closed_period en PostgreSQL usando 'creado_en'
-- Fecha: 2026-07-25

CREATE OR REPLACE FUNCTION public.block_operation_on_closed_period()
RETURNS TRIGGER AS $$
DECLARE
    emp_id UUID;
    op_date DATE;
    is_closed BOOLEAN;
BEGIN
    -- Permitir UPDATE de metadatos (como carga_id) en movimientos_bancarios si no se alteran montos ni fechas financieras
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'movimientos_bancarios' THEN
            IF OLD.fecha IS NOT DISTINCT FROM NEW.fecha AND
               OLD.monto IS NOT DISTINCT FROM NEW.monto AND
               OLD.retiro IS NOT DISTINCT FROM NEW.retiro AND
               OLD.deposito IS NOT DISTINCT FROM NEW.deposito AND
               OLD.empresa_id IS NOT DISTINCT FROM NEW.empresa_id THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    -- Determinar el empresa_id y la fecha según la tabla y operación
    IF TG_TABLE_NAME = 'gastos' THEN
        IF TG_OP = 'DELETE' THEN
            emp_id := OLD.empresa_id;
            op_date := OLD.fecha_gasto;
        ELSE
            emp_id := NEW.empresa_id;
            op_date := NEW.fecha_gasto;
        END IF;
    ELSIF TG_TABLE_NAME = 'pedidos' THEN
        IF TG_OP = 'DELETE' THEN
            emp_id := OLD.empresa_id;
            op_date := COALESCE(OLD.fecha_pedido, OLD.creado_en::date);
        ELSE
            emp_id := NEW.empresa_id;
            op_date := COALESCE(NEW.fecha_pedido, NEW.creado_en::date);
        END IF;
    ELSIF TG_TABLE_NAME = 'movimientos_bancarios' THEN
        IF TG_OP = 'DELETE' THEN
            emp_id := OLD.empresa_id;
            op_date := OLD.fecha;
        ELSE
            emp_id := NEW.empresa_id;
            op_date := NEW.fecha;
        END IF;
    END IF;

    -- Si no hay datos, dejar pasar
    IF emp_id IS NULL OR op_date IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Verificar si el mes está cerrado definitivamente
    SELECT (estatus = 'cerrado_definitivo') INTO is_closed
    FROM public.cierres_mensuales
    WHERE empresa_id = emp_id AND mes = to_char(op_date, 'YYYY-MM');

    IF is_closed THEN
        RAISE EXCEPTION 'El periodo contable % se encuentra cerrado de manera definitiva. No se permiten modificaciones.', to_char(op_date, 'YYYY-MM') USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
