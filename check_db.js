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

async function check() {
   const { data, error } = await supabase.from('gastos').select('uuid_fiscal').limit(5);
   console.log('Sample UUIDs:', data);
}

check();
