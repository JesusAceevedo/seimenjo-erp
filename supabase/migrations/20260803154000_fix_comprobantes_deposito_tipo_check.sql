-- MIGRACIÓN: Actualizar comprobantes_deposito_tipo_check para permitir nuevos tipos de corte
ALTER TABLE public.comprobantes_deposito
DROP CONSTRAINT IF EXISTS comprobantes_deposito_tipo_check;

ALTER TABLE public.comprobantes_deposito
ADD CONSTRAINT comprobantes_deposito_tipo_check
CHECK (tipo IN ('deposito_ventanilla', 'corte_tarjeta', 'corte_pos', 'corte_bbva', 'corte_parrot'));
