-- Migration: Add ticket_url column to facturas_clientes table
ALTER TABLE public.facturas_clientes ADD COLUMN IF NOT EXISTS ticket_url TEXT;
