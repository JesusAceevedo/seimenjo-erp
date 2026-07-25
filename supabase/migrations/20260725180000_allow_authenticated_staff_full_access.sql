-- MIGRACIÓN: Garantizar acceso total de lectura/escritura a usuarios autenticados staff en todos los módulos
-- Fecha: 2026-07-25

-- 1. Ventas / Pedidos / Clientes / Facturas
DROP POLICY IF EXISTS "Aislamiento multiempresa para pedidos" ON public.pedidos;
CREATE POLICY "Aislamiento multiempresa para pedidos" ON public.pedidos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para pedido_detalles" ON public.pedido_detalles;
CREATE POLICY "Aislamiento multiempresa para pedido_detalles" ON public.pedido_detalles
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para clientes" ON public.clientes;
CREATE POLICY "Aislamiento multiempresa para clientes" ON public.clientes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes;
CREATE POLICY "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Gastos / Bancos / Conciliación
DROP POLICY IF EXISTS "Aislamiento multiempresa para gastos" ON public.gastos;
CREATE POLICY "Aislamiento multiempresa para gastos" ON public.gastos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para movimientos_bancarios" ON public.movimientos_bancarios;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.movimientos_bancarios;
CREATE POLICY "Aislamiento multiempresa para movimientos_bancarios" ON public.movimientos_bancarios
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para conciliaciones_bancarias" ON public.conciliaciones_bancarias;
CREATE POLICY "Aislamiento multiempresa para conciliaciones_bancarias" ON public.conciliaciones_bancarias
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable read access for all users" ON public.cuentas_bancarias;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.cuentas_bancarias;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.cuentas_bancarias;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.cuentas_bancarias;
CREATE POLICY "Aislamiento multiempresa para cuentas_bancarias" ON public.cuentas_bancarias
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para comprobantes_deposito" ON public.comprobantes_deposito;
CREATE POLICY "Aislamiento multiempresa para comprobantes_deposito" ON public.comprobantes_deposito
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para comprobantes_deposito_movimientos" ON public.comprobantes_deposito_movimientos;
CREATE POLICY "Aislamiento multiempresa para comprobantes_deposito_movimientos" ON public.comprobantes_deposito_movimientos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para cargas_estados_cuenta" ON public.cargas_estados_cuenta;
CREATE POLICY "Aislamiento multiempresa para cargas_estados_cuenta" ON public.cargas_estados_cuenta
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto;
CREATE POLICY "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa categorias_movimiento" ON public.categorias_movimiento_bancario;
CREATE POLICY "Aislamiento multiempresa categorias_movimiento" ON public.categorias_movimiento_bancario
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Productos / Proveedores / Inventario
DROP POLICY IF EXISTS "Aislamiento multiempresa para productos" ON public.productos;
CREATE POLICY "Aislamiento multiempresa para productos" ON public.productos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para producto_variantes" ON public.producto_variantes;
CREATE POLICY "Aislamiento multiempresa para producto_variantes" ON public.producto_variantes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para proveedores" ON public.proveedores;
CREATE POLICY "Aislamiento multiempresa para proveedores" ON public.proveedores
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para historial_saldos_favor_proveedores" ON public.historial_saldos_favor_proveedores;
CREATE POLICY "Aislamiento multiempresa para historial_saldos_favor_proveedores" ON public.historial_saldos_favor_proveedores
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento por empresa en almacenes" ON public.almacenes;
CREATE POLICY "Aislamiento por empresa en almacenes" ON public.almacenes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento por empresa en inventario_stock" ON public.inventario_stock;
CREATE POLICY "Aislamiento por empresa en inventario_stock" ON public.inventario_stock
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento por empresa en movimientos_inventario" ON public.movimientos_inventario;
CREATE POLICY "Aislamiento por empresa en movimientos_inventario" ON public.movimientos_inventario
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Cierres Mensuales y Saldos
DROP POLICY IF EXISTS "Aislamiento multiempresa para cierres_mensuales" ON public.cierres_mensuales;
CREATE POLICY "Aislamiento multiempresa para cierres_mensuales" ON public.cierres_mensuales
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para saldos_mensuales_cuentas" ON public.saldos_mensuales_cuentas;
CREATE POLICY "Aislamiento multiempresa para saldos_mensuales_cuentas" ON public.saldos_mensuales_cuentas
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
