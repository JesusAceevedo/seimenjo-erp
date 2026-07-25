-- MIGRACIÓN: Optimización de Rendimiento Multi-tenant (Añadir empresa_id a tablas hijas)
-- Fecha: 2026-07-25

-- 1. Añadir columna empresa_id a tablas hijas
ALTER TABLE public.pedido_detalles ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.horarios_empleados ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.regla_puesto_detalle ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.propinas_distribucion_empleado ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.recibos_nomina ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.patron_descanso_dias ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.turnos_puesto ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.rotacion_turnos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.vacaciones_empleado ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.prima_antiguedad_acumulada ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 2. Poblar retroactivamente empresa_id desde los registros padres
UPDATE public.pedido_detalles pd SET empresa_id = p.empresa_id FROM public.pedidos p WHERE pd.pedido_id = p.id AND pd.empresa_id IS NULL;
UPDATE public.horarios_empleados he SET empresa_id = e.empresa_id FROM public.empleados_detalle e WHERE he.empleado_id = e.id AND he.empresa_id IS NULL;
UPDATE public.regla_puesto_detalle rpd SET empresa_id = r.empresa_id FROM public.reglas_pool_propinas r WHERE rpd.regla_id = r.id AND rpd.empresa_id IS NULL;
UPDATE public.propinas_distribucion_empleado pde SET empresa_id = e.empresa_id FROM public.empleados_detalle e WHERE pde.empleado_id = e.id AND pde.empresa_id IS NULL;
UPDATE public.recibos_nomina rn SET empresa_id = e.empresa_id FROM public.empleados_detalle e WHERE rn.empleado_id = e.id AND rn.empresa_id IS NULL;
UPDATE public.patron_descanso_dias pdd SET empresa_id = p.empresa_id FROM public.patrones_descanso p WHERE pdd.patron_id = p.id AND pdd.empresa_id IS NULL;
UPDATE public.turnos_puesto tp SET empresa_id = p.empresa_id FROM public.puestos_trabajo p WHERE tp.puesto_id = p.id AND tp.empresa_id IS NULL;
UPDATE public.rotacion_turnos rt SET empresa_id = e.empresa_id FROM public.empleados_detalle e WHERE rt.empleado_id = e.id AND rt.empresa_id IS NULL;
UPDATE public.vacaciones_empleado ve SET empresa_id = e.empresa_id FROM public.empleados_detalle e WHERE ve.empleado_id = e.id AND ve.empresa_id IS NULL;
UPDATE public.prima_antiguedad_acumulada paa SET empresa_id = e.empresa_id FROM public.empleados_detalle e WHERE paa.empleado_id = e.id AND paa.empresa_id IS NULL;

-- 3. Crear índices directos por empresa_id
CREATE INDEX IF NOT EXISTS idx_pedido_detalles_empresa ON public.pedido_detalles(empresa_id);
CREATE INDEX IF NOT EXISTS idx_horarios_empleados_empresa ON public.horarios_empleados(empresa_id);
CREATE INDEX IF NOT EXISTS idx_recibos_nomina_empresa ON public.recibos_nomina(empresa_id);

-- 4. Optimizar políticas RLS para evitar subconsultas (direct evaluation)
DROP POLICY IF EXISTS "Aislamiento horarios" ON public.horarios_empleados;
CREATE POLICY "Aislamiento horarios" ON public.horarios_empleados
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

DROP POLICY IF EXISTS "Aislamiento recibos" ON public.recibos_nomina;
CREATE POLICY "Aislamiento recibos" ON public.recibos_nomina
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

DROP POLICY IF EXISTS "Aislamiento propinas distribucion" ON public.propinas_distribucion_empleado;
CREATE POLICY "Aislamiento propinas distribucion" ON public.propinas_distribucion_empleado
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

DROP POLICY IF EXISTS "Aislamiento vacaciones_empleado" ON public.vacaciones_empleado;
CREATE POLICY "Aislamiento vacaciones_empleado" ON public.vacaciones_empleado
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

DROP POLICY IF EXISTS "Aislamiento prima_antiguedad" ON public.prima_antiguedad_acumulada;
CREATE POLICY "Aislamiento prima_antiguedad" ON public.prima_antiguedad_acumulada
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());
