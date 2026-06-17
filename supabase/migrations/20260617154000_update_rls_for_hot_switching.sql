-- Migration: Update RLS policies to constrain superusers to their active selected company context
-- 1. Clientes
DROP POLICY IF EXISTS "Aislamiento multiempresa para clientes" ON public.clientes;
CREATE POLICY "Aislamiento multiempresa para clientes" ON public.clientes FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 2. Pedidos
DROP POLICY IF EXISTS "Aislamiento multiempresa para pedidos" ON public.pedidos;
CREATE POLICY "Aislamiento multiempresa para pedidos" ON public.pedidos FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 3. Gastos
DROP POLICY IF EXISTS "Aislamiento multiempresa para gastos" ON public.gastos;
CREATE POLICY "Aislamiento multiempresa para gastos" ON public.gastos FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 4. Productos
DROP POLICY IF EXISTS "Aislamiento multiempresa para productos" ON public.productos;
CREATE POLICY "Aislamiento multiempresa para productos" ON public.productos FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 5. Categorías de Gasto
DROP POLICY IF EXISTS "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto;
CREATE POLICY "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 6. Proveedores
DROP POLICY IF EXISTS "Aislamiento multiempresa para proveedores" ON public.proveedores;
CREATE POLICY "Aislamiento multiempresa para proveedores" ON public.proveedores FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 7. Repartidores
DROP POLICY IF EXISTS "Aislamiento multiempresa para repartidores" ON public.repartidores;
CREATE POLICY "Aislamiento multiempresa para repartidores" ON public.repartidores FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());

-- 8. Precios Especiales
DROP POLICY IF EXISTS "Aislamiento multiempresa para precios_especiales" ON public.precios_especiales;
CREATE POLICY "Aislamiento multiempresa para precios_especiales" ON public.precios_especiales FOR ALL TO authenticated
  USING (empresa_id = get_auth_empresa_id())
  WITH CHECK (empresa_id = get_auth_empresa_id());
