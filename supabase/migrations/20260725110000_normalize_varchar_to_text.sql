-- MIGRACIÓN: Normalización de tipos VARCHAR(n) a TEXT
-- Fecha: 2026-07-25

-- Módulo core / ventas / egresos
ALTER TABLE public.categorias_gasto ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.clientes ALTER COLUMN nombre_local TYPE TEXT;
ALTER TABLE public.clientes ALTER COLUMN razon_social TYPE TEXT;
ALTER TABLE public.clientes ALTER COLUMN regimen_fiscal TYPE TEXT;
ALTER TABLE public.clientes ALTER COLUMN codigo_postal TYPE TEXT;
ALTER TABLE public.clientes ALTER COLUMN uso_cfdi TYPE TEXT;
ALTER TABLE public.clientes ALTER COLUMN email_facturacion TYPE TEXT;
ALTER TABLE public.gastos ALTER COLUMN concepto TYPE TEXT;
ALTER TABLE public.gastos ALTER COLUMN metodo_pago TYPE TEXT;
ALTER TABLE public.gastos ALTER COLUMN folio_factura TYPE TEXT;
ALTER TABLE public.gastos ALTER COLUMN tipo_egreso TYPE TEXT;
ALTER TABLE public.pedidos ALTER COLUMN entregado_por TYPE TEXT;
ALTER TABLE public.pedidos ALTER COLUMN estatus_pago TYPE TEXT;
ALTER TABLE public.pedidos ALTER COLUMN metodo_pago TYPE TEXT;
ALTER TABLE public.pedidos ALTER COLUMN folio_factura TYPE TEXT;
ALTER TABLE public.pedidos ALTER COLUMN motivo_cancelacion TYPE TEXT;
ALTER TABLE public.productos ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.productos ALTER COLUMN categoria TYPE TEXT;
ALTER TABLE public.producto_variantes ALTER COLUMN gramaje TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN nombre_comercial TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN rfc TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN razon_social TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN telefono TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN email TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN alias TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN banco_nombre TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN cuenta_clabe TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN cuenta_numero TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN convenio_numero TYPE TEXT;
ALTER TABLE public.proveedores ALTER COLUMN referencia_bancaria TYPE TEXT;
ALTER TABLE public.roles ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.usuarios_staff ALTER COLUMN correo TYPE TEXT;

-- Módulo RRHH / Asistencia
ALTER TABLE public.departamentos ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.puestos_trabajo ALTER COLUMN nombre TYPE TEXT;

-- Eliminar columna generada que depende de los nombres/apellidos
ALTER TABLE public.empleados_detalle DROP COLUMN IF EXISTS nombre_completo;

ALTER TABLE public.empleados_detalle ALTER COLUMN primer_apellido TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN segundo_apellido TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN primer_nombre TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN segundo_nombre TYPE TEXT;

-- Recrear columna generada nombre_completo como TEXT
ALTER TABLE public.empleados_detalle ADD COLUMN IF NOT EXISTS nombre_completo TEXT GENERATED ALWAYS AS (
    trim(both ' ' from 
        coalesce(primer_apellido, '') || ' ' || 
        coalesce(segundo_apellido, '') || ' ' || 
        coalesce(primer_nombre, '') || ' ' || 
        coalesce(segundo_nombre, '')
    )
) STORED;
ALTER TABLE public.empleados_detalle ALTER COLUMN curp TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN rfc TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN nss TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN telefono TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN banco TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN cuenta_clabe TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN zkteco_user_id TYPE TEXT;
ALTER TABLE public.empleados_detalle ALTER COLUMN tipo_contrato TYPE TEXT;
ALTER TABLE public.turnos ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.turnos ALTER COLUMN tipo_turno TYPE TEXT;
ALTER TABLE public.asistencia_checadas_raw ALTER COLUMN zkteco_user_id TYPE TEXT;
ALTER TABLE public.asistencia_checadas_raw ALTER COLUMN dispositivo_sn TYPE TEXT;
ALTER TABLE public.asistencia_checadas_raw ALTER COLUMN tipo_evento TYPE TEXT;
ALTER TABLE public.asistencia_checadas_raw ALTER COLUMN metodo_verificacion TYPE TEXT;
ALTER TABLE public.asistencia_diaria ALTER COLUMN estatus_asistencia TYPE TEXT;
ALTER TABLE public.incidencias_solicitudes ALTER COLUMN tipo_incidencia TYPE TEXT;
ALTER TABLE public.incidencias_solicitudes ALTER COLUMN estatus TYPE TEXT;
ALTER TABLE public.reglas_pool_propinas ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.reglas_pool_propinas ALTER COLUMN metodo_distribucion TYPE TEXT;
ALTER TABLE public.propinas_acumuladas ALTER COLUMN origen TYPE TEXT;
ALTER TABLE public.periodos_nomina ALTER COLUMN frecuencia TYPE TEXT;
ALTER TABLE public.periodos_nomina ALTER COLUMN estatus TYPE TEXT;

-- Módulo descansos / turnos / festivos
ALTER TABLE public.patrones_descanso ALTER COLUMN nombre TYPE TEXT;
ALTER TABLE public.patrones_descanso ALTER COLUMN tipo_patron TYPE TEXT;
ALTER TABLE public.descansos_mensuales ALTER COLUMN motivo TYPE TEXT;
ALTER TABLE public.dias_festivos ALTER COLUMN descripcion TYPE TEXT;

-- ZKTeco
ALTER TABLE public.zkteco_comandos ALTER COLUMN dispositivo_sn TYPE TEXT;
ALTER TABLE public.zkteco_comandos ALTER COLUMN comando_id TYPE TEXT;
ALTER TABLE public.zkteco_comandos ALTER COLUMN categoria TYPE TEXT;
