// lib/hooks/useSessionToken.ts
// Hook que expone una función para obtener el token de sesión actual.
// Usado por las páginas cliente para llamar a Server Actions autenticados.
'use client';

import { supabase } from '../supabase';

/**
 * Retorna una función estable `getToken` que obtiene el access_token de la
 * sesión activa de Supabase. Úsala antes de llamar a cualquier Server Action.
 *
 * @example
 * const getToken = useSessionToken();
 * const token = await getToken();
 * const res = await miServerAction(payload, token);
 */
export function useSessionToken(): () => Promise<string> {
  const getToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;

    try {
      const urlPart = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const projectId = urlPart.includes('//') ? (urlPart.split('//')[1]?.split('.')[0] || 'ioxfhgmeapwyfrgvtyjd') : 'ioxfhgmeapwyfrgvtyjd';
      const supabaseSessionKey = `sb-${projectId}-auth-token`;
      const localData = localStorage.getItem(supabaseSessionKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed?.access_token) {
          return parsed.access_token;
        }
      }
    } catch (e) {
      console.error('Error getting session token from localStorage:', e);
    }
    return '';
  };
  return getToken;
}
