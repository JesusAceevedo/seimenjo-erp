-- MIGRACIÓN: Agregar columna sueldo_mensual a empleados_detalle y puestos_trabajo
-- Fecha: 2026-07-31

ALTER TABLE public.empleados_detalle 
ADD COLUMN IF NOT EXISTS sueldo_mensual NUMERIC(12,2);

ALTER TABLE public.puestos_trabajo 
ADD COLUMN IF NOT EXISTS salario_mensual_base NUMERIC(12,2);

-- Retrollenar sueldo_mensual para registros existentes basándose en sueldo_diario * 30 redondeado al entero más cercano
UPDATE public.empleados_detalle 
SET sueldo_mensual = ROUND(sueldo_diario * 30, 0)
WHERE sueldo_mensual IS NULL AND sueldo_diario IS NOT NULL AND sueldo_diario > 0;

UPDATE public.puestos_trabajo 
SET salario_mensual_base = ROUND(salario_diario_base * 30, 0)
WHERE salario_mensual_base IS NULL AND salario_diario_base IS NOT NULL AND salario_diario_base > 0;

NOTIFY pgrst, 'reload schema';
