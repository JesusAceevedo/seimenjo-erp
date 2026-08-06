-- MIGRACIÓN: Agregar campos de comisión transacciones (Parrot/POS), IVA transacciones y otros cargos a comprobantes_deposito
ALTER TABLE public.comprobantes_deposito
ADD COLUMN IF NOT EXISTS comision_transacciones NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_transacciones NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS otros_cargos NUMERIC(12,2) DEFAULT 0;
