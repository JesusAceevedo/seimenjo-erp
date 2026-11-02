const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const c = createClient(
  supabaseUrl,
  supabaseServiceKey,
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
