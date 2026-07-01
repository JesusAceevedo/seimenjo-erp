-- Migration to add soporte_reembolso_url to public.gastos and public.movimientos_bancarios
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS soporte_reembolso_url TEXT;
ALTER TABLE public.movimientos_bancarios ADD COLUMN IF NOT EXISTS soporte_reembolso_url TEXT;
