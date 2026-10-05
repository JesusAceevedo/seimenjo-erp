-- MIGRACIÓN: Agregar dias_no_laborables a la tabla factura_global_ajustes
-- Permite almacenar los días de descanso / cierre del mes para la auditoría de Factura Global

ALTER TABLE public.factura_global_ajustes
ADD COLUMN IF NOT EXISTS dias_no_laborables JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.factura_global_ajustes.dias_no_laborables IS 'Días no laborables / descansos del mes para la auditoría y control de tickets en Factura Global';
