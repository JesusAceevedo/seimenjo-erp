-- MIGRACIÓN: Agregar exento_reloj_checador a empleados_detalle
-- Fecha: 2026-07-31

ALTER TABLE public.empleados_detalle 
ADD COLUMN IF NOT EXISTS exento_reloj_checador BOOLEAN DEFAULT false;

NOTIFY pgrst, 'reload schema';
