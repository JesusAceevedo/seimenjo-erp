-- Asegurar que las nuevas categorías creadas por el usuario tengan la empresa_id correcta
ALTER TABLE public.categorias_movimiento_bancario 
ALTER COLUMN empresa_id SET DEFAULT public.get_auth_empresa_id();
