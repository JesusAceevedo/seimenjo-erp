-- MIGRACIÓN: Backfill de empresa_id en registros legacy históricos para asignarlos a la empresa principal
-- Fecha: 2026-07-25

DO $$
DECLARE
    v_empresa_id UUID;
BEGIN
    -- Obtener la empresa principal o la primera empresa registrada en el sistema
    SELECT id INTO v_empresa_id FROM public.empresas LIMIT 1;
    
    IF v_empresa_id IS NOT NULL THEN
        -- Asignar la empresa principal a los registros históricos que tenian empresa_id NULL
        UPDATE public.pedidos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.pedido_detalles SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.gastos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.clientes SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.productos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.proveedores SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.repartidores SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.facturas_clientes SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.movimientos_bancarios SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.cuentas_bancarias SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.conciliaciones_bancarias SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.comprobantes_deposito SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.cargas_estados_cuenta SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.almacenes SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.inventario_stock SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.movimientos_inventario SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.departamentos SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.puestos_trabajo SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
        UPDATE public.empleados_detalle SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
    END IF;
END $$;
