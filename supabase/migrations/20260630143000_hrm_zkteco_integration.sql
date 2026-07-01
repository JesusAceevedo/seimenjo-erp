-- =========================================================================
-- MIGRACIÓN: MÓDULO INTEGRAL DE RR.HH. Y NOMINA CON BIOMÉTRICO
-- =========================================================================

-- 1. Catálogos base: Departamentos
CREATE TABLE IF NOT EXISTS public.departamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empresa_id, nombre)
);

-- 2. Catálogos base: Puestos / Roles de Restaurante
CREATE TABLE IF NOT EXISTS public.puestos_trabajo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    nombre VARCHAR(100) NOT NULL, -- 'Mesero', 'Cocinero A', 'Hostess', etc.
    departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
    salario_diario_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    puntos_propina DECIMAL(5,2) DEFAULT 1.00,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empresa_id, nombre)
);

-- 3. Información Laboral Extendida de los Empleados
CREATE TABLE IF NOT EXISTS public.empleados_detalle (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_staff_id UUID UNIQUE REFERENCES public.usuarios_staff(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    puesto_id UUID REFERENCES public.puestos_trabajo(id) ON DELETE SET NULL,
    
    primer_apellido VARCHAR(100) NOT NULL,
    segundo_apellido VARCHAR(100),
    primer_nombre VARCHAR(100) NOT NULL,
    segundo_nombre VARCHAR(100),
    nombre_completo VARCHAR(255) GENERATED ALWAYS AS (
        trim(both ' ' from 
            coalesce(primer_apellido, '') || ' ' || 
            coalesce(segundo_apellido, '') || ' ' || 
            coalesce(primer_nombre, '') || ' ' || 
            coalesce(segundo_nombre, '')
        )
    ) STORED,
    curp VARCHAR(18) UNIQUE,
    rfc VARCHAR(13) UNIQUE,
    nss VARCHAR(11) UNIQUE,
    telefono VARCHAR(20),
    fotografia_url TEXT,
    
    banco VARCHAR(100),
    cuenta_clabe VARCHAR(18),
    sueldo_diario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    salario_diario_integrado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    
    zkteco_user_id VARCHAR(50) NULL,
    
    tipo_contrato VARCHAR(50) DEFAULT 'indeterminado',
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_baja DATE NULL,
    activo BOOLEAN DEFAULT TRUE,
    
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (empresa_id, zkteco_user_id)
);

-- Asegurar columnas individuales de nombre si la tabla ya existía
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'empleados_detalle') THEN
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'primer_apellido') THEN
            ALTER TABLE public.empleados_detalle ADD COLUMN primer_apellido VARCHAR(100) DEFAULT '';
            ALTER TABLE public.empleados_detalle ALTER COLUMN primer_apellido SET NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'segundo_apellido') THEN
            ALTER TABLE public.empleados_detalle ADD COLUMN segundo_apellido VARCHAR(100);
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'primer_nombre') THEN
            ALTER TABLE public.empleados_detalle ADD COLUMN primer_nombre VARCHAR(100) DEFAULT '';
            ALTER TABLE public.empleados_detalle ALTER COLUMN primer_nombre SET NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'segundo_nombre') THEN
            ALTER TABLE public.empleados_detalle ADD COLUMN segundo_nombre VARCHAR(100);
        END IF;

        -- Forzar nombre_completo como columna generada STORED
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'nombre_completo') THEN
            -- Solo eliminar si no es ya una columna generada (evita recrearla si ya está bien)
            IF (SELECT is_generated FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'empleados_detalle' AND column_name = 'nombre_completo') <> 'ALWAYS' THEN
                ALTER TABLE public.empleados_detalle DROP COLUMN nombre_completo;
                ALTER TABLE public.empleados_detalle ADD COLUMN nombre_completo VARCHAR(255) GENERATED ALWAYS AS (
                    trim(both ' ' from 
                        coalesce(primer_apellido, '') || ' ' || 
                        coalesce(segundo_apellido, '') || ' ' || 
                        coalesce(primer_nombre, '') || ' ' || 
                        coalesce(segundo_nombre, '')
                    )
                ) STORED;
            END IF;
        ELSE
            ALTER TABLE public.empleados_detalle ADD COLUMN nombre_completo VARCHAR(255) GENERATED ALWAYS AS (
                trim(both ' ' from 
                    coalesce(primer_apellido, '') || ' ' || 
                    coalesce(segundo_apellido, '') || ' ' || 
                    coalesce(primer_nombre, '') || ' ' || 
                    coalesce(segundo_nombre, '')
                )
            ) STORED;
        END IF;

    END IF;
