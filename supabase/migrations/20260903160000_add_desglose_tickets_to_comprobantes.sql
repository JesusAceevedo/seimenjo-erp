-- MIGRACIÓN: Agregar columna desglose_tickets JSONB a comprobantes_deposito
ALTER TABLE public.comprobantes_deposito
ADD COLUMN IF NOT EXISTS desglose_tickets JSONB DEFAULT '[]'::jsonb;
