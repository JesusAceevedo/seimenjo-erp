/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');

const queries = [
  // 1. Limpiar políticas permisivas en Clientes
  'DROP POLICY IF EXISTS "Permitir lectura publica de clientes" ON public.clientes;',
  'DROP POLICY IF EXISTS "allow_select_clientes" ON public.clientes;',
  'DROP POLICY IF EXISTS "allow_insert_clientes" ON public.clientes;',
  'DROP POLICY IF EXISTS "allow_update_clientes" ON public.clientes;',
  'DROP POLICY IF EXISTS "allow_delete_clientes" ON public.clientes;',

  // 2. Limpiar políticas permisivas en Gastos
  'DROP POLICY IF EXISTS "Permitir leer gastos" ON public.gastos;',
  'DROP POLICY IF EXISTS "Permitir insertar gastos" ON public.gastos;',

  // 3. Limpiar políticas permisivas en Categorías de Gasto
  'DROP POLICY IF EXISTS "Permitir lectura de categorias a staff" ON public.categorias_gasto;',
  'DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en categorias_gasto" ON public.categorias_gasto;',

  // 4. Limpiar políticas permisivas en Pedidos
  'DROP POLICY IF EXISTS "Permitir inserción de pedidos" ON public.pedidos;',
  'DROP POLICY IF EXISTS "Permitir inserción total" ON public.pedidos;',

  // 5. Limpiar políticas permisivas en Productos
  'DROP POLICY IF EXISTS "Permitir lectura pública de productos" ON public.productos;',
  'DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en productos" ON public.productos;',

  // 6. Limpiar políticas de Proveedores
  'DROP POLICY IF EXISTS "Permitir insertar proveedores" ON public.proveedores;',
  'DROP POLICY IF EXISTS "Permitir lectura de proveedores a staff" ON public.proveedores;',
  'DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en proveedores" ON public.proveedores;',

  // 7. Limpiar políticas de Precios Especiales
  'DROP POLICY IF EXISTS "Permitir lectura publica de precios" ON public.precios_especiales;',
  'DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en precios_especiales" ON public.precios_especiales;',

  // 8. Limpiar políticas de Repartidores
  'DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en repartidores" ON public.repartidores;',

  // 9. Asignar registros existentes de clientes a empresas específicas para verificar aislamiento
  "UPDATE public.clientes SET empresa_id = 'b9fec2e3-75d5-4002-9071-f79c56bda732' WHERE nombre_local = 'Sakura';",
  "UPDATE public.clientes SET empresa_id = '57360007-11ae-4da7-a08c-2aa11f691930' WHERE nombre_local = 'Konamon';",

  // 10. Asignar gastos existentes a una empresa específica (Playa Seimenjo)
  "UPDATE public.gastos SET empresa_id = '57360007-11ae-4da7-a08c-2aa11f691930' WHERE concepto = 'PAGO DE LUZ MAYO';"
];

console.log("Limpiando políticas permisivas y asignando datos históricos...");

for (let i = 0; i < queries.length; i++) {
  const query = queries[i];
  console.log(`\n[${i + 1}/${queries.length}] Ejecutando: ${query}...`);

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

console.log("\n¡Limpieza y asignación histórica completadas con éxito!");
