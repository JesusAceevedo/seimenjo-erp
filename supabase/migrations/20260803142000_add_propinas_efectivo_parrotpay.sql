-- MIGRACIÓN: Agregar propina_efectivo y propina_parrotpay a comprobantes_deposito
ALTER TABLE public.comprobantes_deposito
ADD COLUMN IF NOT EXISTS propina_efectivo NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS propina_parrotpay NUMERIC(12,2) DEFAULT 0;
