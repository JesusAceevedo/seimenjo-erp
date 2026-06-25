-- Migración para añadir la columna es_deducible a la tabla gastos
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS es_deducible BOOLEAN DEFAULT TRUE;
