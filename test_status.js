const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseServiceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function main() {
  const { data, error } = await supabase
    .from('estatus_conciliacion_bancaria')
    .select('*');
  if (error) {
    console.error("Error querying estatus_conciliacion_bancaria:", error);
  } else {
    console.log("Estatus catalog:", data);
  }
}

main();
