const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

const lines = envContent.split(/\\r?\\n/);
for (const line of lines) {
  const tLine = line.trim();
  if (tLine.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = tLine.substring('NEXT_PUBLIC_SUPABASE_URL='.length).trim();
  }
  if (tLine.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = tLine.substring('SUPABASE_SERVICE_ROLE_KEY='.length).trim();
  }
}

if (!supabaseKey) {
  for (const line of lines) {
    const tLine = line.trim();
    if (tLine.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseKey = tLine.substring('NEXT_PUBLIC_SUPABASE_ANON_KEY='.length).trim();
    }
  }
}

console.log('URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('KEY:', supabaseKey ? 'Found' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphans() {
  const { data: gastos, error: err1 } = await supabase
    .from('gastos')
    .select('id, concepto, uuid_fiscal')
    .not('uuid_fiscal', 'is', null)
    .or('xml_url.is.null,xml_url.eq.');

  if (err1) console.error('Error fetching gastos:', err1);
  console.log('Found ' + (gastos ? gastos.length : 0) + ' orphaned Gastos.');

  const { data: ventas, error: err2 } = await supabase
    .from('facturas_clientes')
    .select('id, uuid_fiscal')
    .not('uuid_fiscal', 'is', null)
    .or('xml_url.is.null,xml_url.eq.');

  if (err2) console.error('Error fetching ventas:', err2);
  console.log('Found ' + (ventas ? ventas.length : 0) + ' orphaned Ventas.');

  if (gastos && gastos.length > 0) {
    const ids = gastos.map(g => g.id);
    console.log('Deleting orphaned gastos...');
    const { error: delErr1 } = await supabase.from('gastos').delete().in('id', ids);
    if (delErr1) console.error('Delete error gastos:', delErr1);
    else console.log('Gastos deleted.');
  }

  if (ventas && ventas.length > 0) {
    const ids = ventas.map(v => v.id);
    console.log('Deleting orphaned ventas...');
    const { error: delErr2 } = await supabase.from('facturas_clientes').delete().in('id', ids);
    if (delErr2) console.error('Delete error ventas:', delErr2);
    else console.log('Ventas deleted.');
  }
}

checkOrphans();
