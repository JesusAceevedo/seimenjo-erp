-- =========================================================================
-- MIGRACIÓN: MEJORAS RESTAURANTE - DESCANSOS ROTATIVOS, TURNOS POR PUESTO
-- =========================================================================

-- 1. Patrones de descanso (Semana A = Martes, Semana B = Martes+Miércoles)
CREATE TABLE IF NOT EXISTS public.patrones_descanso (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    nombre VARCHAR(100) NOT NULL,
    tipo_patron VARCHAR(20) DEFAULT 'quincenal' CHECK (tipo_patron IN ('semanal', 'quincenal', 'mensual')),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empresa_id, nombre)
);

CREATE TABLE IF NOT EXISTS public.patron_descanso_dias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patron_id UUID REFERENCES public.patrones_descanso(id) ON DELETE CASCADE,
    semana_idx INT NOT NULL CHECK (semana_idx >= 0),
    dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    es_descanso BOOLEAN DEFAULT TRUE,
    UNIQUE (patron_id, semana_idx, dia_semana)
);

CREATE TABLE IF NOT EXISTS public.empleado_patron_descanso (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    patron_id UUID REFERENCES public.patrones_descanso(id) ON DELETE SET NULL,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    alterna BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empleado_id)
);

CREATE TABLE IF NOT EXISTS public.descansos_mensuales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    es_descanso BOOLEAN DEFAULT TRUE,
    motivo VARCHAR(50) DEFAULT 'patron' CHECK (motivo IN ('patron', 'cambio', 'extraordinario')),
    UNIQUE (empleado_id, fecha)
);

-- 2. Turnos múltiples por puesto
CREATE TABLE IF NOT EXISTS public.turnos_puesto (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    puesto_id UUID REFERENCES public.puestos_trabajo(id) ON DELETE CASCADE,
    turno_id UUID REFERENCES public.turnos(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE (puesto_id, turno_id)
);

-- 3. Rotación de turnos por empleado
CREATE TABLE IF NOT EXISTS public.rotacion_turnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    secuencia INT NOT NULL,
    turno_id UUID REFERENCES public.turnos(id) ON DELETE CASCADE,
    UNIQUE (empleado_id, secuencia)
);

-- 4. Columna categoría en comandos ZKTeco para organización en el tab Reloj
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'zkteco_comandos' AND column_name = 'categoria'
    ) THEN
        ALTER TABLE public.zkteco_comandos ADD COLUMN categoria VARCHAR(50) DEFAULT 'general';
    END IF;
END $$;

-- 5. Añadir campos de LFT a empleados_detalle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'fecha_antiguedad'
    ) THEN
        ALTER TABLE public.empleados_detalle ADD COLUMN fecha_antiguedad DATE;
    END IF;
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'domicilio'
    ) THEN
        ALTER TABLE public.empleados_detalle ADD COLUMN domicilio TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'es_sindicalizado'
    ) THEN
        ALTER TABLE public.empleados_detalle ADD COLUMN es_sindicalizado BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 6. Tabla de días festivos LFT (Art. 74)
CREATE TABLE IF NOT EXISTS public.dias_festivos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    fecha DATE NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    es_recurrente BOOLEAN DEFAULT FALSE,
    UNIQUE (empresa_id, fecha)
);

-- 7. Tabla para control de vacaciones por empleado
CREATE TABLE IF NOT EXISTS public.vacaciones_empleado (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    dias_correspondientes INT NOT NULL,
    dias_disfrutados INT DEFAULT 0,
    UNIQUE (empleado_id, periodo_inicio)
);

-- 8. Tabla de prima de antigüedad acumulada
CREATE TABLE IF NOT EXISTS public.prima_antiguedad_acumulada (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    anios_servicio INT NOT NULL,
    monto_acumulado DECIMAL(12,2) DEFAULT 0,
    UNIQUE (empleado_id, anios_servicio)
);

-- RLS
ALTER TABLE public.patrones_descanso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patron_descanso_dias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleado_patron_descanso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descansos_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_puesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotacion_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dias_festivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacaciones_empleado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prima_antiguedad_acumulada ENABLE ROW LEVEL SECURITY;

-- Políticas RLS multi-inquilino
CREATE POLICY "Aislamiento patrones_descanso" ON public.patrones_descanso
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento patron_descanso_dias" ON public.patron_descanso_dias
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        patron_id IN (SELECT id FROM public.patrones_descanso WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        patron_id IN (SELECT id FROM public.patrones_descanso WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento empleado_patron_descanso" ON public.empleado_patron_descanso
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento descansos_mensuales" ON public.descansos_mensuales
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento turnos_puesto" ON public.turnos_puesto
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        puesto_id IN (SELECT id FROM public.puestos_trabajo WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        puesto_id IN (SELECT id FROM public.puestos_trabajo WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento rotacion_turnos" ON public.rotacion_turnos
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento dias_festivos" ON public.dias_festivos
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento vacaciones_empleado" ON public.vacaciones_empleado
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento prima_antiguedad" ON public.prima_antiguedad_acumulada
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );
