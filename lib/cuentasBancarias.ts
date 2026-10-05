import { supabase as defaultSupabase } from './supabase';
import { getCuentasBancariasServerAction } from './actions/cuentas';

export interface CuentaBancariaItem {
  id: string;
  nombre: string;
  banco?: string;
  numero_cuenta?: string;
  moneda: string;
  empresa_id?: string | null;
  creado_en?: string;
}

/**
 * Carga robusta de cuentas bancarias con fallback multiempresa,
 * cuentas globales y auto-inicialización si la tabla está vacía.
 * Primero intenta cargar desde el Server Action con supabaseAdmin
 * para asegurar acceso sin bloqueos de RLS o anon grants.
 */
export async function fetchCuentasBancarias(
  empresaId: string | null,
  customSupabase = defaultSupabase
): Promise<CuentaBancariaItem[]> {
  try {
    // 0. Intentar Server Action con privilegios administrativos
    const serverAccounts = await getCuentasBancariasServerAction(empresaId);
    if (serverAccounts && serverAccounts.length > 0) {
      return serverAccounts as CuentaBancariaItem[];
    }
  } catch (saErr) {
    console.warn('Server Action getCuentasBancariasServerAction fallback:', saErr);
  }

  let cuentas: CuentaBancariaItem[] = [];

  try {
    // 1. Intentar buscar cuentas de la empresa o globales (empresa_id IS NULL)
    let query = customSupabase.from('cuentas_bancarias').select('*');
    if (empresaId) {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }
    const { data: cbData, error: cbErr } = await query.order('nombre', { ascending: true });

    if (!cbErr && cbData && cbData.length > 0) {
      cuentas = cbData;
    } else {
      // 2. Fallback: Traer todas las cuentas accesibles por RLS
      const { data: allCb, error: allErr } = await customSupabase
        .from('cuentas_bancarias')
        .select('*')
        .order('nombre', { ascending: true });

      if (!allErr && allCb && allCb.length > 0) {
        cuentas = allCb;
      }
    }

    // 3. Si la base de datos no tiene ninguna cuenta bancaria registrada, inicializar las estándar
    if (cuentas.length === 0 && empresaId) {
      const defaultAccounts = [
        { nombre: 'BBVA Bancomer', banco: 'BBVA', moneda: 'MXN', empresa_id: empresaId },
        { nombre: 'Caja Chica', banco: 'Efectivo', moneda: 'MXN', empresa_id: empresaId },
        { nombre: 'Terminal ParrotPay', banco: 'Terminal POS', moneda: 'MXN', empresa_id: empresaId },
      ];

      const { data: created, error: insertErr } = await customSupabase
        .from('cuentas_bancarias')
        .insert(defaultAccounts)
        .select('*');

      if (!insertErr && created && created.length > 0) {
        cuentas = created;
      }
    }
  } catch (err) {
    console.warn('Error al cargar cuentas bancarias:', err);
  }

  return cuentas;
}
