const { execSync } = require('child_process');

const queries = [
  // 1. Funciones auxiliares
  "CREATE OR REPLACE FUNCTION public.get_auth_empresa_id() RETURNS UUID AS $$ SELECT empresa_id FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid(); $$ LANGUAGE sql SECURITY DEFINER;",

  "CREATE OR REPLACE FUNCTION public.is_superusuario() RETURNS BOOLEAN AS $$ SELECT COALESCE(es_superusuario, false) FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid(); $$ LANGUAGE sql SECURITY DEFINER;",

  // 2. Alteración de tablas operativas para incluir empresa_id y su valor por defecto
  "ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.categorias_gasto ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.repartidores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",
  "ALTER TABLE public.precios_especiales ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();",

  // 3. Habilitación de RLS
  "ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.categorias_gasto ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.repartidores ENABLE ROW LEVEL SECURITY;",
  "ALTER TABLE public.precios_especiales ENABLE ROW LEVEL SECURITY;",

  // 4. Políticas de Seguridad - Clientes
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en clientes\" ON public.clientes;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para clientes\" ON public.clientes;",
  "CREATE POLICY \"Aislamiento multiempresa para clientes\" ON public.clientes FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Pedidos
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en pedidos\" ON public.pedidos;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para pedidos\" ON public.pedidos;",
  "CREATE POLICY \"Aislamiento multiempresa para pedidos\" ON public.pedidos FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Gastos
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en gastos\" ON public.gastos;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para gastos\" ON public.gastos;",
  "CREATE POLICY \"Aislamiento multiempresa para gastos\" ON public.gastos FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Productos
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en productos\" ON public.productos;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para productos\" ON public.productos;",
  "CREATE POLICY \"Aislamiento multiempresa para productos\" ON public.productos FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Categorías de Gasto
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en categorias_gasto\" ON public.categorias_gasto;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para categorias_gasto\" ON public.categorias_gasto;",
  "CREATE POLICY \"Aislamiento multiempresa para categorias_gasto\" ON public.categorias_gasto FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Proveedores
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en proveedores\" ON public.proveedores;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para proveedores\" ON public.proveedores;",
  "CREATE POLICY \"Aislamiento multiempresa para proveedores\" ON public.proveedores FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Repartidores
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en repartidores\" ON public.repartidores;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para repartidores\" ON public.repartidores;",
  "CREATE POLICY \"Aislamiento multiempresa para repartidores\" ON public.repartidores FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // Precios Especiales
  "DROP POLICY IF EXISTS \"Permitir todo a usuarios autenticados en precios_especiales\" ON public.precios_especiales;",
  "DROP POLICY IF EXISTS \"Aislamiento multiempresa para precios_especiales\" ON public.precios_especiales;",
  "CREATE POLICY \"Aislamiento multiempresa para precios_especiales\" ON public.precios_especiales FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());",

  // 5. Privilegios (Grants)
  "GRANT ALL ON TABLE public.clientes TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.pedidos TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.gastos TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.productos TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.categorias_gasto TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.proveedores TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.repartidores TO anon, authenticated, service_role;",
  "GRANT ALL ON TABLE public.precios_especiales TO anon, authenticated, service_role;"
];

console.log("Iniciando ejecución de consultas de aislamiento multiempresa...");

for (let i = 0; i < queries.length; i++) {
  const query = queries[i];
  console.log(`\n[${i + 1}/${queries.length}] Ejecutando: ${query.split('\n')[0].substring(0, 80)}...`);
  
  // Escapar comillas dobles para compatibilidad con la línea de comandos de Windows (cmd/powershell)
  const escapedQuery = query.replace(/"/g, '\\"');
  
  try {
    const output = execSync(`npx supabase db query "${escapedQuery}"`, {
      cwd: 'd:\\seimenjo-erp',
      stdio: 'pipe'
    });
    console.log("Resultado:", output.toString().trim());
  } catch (err) {
    console.error("ERROR en la ejecución:");
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log("\n¡Ejecución completada con éxito! Las tablas ahora tienen aislamiento multiempresa.");
