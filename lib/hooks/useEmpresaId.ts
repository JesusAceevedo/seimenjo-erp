'use client';

import { supabase } from '../supabase';

/**
 * Custom hook to get the active empresa_id (company ID).
 * Tries local session storage first, then falls back to Supabase auth user metadata.
 */
export function useEmpresaId() {
  const getEmpresaId = async (): Promise<string | null> => {
    let empresaId = null;
    if (typeof window !== 'undefined') {
      const sessionData = localStorage.getItem('seimenjo_session');
      if (sessionData) {
        try {
          const datosSesion = JSON.parse(sessionData);
          empresaId = datosSesion.empresa_id;
        } catch (e) {
          console.error('Error parsing seimenjo_session:', e);
        }
      }
    }
    if (!empresaId) {
      const { data: { user } } = await supabase.auth.getUser();
      empresaId = user?.user_metadata?.empresa_id || null;
    }
    return empresaId;
  };

  return getEmpresaId;
}