END
$$;

-- 4. Gestión de Horarios y Turnos (Soporta turnos partidos / divididos)
CREATE TABLE IF NOT EXISTS public.turnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    nombre VARCHAR(100) NOT NULL,
    tipo_turno VARCHAR(20) DEFAULT 'fijo',
    
    hora_entrada_1 TIME NOT NULL,
    hora_salida_1 TIME NOT NULL,
    
    hora_entrada_2 TIME NULL,
    hora_salida_2 TIME NULL,
    
    tolerancia_minutos INT DEFAULT 15,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Asignación Semanal de Horarios por Empleado
CREATE TABLE IF NOT EXISTS public.horarios_empleados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    turno_id UUID REFERENCES public.turnos(id) ON DELETE SET NULL,
    es_dia_descanso BOOLEAN DEFAULT FALSE,
    UNIQUE (empleado_id, dia_semana)
);

-- 5. Control de Asistencia y Checadas Biométricas (Real-Time ADMS)
CREATE TABLE IF NOT EXISTS public.asistencia_checadas_raw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    zkteco_user_id VARCHAR(50) NOT NULL,
    dispositivo_sn VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    tipo_evento VARCHAR(20),
    metodo_verificacion VARCHAR(20),
    procesado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Registros de Asistencia Diaria Procesada
CREATE TABLE IF NOT EXISTS public.asistencia_diaria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    
    entrada_1 TIMESTAMPTZ,
    salida_1 TIMESTAMPTZ,
    
    entrada_2 TIMESTAMPTZ,
    salida_2 TIMESTAMPTZ,
    
    minutos_retardo INT DEFAULT 0,
    horas_trabajadas DECIMAL(5,2) DEFAULT 0.00,
    horas_extras_dobles DECIMAL(5,2) DEFAULT 0.00,
    horas_extras_triples DECIMAL(5,2) DEFAULT 0.00,
    es_dia_festivo_trabajado BOOLEAN DEFAULT FALSE,
    estatus_asistencia VARCHAR(20) DEFAULT 'asistencia',
    
    UNIQUE (empleado_id, fecha)
);

-- 6. Incidencias, Vacaciones y Permisos
CREATE TABLE IF NOT EXISTS public.incidencias_solicitudes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    tipo_incidencia VARCHAR(50) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    total_dias INT NOT NULL,
    motivo TEXT,
    estatus VARCHAR(20) DEFAULT 'pendiente',
    aprobado_por UUID REFERENCES public.usuarios_staff(id) ON DELETE SET NULL,
    fecha_aprobacion TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Módulo de Propinas (Pool Management)
