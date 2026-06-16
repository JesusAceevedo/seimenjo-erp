-- Migración para añadir la relación jerárquica de comprobación acumulada de gastos
ALTER TABLE public.gastos 
ADD COLUMN IF NOT EXISTS gasto_padre_id UUID REFERENCES public.gastos(id) ON DELETE SET NULL;

-- Índice para optimizar consultas de subgastos asociados
CREATE INDEX IF NOT EXISTS idx_gastos_gasto_padre_id ON public.gastos(gasto_padre_id);
