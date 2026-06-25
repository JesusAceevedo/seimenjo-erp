-- =====================================================================
-- MIGRACIÓN: Módulo de Inventario Multialmacén
-- =====================================================================

-- 1. TABLA: almacenes
CREATE TABLE IF NOT EXISTS public.almacenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    es_principal BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.almacenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aislamiento por empresa en almacenes" 
    ON public.almacenes FOR ALL TO authenticated 
    USING (empresa_id = public.get_auth_empresa_id()) 
    WITH CHECK (empresa_id = public.get_auth_empresa_id());

-- 2. TABLA: inventario_stock
CREATE TABLE IF NOT EXISTS public.inventario_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    almacen_id UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
    producto_variante_id UUID NOT NULL REFERENCES public.producto_variantes(id) ON DELETE CASCADE,
    cantidad_actual NUMERIC NOT NULL DEFAULT 0,
    stock_minimo NUMERIC NOT NULL DEFAULT 0,
    costo_promedio NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(almacen_id, producto_variante_id)
);

-- Habilitar RLS
ALTER TABLE public.inventario_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aislamiento por empresa en inventario_stock" 
    ON public.inventario_stock FOR ALL TO authenticated 
    USING (empresa_id = public.get_auth_empresa_id()) 
    WITH CHECK (empresa_id = public.get_auth_empresa_id());

-- 3. TABLA: movimientos_inventario
CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    almacen_id UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
    producto_variante_id UUID NOT NULL REFERENCES public.producto_variantes(id) ON DELETE CASCADE,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('Entrada', 'Salida', 'Ajuste', 'Transferencia')),
    cantidad NUMERIC NOT NULL,
    costo_unitario NUMERIC NOT NULL DEFAULT 0,
    referencia TEXT,
    creado_por UUID REFERENCES public.usuarios_staff(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aislamiento por empresa en movimientos_inventario" 
    ON public.movimientos_inventario FOR ALL TO authenticated 
    USING (empresa_id = public.get_auth_empresa_id()) 
    WITH CHECK (empresa_id = public.get_auth_empresa_id());

-- =====================================================================
-- FUNCIÓN RPC: registrar_movimiento_inventario
-- Permite transacciones atómicas para actualizar stock y costo promedio.
-- =====================================================================
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

    -- Actualizar el inventario
    UPDATE public.inventario_stock
    SET cantidad_actual = v_nueva_cantidad,
        costo_promedio = v_nuevo_costo_promedio,
        updated_at = timezone('utc'::text, now())
    WHERE almacen_id = p_almacen_id AND producto_variante_id = p_producto_variante_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- TRIGGER PARA GENERAR ALMACENES INICIALES
-- Cuando se crea una nueva empresa, se le crean por defecto sus almacenes.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crear_almacenes_por_defecto()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.almacenes (empresa_id, nombre, es_principal)
    VALUES 
        (NEW.id, 'Bodega Principal', true),
        (NEW.id, 'Mostrador', false);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador que ejecuta la función al insertar en 'empresas'
DROP TRIGGER IF EXISTS trigger_crear_almacenes_por_defecto ON public.empresas;
CREATE TRIGGER trigger_crear_almacenes_por_defecto
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.crear_almacenes_por_defecto();

-- Llenar retroactivamente almacenes para empresas existentes que no los tengan
DO $$
DECLARE
    empresa RECORD;
BEGIN
    FOR empresa IN SELECT id FROM public.empresas
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.almacenes WHERE empresa_id = empresa.id) THEN
            INSERT INTO public.almacenes (empresa_id, nombre, es_principal)
            VALUES 
                (empresa.id, 'Bodega Principal', true),
                (empresa.id, 'Mostrador', false);
        END IF;
    END LOOP;
END;
$$;
