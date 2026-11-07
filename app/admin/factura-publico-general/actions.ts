'use server';

import { getUserEmpresaId, supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Genera URLs firmadas para una lista de rutas de comprobantes o tickets en el bucket 'facturas'.
 * URLs válidas por 1 año (31,536,000 segundos) para que funcionen perfectamente en exportaciones de Excel y consultas.
 */
export async function obtenerSignedUrlsTickets(
  filePaths: string[],
  token: string
): Promise<{ success: boolean; urlMap?: Record<string, string>; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('No se encontró la empresa de la sesión.');

    const cleanPaths = Array.from(
      new Set(
        filePaths
          .filter(p => p && typeof p === 'string' && p.trim() !== '')
          .map(p => p.trim())
      )
    );

    const urlMap: Record<string, string> = {};
    const pathsToSign: string[] = [];

    cleanPaths.forEach(p => {
      if (p.startsWith('http://') || p.startsWith('https://')) {
        urlMap[p] = p;
      } else {
        pathsToSign.push(p);
      }
    });

    if (pathsToSign.length > 0) {
      // Supabase createSignedUrls en batch de hasta 100 archivos por petición
      const chunkSize = 100;
      for (let i = 0; i < pathsToSign.length; i += chunkSize) {
        const chunk = pathsToSign.slice(i, i + chunkSize);
        const { data, error } = await supabaseAdmin.storage
          .from('facturas')
          .createSignedUrls(chunk, 60 * 60 * 24 * 365); // 1 año

        if (!error && Array.isArray(data)) {
          data.forEach(item => {
            if (item?.path && item.signedUrl) {
              urlMap[item.path] = item.signedUrl;
            }
          });
        }
      }
    }

    return { success: true, urlMap };
  } catch (err: any) {
    console.error('Error al generar signed URLs de tickets:', err);
    return { success: false, error: err?.message || 'Error al generar enlaces de tickets' };
  }
}

