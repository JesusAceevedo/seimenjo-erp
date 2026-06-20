const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertAccounts() {
  const cuentas = [
    {
      nombre: 'BBVA',
      numero_cuenta: '****1234',
      saldo_inicial: 0,
      moneda: 'MXN'
    },
    {
      nombre: 'Caja Chica',
      numero_cuenta: 'N/A',
      saldo_inicial: 0,
      moneda: 'MXN'
    }
  ];

  console.log("Inserting accounts:", cuentas);

  const { data, error } = await supabase
    .from('cuentas_bancarias')
    .insert(cuentas)
    .select();

  if (error) {
    console.error("Error inserting accounts:", error.message, error.details, error.hint);
  } else {
    console.log("Successfully inserted accounts:", data);
  }
}

insertAccounts();
