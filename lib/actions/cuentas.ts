'use server';

import { supabaseAdmin } from '../supabaseAdmin';

export interface CuentaBancariaRecord {
  id: string;
  nombre: string;
  banco?: string;
  numero_cuenta?: string;
  moneda: string;
  empresa_id?: string | null;
  creado_en?: string;
}

/**
 * Server Action ligero y dedicado para obtener cuentas bancarias sin arrastrar dependencias
 * pesadas (como nodemailer o parsers) que puedan provocar 'Failed to fetch' en clientes Next.js.
 */
export async function getCuentasBancariasServerAction(empresaId?: string | null): Promise<CuentaBancariaRecord[]> {
  try {
    let query = supabaseAdmin.from('cuentas_bancarias').select('*');
    if (empresaId) {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }
    const { data, error } = await query.order('nombre', { ascending: true });
    if (!error && data && data.length > 0) {
      return data as CuentaBancariaRecord[];
    }

    // Fallback: traer todas las cuentas registradas en el sistema
    const { data: allData } = await supabaseAdmin
      .from('cuentas_bancarias')
      .select('*')
      .order('nombre', { ascending: true });

    return (allData || []) as CuentaBancariaRecord[];
  } catch (err: any) {
    console.error('Error fetching cuentas bancarias server action:', err);
    return [];
  }
}
