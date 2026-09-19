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

export interface DatosFiscalesClienteInput {
  clienteId: string;
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  codigoPostal: string;
  usoCfdi: string;
  emailFacturacion: string;
  telefono?: string;
  nombreLocal?: string;
}

export async function obtenerDatosFiscalesCliente(clienteId: string): Promise<{
  success: boolean;
  cliente?: any;
  error?: string;
}> {
  try {
    if (!clienteId) {
      return { success: false, error: 'ID de cliente no proporcionado.' };
    }

    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select('id, nombre_local, rfc, razon_social, regimen_fiscal, codigo_postal, uso_cfdi, email_facturacion, telefono, es_anonimo')
      .eq('id', clienteId)
      .single();

    if (error) throw error;
    return { success: true, cliente: data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al obtener datos fiscales';
    console.error('Error in obtenerDatosFiscalesCliente:', err);
    return { success: false, error: errorMsg };
  }
}

export async function actualizarDatosFiscalesCliente(data: DatosFiscalesClienteInput): Promise<{
  success: boolean;
  cliente?: any;
  error?: string;
}> {
  try {
    if (!data.clienteId) {
      return { success: false, error: 'Identificador de cliente no proporcionado.' };
    }

    const rfcClean = (data.rfc || '').trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    if (!rfcClean) {
      return { success: false, error: 'El RFC es obligatorio.' };
    }
    if (rfcClean.length < 12 || rfcClean.length > 13) {
      return { success: false, error: 'El RFC debe contener 12 (Persona Moral) o 13 (Persona Física) caracteres.' };
    }

    const razonSocialClean = (data.razonSocial || '').trim().toUpperCase();
    if (!razonSocialClean) {
      return { success: false, error: 'La Razón Social o Nombre Fiscal es obligatorio.' };
    }

    const cpClean = (data.codigoPostal || '').trim();
    if (!cpClean || cpClean.length !== 5 || !/^\d{5}$/.test(cpClean)) {
      return { success: false, error: 'El Código Postal fiscal debe contener exactamente 5 dígitos numéricos.' };
    }

    const emailClean = (data.emailFacturacion || '').trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@') || !emailClean.includes('.')) {
      return { success: false, error: 'Ingresa un correo electrónico de facturación válido.' };
    }

    const payload: Record<string, any> = {
      rfc: rfcClean,
      razon_social: razonSocialClean,
      regimen_fiscal: data.regimenFiscal?.trim() || null,
      codigo_postal: cpClean,
      uso_cfdi: data.usoCfdi?.trim() || null,
      email_facturacion: emailClean,
      es_anonimo: false
    };

    if (data.telefono !== undefined) {
      payload.telefono = data.telefono.trim();
    }
    if (data.nombreLocal !== undefined && data.nombreLocal.trim()) {
      payload.nombre_local = data.nombreLocal.trim();
    }

    const { data: updated, error } = await supabaseAdmin
      .from('clientes')
      .update(payload)
      .eq('id', data.clienteId)
      .select('*')
      .single();

    if (error) {
      console.error('Error al actualizar datos fiscales en base de datos:', error);
      return { success: false, error: error.message || 'Error al guardar datos fiscales.' };
    }

    return { success: true, cliente: updated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error inesperado al actualizar datos fiscales';
    console.error('Error in actualizarDatosFiscalesCliente:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Notifica a Telegram cuando un cliente genera un pedido
 */
export async function notificarPedidoTelegramAction(pedidoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { notificarNuevoPedidoTelegram } = await import('../../lib/telegram');
    return await notificarNuevoPedidoTelegram(pedidoId);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al enviar alerta a Telegram';
    console.error('Error in notificarPedidoTelegramAction:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Prueba la conexión con el bot de Telegram
 */
export async function probarConexionTelegramAction(customToken?: string, customChatId?: string): Promise<{ success: boolean; botName?: string; error?: string }> {
  try {
    const { probarTelegram } = await import('../../lib/telegram');
    return await probarTelegram(customToken, customChatId);
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al conectar con Telegram' };
  }
}



