-- Migración para añadir campos de Efectivo y ParrotPay a la tabla comprobantes_deposito
ALTER TABLE public.comprobantes_deposito
ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monto_parrotpay NUMERIC(12,2) DEFAULT 0;
