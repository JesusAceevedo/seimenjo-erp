-- Migration to link matching refund movements (Ingress + Egress)
ALTER TABLE public.movimientos_bancarios 
ADD COLUMN IF NOT EXISTS movimiento_reembolso_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE SET NULL;

-- Recargar el caché del esquema de PostgREST
NOTIFY pgrst, 'reload schema';
