-- Migración para asociar movimientos bancarios existentes (carga_id IS NULL) a cargas de estado de cuenta
-- Permite la actualización de carga_id desactivando temporalmente los triggers de usuario

-- 1. Actualizar la función de bloqueo por periodo cerrado para permitir actualizaciones de metadatos (como carga_id) sin cambiar datos financieros
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
            op_date := COALESCE(OLD.fecha_pedido, OLD.created_at::date);
        ELSE
            emp_id := NEW.empresa_id;
            op_date := COALESCE(NEW.fecha_pedido, NEW.created_at::date);
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


-- 2. Ejecutar la asociación masiva de movimientos huérfanos
DO $$
DECLARE
    rec RECORD;
    v_carga_id UUID;
BEGIN
    -- Desactivar temporalmente los triggers de usuario en movimientos_bancarios por seguridad
    ALTER TABLE public.movimientos_bancarios DISABLE TRIGGER USER;

    FOR rec IN 
        SELECT 
            empresa_id,
            cuenta_bancaria_id,
            DATE(created_at) AS fecha_grupo,
            MIN(created_at) AS min_created_at,
            COUNT(*) AS total_regs,
            SUM(COALESCE(deposito, 0)) AS tot_dep,
            SUM(COALESCE(retiro, 0)) AS tot_ret
        FROM public.movimientos_bancarios
        WHERE carga_id IS NULL
        GROUP BY empresa_id, cuenta_bancaria_id, DATE(created_at)
    LOOP
        INSERT INTO public.cargas_estados_cuenta (
            nombre_archivo,
            fecha_carga,
            cuenta_bancaria_id,
            empresa_id,
            total_registros,
            total_depositos,
            total_retiros,
            notas
        ) VALUES (
            'Carga Existente (' || TO_CHAR(rec.fecha_grupo, 'YYYY-MM-DD') || ')',
            rec.min_created_at,
            rec.cuenta_bancaria_id,
            rec.empresa_id,
            rec.total_regs,
            rec.tot_dep,
            rec.tot_ret,
            'Asociación automática de movimientos existentes en el sistema'
        )
        RETURNING id INTO v_carga_id;

        UPDATE public.movimientos_bancarios
        SET carga_id = v_carga_id
        WHERE carga_id IS NULL 
          AND (empresa_id IS NOT DISTINCT FROM rec.empresa_id)
          AND (cuenta_bancaria_id IS NOT DISTINCT FROM rec.cuenta_bancaria_id)
          AND DATE(created_at) = rec.fecha_grupo;
    END LOOP;

    -- Reactivar triggers de usuario
    ALTER TABLE public.movimientos_bancarios ENABLE TRIGGER USER;
EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.movimientos_bancarios ENABLE TRIGGER USER;
    RAISE;
END $$;
