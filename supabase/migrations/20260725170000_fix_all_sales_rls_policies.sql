-- MIGRACIÓN: Garantizar visibilidad de registros legacy (empresa_id IS NULL) y políticas RLS para Pedidos, Ventas, Clientes y Facturas
-- Fecha: 2026-07-25

-- 1. Pedidos
DROP POLICY IF EXISTS "Aislamiento multiempresa para pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir pedidos desde tienda anon" ON public.pedidos;

CREATE POLICY "Aislamiento multiempresa para pedidos" ON public.pedidos
  FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Permitir pedidos desde tienda anon" ON public.pedidos
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- 2. Detalle de Pedidos
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento multiempresa para pedido_detalles" ON public.pedido_detalles;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en pedido_detalles" ON public.pedido_detalles;
DROP POLICY IF EXISTS "Permitir pedido_detalles desde tienda anon" ON public.pedido_detalles;

CREATE POLICY "Aislamiento multiempresa para pedido_detalles" ON public.pedido_detalles
  FOR ALL TO authenticated
  USING (
    is_superusuario() OR 
    empresa_id IS NULL OR 
    empresa_id = get_auth_empresa_id() OR 
    pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id = get_auth_empresa_id() OR empresa_id IS NULL)
  )
  WITH CHECK (
    is_superusuario() OR 
    empresa_id IS NULL OR 
    empresa_id = get_auth_empresa_id() OR 
    pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id = get_auth_empresa_id() OR empresa_id IS NULL)
  );

CREATE POLICY "Permitir pedido_detalles desde tienda anon" ON public.pedido_detalles
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- 3. Clientes
DROP POLICY IF EXISTS "Aislamiento multiempresa para clientes" ON public.clientes;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en clientes" ON public.clientes;
DROP POLICY IF EXISTS "Permitir clientes desde tienda anon" ON public.clientes;

CREATE POLICY "Aislamiento multiempresa para clientes" ON public.clientes
  FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Permitir clientes desde tienda anon" ON public.clientes
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- 4. Facturas Clientes
ALTER TABLE public.facturas_clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes;
DROP POLICY IF EXISTS "Permitir todo a autenticados en facturas_clientes" ON public.facturas_clientes;
DROP POLICY IF EXISTS "Permitir lectura publica facturas_clientes" ON public.facturas_clientes;

CREATE POLICY "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes
  FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Permitir lectura publica facturas_clientes" ON public.facturas_clientes
  FOR SELECT TO anon
  USING (true);

-- 5. Gastos
DROP POLICY IF EXISTS "Aislamiento multiempresa para gastos" ON public.gastos;
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en gastos" ON public.gastos;

CREATE POLICY "Aislamiento multiempresa para gastos" ON public.gastos
  FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

-- 6. Productos y Variantes
DROP POLICY IF EXISTS "Aislamiento multiempresa para productos" ON public.productos;
DROP POLICY IF EXISTS "Lectura publica productos anon" ON public.productos;

CREATE POLICY "Aislamiento multiempresa para productos" ON public.productos
  FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

CREATE POLICY "Lectura publica productos anon" ON public.productos
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Aislamiento multiempresa para producto_variantes" ON public.producto_variantes;
DROP POLICY IF EXISTS "Lectura publica producto_variantes anon" ON public.producto_variantes;

CREATE POLICY "Aislamiento multiempresa para producto_variantes" ON public.producto_variantes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Lectura publica producto_variantes anon" ON public.producto_variantes
  FOR SELECT TO anon
  USING (true);
