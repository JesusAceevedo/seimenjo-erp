-- ===========================================================================
-- MIGRACIÓN: Estandarización de Catálogos de Conciliación Bancaria
-- Fecha: 2026-08-15
-- Basado en estándares de SAP, Odoo, QuickBooks, Xero, CONTPAQi, Aspel
-- ===========================================================================

-- =============================================
-- PARTE 1: ESTATUS DE CONCILIACIÓN BANCARIA
-- =============================================
-- Catálogo definitivo de 6 estatus:
--   pendiente, conciliado, parcial, no_facturable, no_deducible, excluido

-- 1A. Insertar los estatus nuevos/faltantes (excluido, parcial, conciliado)
INSERT INTO public.estatus_conciliacion_bancaria (clave, nombre, descripcion, color, empresa_id)
VALUES
  ('conciliado', 'Conciliado', 'El movimiento tiene match exacto: vinculado a gasto/venta con documentación soporte (XML, ticket, póliza).', '#10B981', NULL),
  ('parcial', 'Parcialmente Conciliado', 'Tiene comprobantes o documentos asociados pero no cubren el 100% del monto.', '#3B82F6', NULL),
  ('excluido', 'Excluido', 'Movimiento ignorado: duplicado, error bancario o movimiento personal en cuenta empresarial.', '#6B7280', NULL)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  color = EXCLUDED.color;

-- 1B. Actualizar los estatus existentes que se mantienen (pendiente, no_facturable, no_deducible)
UPDATE public.estatus_conciliacion_bancaria
SET nombre = 'Pendiente',
    descripcion = 'Estado inicial. El movimiento no ha sido vinculado con ningún gasto, venta o documento.',
    color = '#9CA3AF'
WHERE clave = 'pendiente';

UPDATE public.estatus_conciliacion_bancaria
SET nombre = 'No Facturable',
    descripcion = 'Comisiones bancarias, nóminas, impuestos, traspasos — conceptos que por naturaleza no generan CFDI deducible.',
    color = '#8B5CF6'
WHERE clave = 'no_facturable';

UPDATE public.estatus_conciliacion_bancaria
SET nombre = 'No Deducible',
    descripcion = 'Debería tener factura para ser deducible pero no la tiene. Alerta fiscal: el gasto existe pero no se puede deducir ante el SAT.',
    color = '#EF4444'
WHERE clave = 'no_deducible';

-- 1C. Migrar movimientos de estatus obsoletos a los nuevos
UPDATE public.movimientos_bancarios
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'conciliado' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'comprobado');

UPDATE public.movimientos_bancarios
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'pendiente' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'incompleto');

UPDATE public.movimientos_bancarios
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'parcial' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'incompleto_comprobado');

UPDATE public.movimientos_bancarios
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'pendiente' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'no_detectado');

-- 1D. Actualizar reglas_conciliacion que apuntan a estatus obsoletos
UPDATE public.reglas_conciliacion
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'conciliado' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'comprobado');

UPDATE public.reglas_conciliacion
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'pendiente' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave IN ('incompleto', 'no_detectado'));

UPDATE public.reglas_conciliacion
SET estatus_conciliacion_id = (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'parcial' LIMIT 1)
WHERE estatus_conciliacion_id IN (SELECT id FROM public.estatus_conciliacion_bancaria WHERE clave = 'incompleto_comprobado');

-- 1E. Eliminar estatus obsoletos
DELETE FROM public.estatus_conciliacion_bancaria
WHERE clave IN ('comprobado', 'incompleto', 'incompleto_comprobado', 'no_detectado');


-- =============================================
-- PARTE 2: CATEGORÍAS DE MOVIMIENTO BANCARIO
-- =============================================
-- Catálogo definitivo de 16 categorías

INSERT INTO public.categorias_movimiento_bancario (clave, nombre, descripcion, requiere_comprobante, empresa_id)
VALUES
  -- Ingresos
  ('INGRESO_VENTA',    'Cobro de Venta',            'Ingreso por ventas a clientes (CFDI de ingreso).',                      true,  NULL),
  ('INGRESO_VARIOS',   'Otros Ingresos',            'Intereses bancarios, devoluciones, bonificaciones.',                    false, NULL),
  -- Egresos Operativos
  ('EGRESO_COMPRA',    'Pago a Proveedor',          'Compra de insumos o materia prima (requiere CFDI).',                    true,  NULL),
  ('EGRESO_GASTO',     'Gasto Operativo',           'Gastos generales de operación (requiere factura).',                     true,  NULL),
  ('EGRESO_RENTA',     'Renta / Servicios Fijos',   'Pagos recurrentes de renta, luz, agua, internet.',                      true,  NULL),
  -- Nómina y Personal
  ('NOMINA',           'Nómina y Sueldos',          'Pago de nómina, finiquitos, aguinaldos.',                               false, NULL),
  ('REEMBOLSO',        'Reembolso a Empleado',      'Reembolso de gastos con soporte/ticket.',                               false, NULL),
  ('PROPINA',          'Propinas',                   'Propinas recibidas o distribuidas al personal.',                        false, NULL),
  -- Impuestos y Gobierno
  ('IMPUESTO',         'Pago de Impuestos',         'ISR, IVA, IMSS, INFONAVIT, cuotas SAT.',                               false, NULL),
  -- Comisiones Financieras
  ('COMISION_BANCO',   'Comisión Bancaria',         'Comisiones por manejo de cuenta, transferencias.',                      false, NULL),
  ('COMISION_TPV',     'Comisión TPV',              'Comisiones de terminales (Clip, MercadoPago, Parrot, etc.).',           false, NULL),
  -- Movimientos No Operativos
  ('TRASPASO',         'Traspaso entre Cuentas',    'Movimiento de fondos entre cuentas propias de la empresa.',             false, NULL),
  ('PRESTAMO',         'Préstamo Bancario',         'Préstamo recibido o pago de capital/intereses.',                        false, NULL),
  ('RETIRO_EFECTIVO',  'Retiro de Efectivo / Caja', 'Retiros para caja chica o fondeo de efectivo.',                         false, NULL),
  ('DONACION',         'Donación',                  'Donaciones otorgadas o recibidas con fines fiscales.',                  true,  NULL),
  -- Ajustes
  ('AJUSTE',           'Ajuste Contable',           'Redondeos, correcciones, ajustes menores.',                             false, NULL)
