-- MIGRACIÓN: Hardening de Seguridad — Revocación de GRANTs excesivos a 'anon' y restructuración de permisos
-- Fecha: 2026-07-25

-- 1. Revocar permisos totales a anon en todas las tablas transaccionales y contables sensibles
REVOKE ALL ON TABLE public.gastos FROM anon;
REVOKE ALL ON TABLE public.movimientos_bancarios FROM anon;
REVOKE ALL ON TABLE public.conciliaciones_bancarias FROM anon;
REVOKE ALL ON TABLE public.cuentas_bancarias FROM anon;
REVOKE ALL ON TABLE public.cargas_estados_cuenta FROM anon;
REVOKE ALL ON TABLE public.cierres_mensuales FROM anon;
REVOKE ALL ON TABLE public.saldos_mensuales_cuentas FROM anon;
REVOKE ALL ON TABLE public.categorias_movimiento_bancario FROM anon;
REVOKE ALL ON TABLE public.comprobantes_deposito FROM anon;
REVOKE ALL ON TABLE public.comprobantes_deposito_movimientos FROM anon;

-- Módulo RRHH / Nómina / Asistencia
REVOKE ALL ON TABLE public.departamentos FROM anon;
REVOKE ALL ON TABLE public.puestos_trabajo FROM anon;
REVOKE ALL ON TABLE public.empleados_detalle FROM anon;
REVOKE ALL ON TABLE public.turnos FROM anon;
REVOKE ALL ON TABLE public.horarios_empleados FROM anon;
REVOKE ALL ON TABLE public.asistencia_checadas_raw FROM anon;
REVOKE ALL ON TABLE public.asistencia_diaria FROM anon;
REVOKE ALL ON TABLE public.incidencias_solicitudes FROM anon;
REVOKE ALL ON TABLE public.reglas_pool_propinas FROM anon;
REVOKE ALL ON TABLE public.regla_puesto_detalle FROM anon;
REVOKE ALL ON TABLE public.propinas_acumuladas FROM anon;
REVOKE ALL ON TABLE public.propinas_distribucion_empleado FROM anon;
REVOKE ALL ON TABLE public.periodos_nomina FROM anon;
REVOKE ALL ON TABLE public.recibos_nomina FROM anon;
REVOKE ALL ON TABLE public.patrones_descanso FROM anon;
REVOKE ALL ON TABLE public.patron_descanso_dias FROM anon;
REVOKE ALL ON TABLE public.empleado_patron_descanso FROM anon;
REVOKE ALL ON TABLE public.descansos_mensuales FROM anon;
REVOKE ALL ON TABLE public.turnos_puesto FROM anon;
REVOKE ALL ON TABLE public.rotacion_turnos FROM anon;
REVOKE ALL ON TABLE public.dias_festivos FROM anon;
REVOKE ALL ON TABLE public.vacaciones_empleado FROM anon;
REVOKE ALL ON TABLE public.prima_antiguedad_acumulada FROM anon;
REVOKE ALL ON TABLE public.zkteco_comandos FROM anon;

-- Módulo Proveedores e Inventario
REVOKE ALL ON TABLE public.proveedores FROM anon;
REVOKE ALL ON TABLE public.historial_saldos_favor_proveedores FROM anon;
REVOKE ALL ON TABLE public.almacenes FROM anon;
REVOKE ALL ON TABLE public.inventario_stock FROM anon;
REVOKE ALL ON TABLE public.movimientos_inventario FROM anon;

-- Módulo Usuarios Staff
REVOKE ALL ON TABLE public.usuarios_staff FROM anon;
REVOKE ALL ON TABLE public.roles FROM anon;
REVOKE ALL ON TABLE public.perfiles_seguridad FROM anon;
REVOKE ALL ON TABLE public.sucursales_usuario_pivot FROM anon;
REVOKE ALL ON TABLE public.empresas_usuario_pivot FROM anon;

-- 2. Conceder a 'anon' únicamente lectura pública y operaciones de la tienda (auto-servicio cliente)
GRANT SELECT ON TABLE public.productos TO anon;
GRANT SELECT ON TABLE public.producto_variantes TO anon;
GRANT SELECT ON TABLE public.empresas TO anon;
GRANT SELECT ON TABLE public.configuracion_ticket TO anon;
GRANT SELECT ON TABLE public.regimenes_fiscales TO anon;
GRANT SELECT ON TABLE public.usos_cfdi TO anon;
GRANT SELECT ON TABLE public.formas_pago TO anon;
GRANT SELECT ON TABLE public.facturas_clientes TO anon;
GRANT SELECT ON TABLE public.precios_especiales TO anon;

-- Permisos de creación de pedido para tienda sin autenticar
GRANT SELECT, INSERT, DELETE ON TABLE public.pedidos TO anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.pedido_detalles TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clientes TO anon;

-- 3. Conceder permisos operativos estándar a 'authenticated'
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Revocar comandos peligrosos (TRUNCATE, TRIGGER) a usuarios normales
REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated, anon;
