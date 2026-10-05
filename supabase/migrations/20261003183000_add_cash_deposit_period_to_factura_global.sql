ALTER TABLE public.factura_global_ajustes
ADD COLUMN IF NOT EXISTS depositos_efectivo_periodo JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.factura_global_ajustes.depositos_efectivo_periodo IS
  'Atribución mensual de depósitos en efectivo BBVA: anterior, actual o siguiente, indexada por ID de movimiento bancario';