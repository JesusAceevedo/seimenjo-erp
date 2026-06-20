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

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data: empresa } = await supabase.from('empresas').select('id').limit(1).single();
  const empresaId = empresa.id;
  
  const payload = {
     fecha_gasto: new Date().toISOString().split('T')[0],
     concepto: 'Test Factura',
     monto: 100,
     subtotal: 80,
     iva_acreditable: 20,
     uuid_fiscal: 'TEST-UUID-1234',
     fecha_timbrado: new Date().toISOString(),
     xml_url: 'facturas/test.xml',
     proveedor_id: null,
     forma_pago_id: null,
     estatus_factura_id: null,
     estatus_facturado: true,
     metodo_pago: 'Transferencia',
     empresa_id: empresaId
  };

  const { data, error } = await supabase.from('gastos').insert(payload);
  console.log('Result:', error || 'Success');
  
  if (!error) {
     await supabase.from('gastos').delete().eq('uuid_fiscal', 'TEST-UUID-1234');
  }
}

testInsert();
