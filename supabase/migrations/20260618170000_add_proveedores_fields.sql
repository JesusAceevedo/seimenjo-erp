-- Migration: Add administrative, contact, and banking details to proveedores
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS alias VARCHAR(255);
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS portal_facturacion TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS sitio_web TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS comentarios TEXT;

-- Banking and payment details
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100);
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS cuenta_clabe VARCHAR(18);
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS cuenta_numero VARCHAR(50);
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS convenio_numero VARCHAR(50);
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS referencia_bancaria VARCHAR(100);
