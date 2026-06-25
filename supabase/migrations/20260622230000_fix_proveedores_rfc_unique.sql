-- Migration: Fix unique constraint on proveedores to be scoped by empresa_id (multi-tenant)
-- Description: Drop global unique constraints on RFC and replace with a tenant-scoped unique constraint.

-- Drop any existing unique constraints on the rfc column in public.proveedores
ALTER TABLE public.proveedores DROP CONSTRAINT IF EXISTS rfc_unico CASCADE;
ALTER TABLE public.proveedores DROP CONSTRAINT IF EXISTS unique_rfc CASCADE;
ALTER TABLE public.proveedores DROP CONSTRAINT IF EXISTS proveedores_rfc_key CASCADE;

-- Drop the underlying unique indexes if they still exist
DROP INDEX IF EXISTS public.rfc_unico;
DROP INDEX IF EXISTS public.unique_rfc;
DROP INDEX IF EXISTS public.proveedores_rfc_key;

-- Add new unique constraint scoped to (rfc, empresa_id)
-- This allows different companies (empresa_id) to have the same supplier RFC,
-- while still ensuring RFCs are unique within each individual company.
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_rfc_empresa_unique UNIQUE (rfc, empresa_id);
