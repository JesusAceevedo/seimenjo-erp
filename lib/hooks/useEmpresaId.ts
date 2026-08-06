import { useCallback } from 'react';
import { supabase } from '../supabase';

async function resolverEmpresaDesdeLocalStorage(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const sessionData = localStorage.getItem('seimenjo_session');
  if (!sessionData) return null;
  try {
    const datosSesion = JSON.parse(sessionData);
    return datosSesion.empresa_id || null;
  } catch (e) {
    console.error('Error parsing seimenjo_session:', e);
    return null;
  }
}

/**
 * Custom hook to get the active empresa_id (company ID).
 *
 * Resolves the company the SAME way the RLS function `get_auth_empresa_id()`
 * does (see supabase/migrations/20260718124000_fix_client_rls.sql), so that
 * client-side filtering and database policies always agree:
 *   1. usuarios_staff (authoritative) by supabase_auth_id
 *   2. B2B client via user_metadata.cliente_id
 *   3. local seimenjo_session (legacy fallback)
 *   4. user_metadata.empresa_id (legacy fallback)
 */
export function useEmpresaId() {
  const getEmpresaId = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: staff } = await supabase
        .from('usuarios_staff')
        .select('empresa_id')
        .eq('supabase_auth_id', user.id)
        .maybeSingle();
      if (staff?.empresa_id) return staff.empresa_id;

      const clienteId = user.user_metadata?.cliente_id;
      if (clienteId) {
        const { data: cliente } = await supabase
          .from('clientes')
          .select('empresa_id')
          .eq('id', clienteId)
          .maybeSingle();
        if (cliente?.empresa_id) return cliente.empresa_id;
      }

      const localStorageId = await resolverEmpresaDesdeLocalStorage();
      if (localStorageId) return localStorageId;

      return user.user_metadata?.empresa_id || null;
    } catch (err) {
      console.error('Error al resolver empresa_id:', err);
      return await resolverEmpresaDesdeLocalStorage();
    }
  }, []);

  return getEmpresaId;
}