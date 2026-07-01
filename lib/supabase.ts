import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ ADVERTENCIA: Variables de Supabase no detectadas en tiempo de compilación.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');