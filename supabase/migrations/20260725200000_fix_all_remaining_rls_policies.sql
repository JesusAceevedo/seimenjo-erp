-- MIGRACIÓN DEFINITIVA: Corregir todas las políticas RLS restantes que no fueron cubiertas
-- por las migraciones anteriores. Garantizar acceso total a usuarios autenticados en TODAS las tablas.
-- Fecha: 2026-07-25

-- ============================================================
-- 1. TABLAS DE CATÁLOGOS (formas_pago, estatus_factura, etc.)
-- ============================================================
-- formas_pago
DROP POLICY IF EXISTS "Lectura publica de formas_pago" ON public.formas_pago;
DROP POLICY IF EXISTS "Modificacion de formas_pago restringida a superusuarios" ON public.formas_pago;
CREATE POLICY "Acceso total autenticados formas_pago" ON public.formas_pago
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- estatus_factura
DROP POLICY IF EXISTS "Lectura publica de estatus_factura" ON public.estatus_factura;
DROP POLICY IF EXISTS "Modificacion de estatus_factura restringida a superusuarios" ON public.estatus_factura;
CREATE POLICY "Acceso total autenticados estatus_factura" ON public.estatus_factura
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- regimenes_fiscales
DROP POLICY IF EXISTS "Lectura publica de regimenes_fiscales" ON public.regimenes_fiscales;
DROP POLICY IF EXISTS "Modificacion de regimenes_fiscales restringida a superusuarios" ON public.regimenes_fiscales;
CREATE POLICY "Acceso total autenticados regimenes_fiscales" ON public.regimenes_fiscales
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- usos_cfdi
DROP POLICY IF EXISTS "Lectura publica de usos_cfdi" ON public.usos_cfdi;
DROP POLICY IF EXISTS "Modificacion de usos_cfdi restringida a superusuarios" ON public.usos_cfdi;
CREATE POLICY "Acceso total autenticados usos_cfdi" ON public.usos_cfdi
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. TABLAS DE CONFIGURACIÓN
-- ============================================================
DROP POLICY IF EXISTS "Permitir lectura publica de configuracion_ticket" ON public.configuracion_ticket;
DROP POLICY IF EXISTS "Permitir gestion de configuracion_ticket por empresa" ON public.configuracion_ticket;
CREATE POLICY "Acceso total autenticados configuracion_ticket" ON public.configuracion_ticket
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Lectura publica configuracion_ticket" ON public.configuracion_ticket
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 3. TABLAS DE USUARIOS / PIVOTS
-- ============================================================
DROP POLICY IF EXISTS "Aislamiento multiempresa para usuarios_staff" ON public.usuarios_staff;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en usuarios_staff" ON public.usuarios_staff;
CREATE POLICY "Acceso total autenticados usuarios_staff" ON public.usuarios_staff
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa sucursales_usuario_pivot" ON public.sucursales_usuario_pivot;
CREATE POLICY "Acceso total autenticados sucursales_usuario_pivot" ON public.sucursales_usuario_pivot
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa empresas_usuario_pivot" ON public.empresas_usuario_pivot;
CREATE POLICY "Acceso total autenticados empresas_usuario_pivot" ON public.empresas_usuario_pivot
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para empresas" ON public.empresas;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en empresas" ON public.empresas;
CREATE POLICY "Acceso total autenticados empresas" ON public.empresas
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Lectura publica empresas" ON public.empresas
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 4. TABLAS RRHH / ASISTENCIA / NÓMINA (con RLS habilitado)
-- ============================================================
DROP POLICY IF EXISTS "Aislamiento multiempresa para departamentos" ON public.departamentos;
CREATE POLICY "Acceso total autenticados departamentos" ON public.departamentos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para puestos_trabajo" ON public.puestos_trabajo;
CREATE POLICY "Acceso total autenticados puestos_trabajo" ON public.puestos_trabajo
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para empleados_detalle" ON public.empleados_detalle;
CREATE POLICY "Acceso total autenticados empleados_detalle" ON public.empleados_detalle
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para turnos" ON public.turnos;
CREATE POLICY "Acceso total autenticados turnos" ON public.turnos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para horarios_empleados" ON public.horarios_empleados;
CREATE POLICY "Acceso total autenticados horarios_empleados" ON public.horarios_empleados
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para asistencia_checadas_raw" ON public.asistencia_checadas_raw;
CREATE POLICY "Acceso total autenticados asistencia_checadas_raw" ON public.asistencia_checadas_raw
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para asistencia_diaria" ON public.asistencia_diaria;
CREATE POLICY "Acceso total autenticados asistencia_diaria" ON public.asistencia_diaria
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para incidencias_solicitudes" ON public.incidencias_solicitudes;
CREATE POLICY "Acceso total autenticados incidencias_solicitudes" ON public.incidencias_solicitudes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para reglas_pool_propinas" ON public.reglas_pool_propinas;
CREATE POLICY "Acceso total autenticados reglas_pool_propinas" ON public.reglas_pool_propinas
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para regla_puesto_detalle" ON public.regla_puesto_detalle;
CREATE POLICY "Acceso total autenticados regla_puesto_detalle" ON public.regla_puesto_detalle
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para propinas_acumuladas" ON public.propinas_acumuladas;
CREATE POLICY "Acceso total autenticados propinas_acumuladas" ON public.propinas_acumuladas
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para propinas_distribucion_empleado" ON public.propinas_distribucion_empleado;
CREATE POLICY "Acceso total autenticados propinas_distribucion_empleado" ON public.propinas_distribucion_empleado
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para periodos_nomina" ON public.periodos_nomina;
CREATE POLICY "Acceso total autenticados periodos_nomina" ON public.periodos_nomina
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para recibos_nomina" ON public.recibos_nomina;
CREATE POLICY "Acceso total autenticados recibos_nomina" ON public.recibos_nomina
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para patrones_descanso" ON public.patrones_descanso;
CREATE POLICY "Acceso total autenticados patrones_descanso" ON public.patrones_descanso
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para patron_descanso_dias" ON public.patron_descanso_dias;
CREATE POLICY "Acceso total autenticados patron_descanso_dias" ON public.patron_descanso_dias
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para empleado_patron_descanso" ON public.empleado_patron_descanso;
CREATE POLICY "Acceso total autenticados empleado_patron_descanso" ON public.empleado_patron_descanso
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para descansos_mensuales" ON public.descansos_mensuales;
CREATE POLICY "Acceso total autenticados descansos_mensuales" ON public.descansos_mensuales
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para turnos_puesto" ON public.turnos_puesto;
CREATE POLICY "Acceso total autenticados turnos_puesto" ON public.turnos_puesto
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para rotacion_turnos" ON public.rotacion_turnos;
CREATE POLICY "Acceso total autenticados rotacion_turnos" ON public.rotacion_turnos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para dias_festivos" ON public.dias_festivos;
CREATE POLICY "Acceso total autenticados dias_festivos" ON public.dias_festivos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para vacaciones_empleado" ON public.vacaciones_empleado;
CREATE POLICY "Acceso total autenticados vacaciones_empleado" ON public.vacaciones_empleado
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para prima_antiguedad_acumulada" ON public.prima_antiguedad_acumulada;
CREATE POLICY "Acceso total autenticados prima_antiguedad_acumulada" ON public.prima_antiguedad_acumulada
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ZKTeco
DROP POLICY IF EXISTS "Aislamiento multiempresa para zkteco_comandos" ON public.zkteco_comandos;
CREATE POLICY "Acceso total autenticados zkteco_comandos" ON public.zkteco_comandos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. TABLAS DE REPARTIDORES / PRECIOS ESPECIALES / ESTATUS
-- ============================================================
DROP POLICY IF EXISTS "Aislamiento multiempresa para repartidores" ON public.repartidores;
CREATE POLICY "Acceso total autenticados repartidores" ON public.repartidores
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para precios_especiales" ON public.precios_especiales;
CREATE POLICY "Acceso total autenticados precios_especiales" ON public.precios_especiales
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para estatus_conciliacion_bancaria" ON public.estatus_conciliacion_bancaria;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en estatus_conciliacion_bancaria" ON public.estatus_conciliacion_bancaria;
CREATE POLICY "Acceso total autenticados estatus_conciliacion_bancaria" ON public.estatus_conciliacion_bancaria
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 6. TABLAS DE AUDITORÍA
-- ============================================================
DROP POLICY IF EXISTS "Aislamiento multiempresa para registros_auditoria" ON public.registros_auditoria;
CREATE POLICY "Acceso total autenticados registros_auditoria" ON public.registros_auditoria
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Tabla legacy por si todavía existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "Aislamiento multiempresa para audit_logs" ON public.audit_logs;
    EXECUTE 'CREATE POLICY "Acceso total autenticados audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- ============================================================
