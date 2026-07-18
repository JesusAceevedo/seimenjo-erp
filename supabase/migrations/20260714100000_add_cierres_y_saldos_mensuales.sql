-- Migración para control de cierres mensuales y saldos por cuenta

-- 1. Tabla de cierres mensuales
CREATE TABLE IF NOT EXISTS public.cierres_mensuales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    mes TEXT NOT NULL, -- Formato 'YYYY-MM'
    estatus TEXT NOT NULL CHECK (estatus IN ('abierto', 'pre_cerrado', 'cerrado_definitivo')),
    cerrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fecha_cierre TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    comentarios TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_empresa_mes UNIQUE (empresa_id, mes)
);

-- 2. Tabla de saldos mensuales de cuentas bancarias
CREATE TABLE IF NOT EXISTS public.saldos_mensuales_cuentas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    cuenta_bancaria_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE CASCADE,
    mes TEXT NOT NULL, -- Formato 'YYYY-MM'
    saldo_inicial NUMERIC NOT NULL DEFAULT 0,
    saldo_final NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_cuenta_mes UNIQUE (cuenta_bancaria_id, mes)
);

-- Habilitar RLS
ALTER TABLE public.cierres_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos_mensuales_cuentas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Aislamiento multiempresa para cierres_mensuales" ON public.cierres_mensuales;
CREATE POLICY "Aislamiento multiempresa para cierres_mensuales" ON public.cierres_mensuales
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

DROP POLICY IF EXISTS "Aislamiento multiempresa para saldos_mensuales_cuentas" ON public.saldos_mensuales_cuentas;
CREATE POLICY "Aislamiento multiempresa para saldos_mensuales_cuentas" ON public.saldos_mensuales_cuentas
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Permisos
GRANT ALL ON TABLE public.cierres_mensuales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.saldos_mensuales_cuentas TO anon, authenticated, service_role;

-- 3. Función y Triggers para bloqueo por cierre definitivo
CREATE OR REPLACE FUNCTION public.block_operation_on_closed_period()
RETURNS TRIGGER AS $$
DECLARE
    emp_id UUID;
    op_date DATE;
    is_closed BOOLEAN;
BEGIN
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

-- Triggers
DROP TRIGGER IF EXISTS trigger_check_closed_period_gastos ON public.gastos;
CREATE TRIGGER trigger_check_closed_period_gastos
BEFORE INSERT OR UPDATE OR DELETE ON public.gastos
FOR EACH ROW EXECUTE FUNCTION public.block_operation_on_closed_period();

DROP TRIGGER IF EXISTS trigger_check_closed_period_pedidos ON public.pedidos;
CREATE TRIGGER trigger_check_closed_period_pedidos
BEFORE INSERT OR UPDATE OR DELETE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.block_operation_on_closed_period();

DROP TRIGGER IF EXISTS trigger_check_closed_period_movimientos ON public.movimientos_bancarios;
CREATE TRIGGER trigger_check_closed_period_movimientos
BEFORE INSERT OR UPDATE OR DELETE ON public.movimientos_bancarios
FOR EACH ROW EXECUTE FUNCTION public.block_operation_on_closed_period();

-- Recargar esquema
NOTIFY pgrst, 'reload schema';
