'use server';

import { supabaseAdmin } from '../../lib/supabaseAdmin';

export async function obtenerSignedUrlCliente(filePath: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Ruta de archivo no válida' };
    }

    const trimmed = filePath.trim();

    // Si es un enlace directo externo (ej. Google Drive o HTTP/HTTPS)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return { success: true, url: trimmed };
    }

    // 1. Intentar directamente con la ruta proporcionada
    let { data, error } = await supabaseAdmin.storage.from('facturas').createSignedUrl(trimmed, 900);

    // 2. Si falló y la ruta comienza con 'facturas/', reintentar quitando el prefijo
    if ((error || !data?.signedUrl) && trimmed.startsWith('facturas/')) {
      const altPath = trimmed.replace(/^facturas\//, '');
      const retry = await supabaseAdmin.storage.from('facturas').createSignedUrl(altPath, 900);
      if (retry.data?.signedUrl) {
        return { success: true, url: retry.data.signedUrl };
      }
    }

    // 3. Si falló y la ruta no comienza con 'facturas/', reintentar agregando el prefijo
    if ((error || !data?.signedUrl) && !trimmed.startsWith('facturas/')) {
      const altPath = `facturas/${trimmed}`;
      const retry = await supabaseAdmin.storage.from('facturas').createSignedUrl(altPath, 900);
      if (retry.data?.signedUrl) {
        return { success: true, url: retry.data.signedUrl };
      }
    }

    if (error) {
      console.error('Error generando URL firmada para cliente:', error);
      return { success: false, error: error.message };
    }

    if (!data?.signedUrl) {
      return { success: false, error: 'No se pudo generar el enlace de descarga.' };
    }

    return { success: true, url: data.signedUrl };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al generar enlace';
    console.error('Error en obtenerSignedUrlCliente:', err);
    return { success: false, error: errorMsg };
  }
}

export async function obtenerContenidoXmlCliente(filePath: string): Promise<{ success: boolean; xmlContent?: string; error?: string }> {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Ruta de archivo no válida' };
    }

    const trimmed = filePath.trim().split(',')[0].trim();

    // 1. Si es enlace externo HTTP/HTTPS
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const res = await fetch(trimmed);
      if (!res.ok) throw new Error(`Error al obtener archivo remoto: ${res.statusText}`);
      const text = await res.text();
      return { success: true, xmlContent: text };
    }

    // 2. Descarga directa desde Supabase Storage usando supabaseAdmin
    let cleanPath = trimmed;
    let { data: fileBlob, error } = await supabaseAdmin.storage.from('facturas').download(cleanPath);

    // Si falló y empieza con facturas/, reintentar sin prefijo
    if ((error || !fileBlob) && cleanPath.startsWith('facturas/')) {
      cleanPath = cleanPath.replace(/^facturas\//, '');
      const retry = await supabaseAdmin.storage.from('facturas').download(cleanPath);
      fileBlob = retry.data;
      error = retry.error;
    }

    // Si falló y no empieza con facturas/, reintentar con prefijo
    if ((error || !fileBlob) && !cleanPath.startsWith('facturas/')) {
      cleanPath = `facturas/${cleanPath}`;
      const retry = await supabaseAdmin.storage.from('facturas').download(cleanPath);
      fileBlob = retry.data;
      error = retry.error;
    }

    if (error || !fileBlob) {
      console.error('Error descargando XML en storage:', error);
      return { success: false, error: error?.message || 'No se pudo leer el archivo XML del servidor' };
    }

    const text = await fileBlob.text();
    return { success: true, xmlContent: text };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al obtener XML';
    console.error('Error en obtenerContenidoXmlCliente:', err);
    return { success: false, error: errorMsg };
  }
}