-- 7. ANON: asegurar SELECT en tablas de tienda
-- ============================================================
-- Re-otorgar SELECT a anon en catálogos de tienda (por si el REVOKE ALL los afectó)
GRANT SELECT ON TABLE public.productos TO anon;
GRANT SELECT ON TABLE public.producto_variantes TO anon;
GRANT SELECT ON TABLE public.empresas TO anon;
GRANT SELECT ON TABLE public.configuracion_ticket TO anon;
GRANT SELECT ON TABLE public.regimenes_fiscales TO anon;
GRANT SELECT ON TABLE public.usos_cfdi TO anon;
GRANT SELECT ON TABLE public.formas_pago TO anon;
GRANT SELECT ON TABLE public.facturas_clientes TO anon;
GRANT SELECT ON TABLE public.precios_especiales TO anon;
GRANT SELECT ON TABLE public.estatus_factura TO anon;
GRANT SELECT ON TABLE public.clientes TO anon;

-- Permisos de tienda para crear pedidos sin autenticar
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedidos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pedido_detalles TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clientes TO anon;

-- Anon policies para tablas de tienda
DROP POLICY IF EXISTS "Permitir pedidos desde tienda anon" ON public.pedidos;
CREATE POLICY "Permitir pedidos desde tienda anon" ON public.pedidos
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir pedido_detalles desde tienda anon" ON public.pedido_detalles;
CREATE POLICY "Permitir pedido_detalles desde tienda anon" ON public.pedido_detalles
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir clientes desde tienda anon" ON public.clientes;
CREATE POLICY "Permitir clientes desde tienda anon" ON public.clientes
  FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura publica facturas_clientes" ON public.facturas_clientes;
CREATE POLICY "Permitir lectura publica facturas_clientes" ON public.facturas_clientes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Lectura publica productos anon" ON public.productos;
CREATE POLICY "Lectura publica productos anon" ON public.productos
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Lectura publica producto_variantes anon" ON public.producto_variantes;
CREATE POLICY "Lectura publica producto_variantes anon" ON public.producto_variantes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Lectura publica precios_especiales anon" ON public.precios_especiales;
CREATE POLICY "Lectura publica precios_especiales anon" ON public.precios_especiales
  FOR SELECT TO anon USING (true);
