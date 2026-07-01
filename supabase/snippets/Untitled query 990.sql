-- 1. FUNCIONES AUXILIARES PARA RLS MULTIEMPRESA
CREATE OR REPLACE FUNCTION public.get_auth_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superusuario()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(es_superusuario, false) FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. ALTERACIÓN DE TABLAS OPERATIVAS PARA INCLUIR COLUMNA DE EMPRESA Y VALOR POR DEFECTO
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.categorias_gasto ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.repartidores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.precios_especiales ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();

-- 3. HABILITACIÓN DE RLS Y REEMPLAZO DE POLÍTICAS EXISTENTES
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Clientes
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en clientes" ON public.clientes;
CREATE POLICY "Aislamiento multiempresa para clientes" ON public.clientes FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Pedidos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en pedidos" ON public.pedidos;
CREATE POLICY "Aislamiento multiempresa para pedidos" ON public.pedidos FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Gastos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en gastos" ON public.gastos;
CREATE POLICY "Aislamiento multiempresa para gastos" ON public.gastos FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Productos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en productos" ON public.productos;
CREATE POLICY "Aislamiento multiempresa para productos" ON public.productos FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Categorías de Gasto
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en categorias_gasto" ON public.categorias_gasto;
CREATE POLICY "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Proveedores
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en proveedores" ON public.proveedores;
CREATE POLICY "Aislamiento multiempresa para proveedores" ON public.proveedores FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Repartidores
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en repartidores" ON public.repartidores;
CREATE POLICY "Aislamiento multiempresa para repartidores" ON public.repartidores FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Precios Especiales
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en precios_especiales" ON public.precios_especiales;
CREATE POLICY "Aislamiento multiempresa para precios_especiales" ON public.precios_especiales FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- 4. CONCESIÓN DE PRIVILEGIOS
GRANT ALL ON TABLE public.clientes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pedidos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gastos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.productos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.categorias_gasto TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.proveedores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.repartidores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.precios_especiales TO anon, authenticated, service_role;