CREATE TABLE IF NOT EXISTS public.reglas_pool_propinas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    nombre VARCHAR(100) NOT NULL,
    metodo_distribucion VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.regla_puesto_detalle (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    regla_id UUID REFERENCES public.reglas_pool_propinas(id) ON DELETE CASCADE,
    puesto_id UUID REFERENCES public.puestos_trabajo(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.propinas_acumuladas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    fecha DATE NOT NULL,
    monto_total DECIMAL(10,2) NOT NULL,
    origen VARCHAR(50) DEFAULT 'manual',
    distribuida BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.propinas_distribucion_empleado (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    propina_acumulada_id UUID REFERENCES public.propinas_acumuladas(id) ON DELETE CASCADE,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    monto_recibido DECIMAL(10,2) NOT NULL,
    horas_consideradas DECIMAL(5,2) DEFAULT 0.00,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Módulo de Nómina (Cálculos LFT)
CREATE TABLE IF NOT EXISTS public.periodos_nomina (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    frecuencia VARCHAR(20) NOT NULL,
    estatus VARCHAR(20) DEFAULT 'abierto',
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recibos_nomina (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    periodo_id UUID REFERENCES public.periodos_nomina(id) ON DELETE CASCADE,
    empleado_id UUID REFERENCES public.empleados_detalle(id) ON DELETE CASCADE,
    
    dias_trabajados DECIMAL(4,2) DEFAULT 0.00,
    sueldo_ordinario DECIMAL(12,2) DEFAULT 0.00,
    pago_horas_extras_dobles DECIMAL(12,2) DEFAULT 0.00,
    pago_horas_extras_triples DECIMAL(12,2) DEFAULT 0.00,
    pago_dias_festivos DECIMAL(12,2) DEFAULT 0.00,
    prima_vacacional DECIMAL(12,2) DEFAULT 0.00,
    aguinaldo DECIMAL(12,2) DEFAULT 0.00,
    otras_percepciones DECIMAL(12,2) DEFAULT 0.00,
    total_percepciones DECIMAL(12,2) DEFAULT 0.00,
    
    retencion_isr DECIMAL(12,2) DEFAULT 0.00,
    retencion_imss DECIMAL(12,2) DEFAULT 0.00,
    descuento_retardos DECIMAL(12,2) DEFAULT 0.00,
    otras_deducciones DECIMAL(12,2) DEFAULT 0.00,
    total_deducciones DECIMAL(12,2) DEFAULT 0.00,
    
    sueldo_neto DECIMAL(12,2) DEFAULT 0.00,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puestos_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_checadas_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias_solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglas_pool_propinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regla_puesto_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propinas_acumuladas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propinas_distribucion_empleado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_nomina ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_nomina ENABLE ROW LEVEL SECURITY;

-- Crear Políticas de RLS Multi-Inquilino
CREATE POLICY "Aislamiento departamentos" ON public.departamentos
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento puestos" ON public.puestos_trabajo
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento empleados" ON public.empleados_detalle
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id() OR usuario_staff_id = auth.uid())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento turnos" ON public.turnos
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento horarios" ON public.horarios_empleados
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id() OR usuario_staff_id = auth.uid())
    )
    WITH CHECK (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento checadas raw" ON public.asistencia_checadas_raw
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento asistencia diaria" ON public.asistencia_diaria
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id() OR usuario_staff_id = auth.uid())
    )
    WITH CHECK (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento incidencias" ON public.incidencias_solicitudes
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id() OR usuario_staff_id = auth.uid())
    )
    WITH CHECK (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento reglas propinas" ON public.reglas_pool_propinas
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento regla puesto detalle" ON public.regla_puesto_detalle
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        regla_id IN (SELECT id FROM public.reglas_pool_propinas WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR 
        regla_id IN (SELECT id FROM public.reglas_pool_propinas WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento propinas acumuladas" ON public.propinas_acumuladas
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento propinas distribucion" ON public.propinas_distribucion_empleado
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id() OR usuario_staff_id = auth.uid())
    )
    WITH CHECK (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );

CREATE POLICY "Aislamiento periodos nomina" ON public.periodos_nomina
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Aislamiento recibos" ON public.recibos_nomina
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id() OR usuario_staff_id = auth.uid())
    )
    WITH CHECK (
        is_superusuario() OR 
        empleado_id IN (SELECT id FROM public.empleados_detalle WHERE empresa_id = get_auth_empresa_id())
    );
