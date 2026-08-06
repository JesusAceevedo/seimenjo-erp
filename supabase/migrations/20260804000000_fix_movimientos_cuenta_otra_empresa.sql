-- MIGRACIÓN: Reasignar movimientos bancarios que quedaron asignados a cuentas de OTRA empresa
-- Causa: el auto-enrutamiento de importarMovimientosBancarios elegía la primera cuenta por nombre
-- con el cliente admin sin filtrar por empresa, y sobrescribía la cuenta destino seleccionada.
-- Fecha: 2026-08-04

UPDATE public.movimientos_bancarios m
SET cuenta_bancaria_id = c.cuenta_bancaria_id
FROM public.cargas_estados_cuenta c
WHERE m.carga_id = c.id
  AND m.cuenta_bancaria_id IS DISTINCT FROM c.cuenta_bancaria_id
  AND EXISTS (
    SELECT 1
    FROM public.cuentas_bancarias cb
    WHERE cb.id = m.cuenta_bancaria_id
      AND cb.empresa_id IS DISTINCT FROM m.empresa_id
  );

-- Corregir cargas (y sus movimientos) que apuntan a cuentas de otra empresa
DO $$
DECLARE
    r RECORD;
    v_target UUID;
BEGIN
    FOR r IN
        SELECT c.id AS carga_id, c.empresa_id, c.cuenta_bancaria_id
        FROM public.cargas_estados_cuenta c
        JOIN public.cuentas_bancarias cb ON cb.id = c.cuenta_bancaria_id
        WHERE cb.empresa_id IS DISTINCT FROM c.empresa_id
    LOOP
        -- Elegir una cuenta de la misma empresa con el mismo nombre (si existe) o la primera
        SELECT id INTO v_target
        FROM public.cuentas_bancarias
        WHERE empresa_id = r.empresa_id
        ORDER BY (nombre = (SELECT nombre FROM public.cuentas_bancarias WHERE id = r.cuenta_bancaria_id)) DESC, nombre
        LIMIT 1;

        IF v_target IS NOT NULL THEN
            UPDATE public.cargas_estados_cuenta SET cuenta_bancaria_id = v_target WHERE id = r.carga_id;
            UPDATE public.movimientos_bancarios SET cuenta_bancaria_id = v_target WHERE carga_id = r.carga_id;
        END IF;
    END LOOP;
END $$;