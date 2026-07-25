-- MIGRACIÓN: Normalización de nombres de timestamps a creado_en / actualizado_en
-- Fecha: 2026-07-25

-- Ventas / Egresos / Core
ALTER TABLE public.pedidos RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.gastos RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.repartidores RENAME COLUMN created_at TO creado_en;

-- Catálogos globales
ALTER TABLE public.formas_pago RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.estatus_factura RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.regimenes_fiscales RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.usos_cfdi RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.configuracion_ticket RENAME COLUMN created_at TO creado_en;

-- Inventario
ALTER TABLE public.almacenes RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.inventario_stock RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.inventario_stock RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE public.movimientos_inventario RENAME COLUMN created_at TO creado_en;

-- Conciliación bancaria
ALTER TABLE public.estatus_conciliacion_bancaria RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.movimientos_bancarios RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.conciliaciones_bancarias RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.cuentas_bancarias RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.categorias_movimiento_bancario RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.comprobantes_deposito RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.comprobantes_deposito_movimientos RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.cargas_estados_cuenta RENAME COLUMN created_at TO creado_en;

-- Cierres mensuales
ALTER TABLE public.cierres_mensuales RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.cierres_mensuales RENAME COLUMN updated_at TO actualizado_en;
ALTER TABLE public.saldos_mensuales_cuentas RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.saldos_mensuales_cuentas RENAME COLUMN updated_at TO actualizado_en;

-- Catálogos de producto
ALTER TABLE public.cat_categories_producto RENAME COLUMN created_at TO creado_en;
ALTER TABLE public.cat_unidades_medida RENAME COLUMN created_at TO creado_en;

-- Audit logs (creado_at -> creado_en si existía)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'creado_at'
    ) THEN
        ALTER TABLE public.audit_logs RENAME COLUMN creado_at TO creado_en;
    END IF;
END $$;

-- Historial saldo a favor
ALTER TABLE public.historial_saldos_favor_proveedores RENAME COLUMN created_at TO creado_en;
