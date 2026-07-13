-- Migración para añadir mes_conciliacion a movimientos_bancarios
ALTER TABLE public.movimientos_bancarios ADD COLUMN IF NOT EXISTS mes_conciliacion TEXT;