ON CONFLICT (clave) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  requiere_comprobante = EXCLUDED.requiere_comprobante;

-- 2B. Reasignar movimientos y reglas de categorías sinónimas/duplicadas a la oficial
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Mapeo de sinónimos comunes hacia la clave oficial
  FOR rec IN 
    SELECT unnest(ARRAY['COMISION_BANCARIA', 'COMISIONES_BANCARIAS', 'COMISION_BANCO_MANEJO', 'MANEJO_DE_CUENTA']) as sinonimo, 'COMISION_BANCO' as oficial
    UNION ALL SELECT unnest(ARRAY['PAGO_A_PROVEEDOR', 'PAGO_PROVEEDOR', 'PROVEEDORES', 'COMPRAS']), 'EGRESO_COMPRA'
    UNION ALL SELECT unnest(ARRAY['COBRO_DE_VENTA', 'VENTA', 'VENTAS', 'COBRO_VENTAS']), 'INGRESO_VENTA'
    UNION ALL SELECT unnest(ARRAY['GASTO', 'GASTOS', 'GASTOS_GENERALES', 'EGRESOS']), 'EGRESO_GASTO'
    UNION ALL SELECT unnest(ARRAY['RENTA', 'SERVICIOS', 'SERVICIOS_FIJOS']), 'EGRESO_RENTA'
    UNION ALL SELECT unnest(ARRAY['NOMINAS', 'SUELDOS', 'PAGO_NOMINA']), 'NOMINA'
    UNION ALL SELECT unnest(ARRAY['REEMBOLSO_GASTOS', 'REEMBOLSOS']), 'REEMBOLSO'
    UNION ALL SELECT unnest(ARRAY['PROPINAS', 'PROPINA_PERSONAL']), 'PROPINA'
    UNION ALL SELECT unnest(ARRAY['IMPUESTOS', 'SAT', 'PAGO_SAT']), 'IMPUESTO'
    UNION ALL SELECT unnest(ARRAY['TRASPASOS', 'TRANSFERENCIA_INTERNA']), 'TRASPASO'
    UNION ALL SELECT unnest(ARRAY['PRESTAMOS', 'CREDITO_BANCARIO']), 'PRESTAMO'
    UNION ALL SELECT unnest(ARRAY['RETIRO_EFECTIVO_CAJA', 'CAJA_CHICA', 'RETIRO_CAJA']), 'RETIRO_EFECTIVO'
    UNION ALL SELECT unnest(ARRAY['DONACIONES']), 'DONACION'
    UNION ALL SELECT unnest(ARRAY['AJUSTES']), 'AJUSTE'
  LOOP
    -- Reasignar en movimientos_bancarios
    UPDATE public.movimientos_bancarios
    SET categoria_movimiento_id = (SELECT id FROM public.categorias_movimiento_bancario WHERE clave = rec.oficial LIMIT 1)
    WHERE categoria_movimiento_id IN (SELECT id FROM public.categorias_movimiento_bancario WHERE clave = rec.sinonimo);

    -- Reasignar en reglas_conciliacion
    UPDATE public.reglas_conciliacion
    SET categoria_movimiento_id = (SELECT id FROM public.categorias_movimiento_bancario WHERE clave = rec.oficial LIMIT 1)
    WHERE categoria_movimiento_id IN (SELECT id FROM public.categorias_movimiento_bancario WHERE clave = rec.sinonimo);

    -- Eliminar la categoría sinónima
    DELETE FROM public.categorias_movimiento_bancario WHERE clave = rec.sinonimo;
  END LOOP;
END $$;

-- 2C. Limpieza de categorías duplicadas por nombre idéntico (conservar sólo la oficial con clave estándar)
DELETE FROM public.categorias_movimiento_bancario c1
WHERE c1.clave NOT IN (
  'INGRESO_VENTA', 'INGRESO_VARIOS', 'EGRESO_COMPRA', 'EGRESO_GASTO', 'EGRESO_RENTA',
  'NOMINA', 'REEMBOLSO', 'PROPINA', 'IMPUESTO', 'COMISION_BANCO', 'COMISION_TPV',
  'TRASPASO', 'PRESTAMO', 'RETIRO_EFECTIVO', 'DONACION', 'AJUSTE'
)
AND EXISTS (
  SELECT 1 FROM public.categorias_movimiento_bancario c2
  WHERE LOWER(TRIM(c2.nombre)) = LOWER(TRIM(c1.nombre))
  AND c2.clave IN (
    'INGRESO_VENTA', 'INGRESO_VARIOS', 'EGRESO_COMPRA', 'EGRESO_GASTO', 'EGRESO_RENTA',
    'NOMINA', 'REEMBOLSO', 'PROPINA', 'IMPUESTO', 'COMISION_BANCO', 'COMISION_TPV',
    'TRASPASO', 'PRESTAMO', 'RETIRO_EFECTIVO', 'DONACION', 'AJUSTE'
  )
);
