const { createClient } = require('@supabase/supabase-js');
const c = createClient(
  'https://ioxfhgmeapwyfrgvtyjd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlveGZoZ21lYXB3eWZyZ3Z0eWpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTEyNjU0MywiZXhwIjoyMDk0NzAyNTQzfQ.g-swmU-l8fL57RYNAQmAZPzHHhb9k8zlnFCWhYIGESk',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
  const tables = ['pedidos','gastos','clientes','productos','proveedores'];
  for (const t of tables) {
    const { count, error } = await c.from(t).select('*', { count: 'exact', head: true });
    console.log(t + ': ' + (error ? 'ERR:'+error.message : count));
  }
  const { data: p } = await c.from('pedidos').select('id,numero_pedido,empresa_id').order('numero_pedido', { ascending: false }).limit(3);
  console.log('pedidos_sample:', JSON.stringify(p));
  const { data: e } = await c.from('empresas').select('id,nombre');
  console.log('empresas:', JSON.stringify(e));
}
run();
