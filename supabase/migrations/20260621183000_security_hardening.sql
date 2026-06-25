-- =====================================================================
-- MIGRACIÓN DE SEGURIDAD: AISLAMIENTO MULTI-INQUILINO Y RLS (HARDENING)
-- =====================================================================

-- 1. ASEGURAR AISLAMIENTO MULTIEMPRESA EN CUENTAS BANCARIAS
ALTER TABLE public.cuentas_bancarias 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();

-- Eliminar políticas antiguas e inseguras
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cuentas_bancarias;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.cuentas_bancarias;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.cuentas_bancarias;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.cuentas_bancarias;

-- Crear política RLS multiempresa
CREATE POLICY "Aislamiento multiempresa para cuentas_bancarias" ON public.cuentas_bancarias
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- 2. ASEGURAR POLÍTICAS RLS EN TABLA DE EMPRESAS
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en empresas" ON public.empresas;
CREATE POLICY "Aislamiento multiempresa para empresas" ON public.empresas
    FOR ALL TO authenticated
    USING (is_superusuario() OR id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR id = get_auth_empresa_id());

-- 3. ASEGURAR POLÍTICAS RLS EN USUARIOS STAFF (EVITA ELEVACIÓN DE PRIVILEGIOS)
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en usuarios_staff" ON public.usuarios_staff;
CREATE POLICY "Aislamiento multiempresa para usuarios_staff" ON public.usuarios_staff
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id() OR id = auth.uid())
    WITH CHECK (
        is_superusuario() OR 
        (empresa_id = get_auth_empresa_id() AND es_superusuario = FALSE) -- Solo superusuarios pueden crear/hacer otros superusuarios
    );

-- 4. ASEGURAR POLÍTICAS RLS EN PERFILES DE SEGURIDAD
DROP POLICY IF EXISTS "Permitir todo a autenticados en perfiles_seguridad" ON public.perfiles_seguridad;
CREATE POLICY "Aislamiento multiempresa para perfiles_seguridad" ON public.perfiles_seguridad
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- 5. ASEGURAR POLÍTICAS RLS EN MÓDULOS DE EMPRESA
DROP POLICY IF EXISTS "Permitir todo a autenticados en modulos_empresa" ON public.modulos_empresa;
CREATE POLICY "Aislamiento multiempresa para modulos_empresa" ON public.modulos_empresa
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- 6. ASEGURAR POLÍTICAS RLS EN CONFIGURACIÓN DE TICKET
DROP POLICY IF EXISTS "Permitir lectura publica de la configuracion del ticket" ON public.configuracion_ticket;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en configuracion_ticket" ON public.configuracion_ticket;

-- Permitir que cualquier usuario (incluso no autenticado para el login) lea configuraciones de ticket,
-- pero limitar la escritura/actualización únicamente a la propia empresa o superusuario.
CREATE POLICY "Permitir lectura publica de configuracion_ticket" ON public.configuracion_ticket
    FOR SELECT TO public USING (true);

CREATE POLICY "Permitir gestion de configuracion_ticket por empresa" ON public.configuracion_ticket
    FOR ALL TO authenticated
    USING (is_superusuario() OR id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR id = get_auth_empresa_id());

-- 7. ASEGURAR POLÍTICAS RLS EN TABLAS PIVOT (SUCURSALES Y EMPRESAS PIVOTS)
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en sucursales_usuario_pivot" ON public.sucursales_usuario_pivot;
CREATE POLICY "Aislamiento multiempresa sucursales_usuario_pivot" ON public.sucursales_usuario_pivot
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        usuario_id IN (SELECT id FROM public.usuarios_staff WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR 
        usuario_id IN (SELECT id FROM public.usuarios_staff WHERE empresa_id = get_auth_empresa_id())
    );

DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en empresas_usuario_pivot" ON public.empresas_usuario_pivot;
CREATE POLICY "Aislamiento multiempresa empresas_usuario_pivot" ON public.empresas_usuario_pivot
    FOR ALL TO authenticated
    USING (
        is_superusuario() OR 
        usuario_id IN (SELECT id FROM public.usuarios_staff WHERE empresa_id = get_auth_empresa_id())
    )
    WITH CHECK (
        is_superusuario() OR 
        usuario_id IN (SELECT id FROM public.usuarios_staff WHERE empresa_id = get_auth_empresa_id())
    );

-- 8. CORREGIR POLÍTICAS RLS EN CATÁLOGOS GLOBALES (SOLO LECTURA PARA USUARIOS COMUNES)
-- formas_pago
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en formas_pago" ON public.formas_pago;
CREATE POLICY "Lectura publica de formas_pago" ON public.formas_pago FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modificacion de formas_pago restringida a superusuarios" ON public.formas_pago
    FOR ALL TO authenticated USING (is_superusuario()) WITH CHECK (is_superusuario());

-- estatus_factura
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en estatus_factura" ON public.estatus_factura;
CREATE POLICY "Lectura publica de estatus_factura" ON public.estatus_factura FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modificacion de estatus_factura restringida a superusuarios" ON public.estatus_factura
    FOR ALL TO authenticated USING (is_superusuario()) WITH CHECK (is_superusuario());

-- regimenes_fiscales
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en regimenes_fiscales" ON public.regimenes_fiscales;
CREATE POLICY "Lectura publica de regimenes_fiscales" ON public.regimenes_fiscales FOR SELECT USING (true);
CREATE POLICY "Modificacion de regimenes_fiscales restringida a superusuarios" ON public.regimenes_fiscales
    FOR ALL TO authenticated USING (is_superusuario()) WITH CHECK (is_superusuario());

-- usos_cfdi
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en usos_cfdi" ON public.usos_cfdi;
CREATE POLICY "Lectura publica de usos_cfdi" ON public.usos_cfdi FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modificacion de usos_cfdi restringida a superusuarios" ON public.usos_cfdi
    FOR ALL TO authenticated USING (is_superusuario()) WITH CHECK (is_superusuario());

-- 9. CREAR ÍNDICES DE OPTIMIZACIÓN MULTIEMPRESA EN TABLAS TRANSACCIONALES CLAVE
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_id ON public.pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gastos_empresa_id ON public.gastos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_productos_empresa_id ON public.productos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_empresa_id ON public.proveedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_bancarios_empresa_id ON public.movimientos_bancarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_conciliaciones_bancarias_empresa_id ON public.conciliaciones_bancarias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_bancarias_empresa_id ON public.cuentas_bancarias(empresa_id);
