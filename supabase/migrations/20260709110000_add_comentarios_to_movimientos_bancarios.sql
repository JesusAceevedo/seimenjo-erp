-- Migration to add comentarios to public.movimientos_bancarios
ALTER TABLE public.movimientos_bancarios ADD COLUMN IF NOT EXISTS comentarios TEXT;
