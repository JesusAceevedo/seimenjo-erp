-- MIGRACIÓN: Reasignación de clientes y pedidos pertenecientes a Sakura
-- Fecha: 2026-07-26

DO $$
DECLARE
    v_sakura_id UUID;
    v_seimenjo_id UUID;
BEGIN
    -- Obtener la empresa Sakura
    SELECT id INTO v_sakura_id FROM public.empresas WHERE nombre ILIKE '%sakura%' LIMIT 1;
    
    -- Obtener la empresa Seimenjo
    SELECT id INTO v_seimenjo_id FROM public.empresas WHERE nombre ILIKE '%seimenjo%' LIMIT 1;
    
    IF v_sakura_id IS NOT NULL THEN
        -- Reasignar clientes específicos pertenecientes a Sakura
        UPDATE public.clientes 
        SET empresa_id = v_sakura_id 
        WHERE nombre_local ILIKE '%diana%patricia%martinez%'
           OR nombre_local ILIKE '%kaory%'
           OR razon_social ILIKE '%diana%patricia%martinez%'
           OR razon_social ILIKE '%kaory%';

        -- Reasignar pedidos de esos clientes a Sakura
        UPDATE public.pedidos
        SET empresa_id = v_sakura_id
        WHERE cliente_id IN (
            SELECT id FROM public.clientes WHERE empresa_id = v_sakura_id
        );

        -- Reasignar pedido_detalles
        UPDATE public.pedido_detalles
        SET empresa_id = v_sakura_id
        WHERE pedido_id IN (
            SELECT id FROM public.pedidos WHERE empresa_id = v_sakura_id
        );
    END IF;
END $$;
