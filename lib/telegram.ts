// lib/telegram.ts
// Módulo de integración con Telegram Bot para notificaciones de nuevos pedidos
import { supabaseAdmin } from './supabaseAdmin';
import { formatCurrency } from './formatters';

/**
 * Escapa caracteres reservados para el modo HTML de Telegram
 */
function escapeTgHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DEFAULT_TELEGRAM_BOT_TOKEN = '8560125574:AAG0DnhejKkfcOvi3rka0Cn-jLA9aTx0PiI';
const DEFAULT_TELEGRAM_CHAT_ID = '-1004303384153';

/**
 * Obtiene las credenciales del bot de Telegram desde process.env o defaults configurados
 */
function getTelegramCredentials(customChatId?: string): { botToken?: string; chatId?: string } {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN)?.trim();
  const chatId = customChatId?.trim() || (process.env.TELEGRAM_CHAT_ID || DEFAULT_TELEGRAM_CHAT_ID)?.trim();

  return { botToken, chatId };
}

/**
 * Envía un mensaje en formato HTML a Telegram usando el bot configurado
 */
export async function enviarMensajeTelegram(
  mensajeHtml: string,
  customChatId?: string
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const { botToken, chatId } = getTelegramCredentials(customChatId);

  if (!botToken || !chatId) {
    const errorMsg = 'Configuración incompleta: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están definidos.';
    console.warn(`[Telegram] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensajeHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const resData = await response.json();

    if (!response.ok || !resData.ok) {
      const errorDesc = resData.description || `Error HTTP ${response.status}`;
      console.error('[Telegram] Error al enviar mensaje:', errorDesc);
      return { success: false, error: errorDesc, data: resData };
    }

    return { success: true, data: resData };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error de red con Telegram API';
    console.error('[Telegram] Excepción al enviar mensaje:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Consulta un pedido con sus clientes y detalles de producto, y envía la notificación a Telegram
 */
export async function notificarNuevoPedidoTelegram(pedidoId: string): Promise<{ success: boolean; error?: string }> {
  if (!pedidoId) {
    return { success: false, error: 'ID de pedido no proporcionado' };
  }

  try {
    const { data: pedido, error } = await supabaseAdmin
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        precio_total,
        comentarios,
        creado_en,
        cliente_nombre,
        cliente_telefono,
        clientes (
          id,
          nombre_local,
          razon_social,
          rfc,
          telefono,
          email_facturacion
        ),
        pedido_detalles (
          id,
          cantidad,
          precio_aplicado,
          subtotal,
          comentarios,
          variante_id,
          producto_variantes (
            id,
            gramaje,
            productos (
              id,
              nombre
            )
          )
        )
      `)
      .eq('id', pedidoId)
      .single();

    if (error || !pedido) {
      console.error('[Telegram] No se encontró el pedido para notificar:', error);
      return { success: false, error: error?.message || 'Pedido no encontrado' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = pedido.clientes as any;
    const nombreCliente = pedido.cliente_nombre || cliente?.nombre_local || cliente?.razon_social || 'Cliente General';
    const telefonoCliente = pedido.cliente_telefono || cliente?.telefono || null;
    const rfcCliente = cliente?.rfc || null;
    const emailCliente = cliente?.email_facturacion || null;

    let fechaFormateada = '';
    try {
      fechaFormateada = new Date(pedido.creado_en || Date.now()).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      fechaFormateada = new Date().toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (pedido.pedido_detalles || []) as any[];
    let itemsTexto = '';

    if (items.length > 0) {
      itemsTexto = items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((it: any) => {
          const prodNombre = it.producto_variantes?.productos?.nombre || 'Producto';
          const gramaje = it.producto_variantes?.gramaje ? ` (${it.producto_variantes.gramaje})` : '';
          const cant = it.cantidad || 1;
          const subt = formatCurrency(it.subtotal || (cant * (it.precio_aplicado || 0)));
          const notasItem = it.comentarios ? ` <i>[${escapeTgHtml(it.comentarios)}]</i>` : '';
          return `  • <b>${cant}x</b> ${escapeTgHtml(prodNombre)}${escapeTgHtml(gramaje)} — <code>${subt}</code>${notasItem}`;
        })
        .join('\n');
    } else {
      itemsTexto = '  <i>Sin detalle de productos registrado</i>';
    }

    const numPedidoStr = pedido.numero_pedido ? `#${pedido.numero_pedido}` : `#${pedido.id.slice(0, 8)}`;
    const totalStr = formatCurrency(pedido.precio_total || 0);

    let mensaje = `🍜 <b>¡NUEVO PEDIDO RECIBIDO!</b>\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `🧾 <b>Pedido:</b> <code>${escapeTgHtml(numPedidoStr)}</code>\n`;
    mensaje += `🏢 <b>Cliente:</b> <b>${escapeTgHtml(nombreCliente)}</b>\n`;
    if (rfcCliente) {
      mensaje += `👤 <b>RFC:</b> <code>${escapeTgHtml(rfcCliente)}</code>\n`;
    }
    if (telefonoCliente) {
      mensaje += `📞 <b>Teléfono:</b> <code>${escapeTgHtml(telefonoCliente)}</code>\n`;
    }
    if (emailCliente) {
      mensaje += `📧 <b>Email:</b> ${escapeTgHtml(emailCliente)}\n`;
    }
    mensaje += `📅 <b>Fecha:</b> ${escapeTgHtml(fechaFormateada)}\n\n`;
    mensaje += `📦 <b>Productos:</b>\n${itemsTexto}\n`;
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    mensaje += `💰 <b>TOTAL:</b> <b>${escapeTgHtml(totalStr)} MXN</b>\n`;

    if (pedido.comentarios && pedido.comentarios.trim()) {
      mensaje += `\n📝 <b>Notas / Comentarios:</b>\n<i>${escapeTgHtml(pedido.comentarios.trim())}</i>\n`;
    }

    return await enviarMensajeTelegram(mensaje);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error inesperado al notificar pedido';
    console.error('[Telegram] Error al procesar notificación de pedido:', err);
    return { success: false, error: errorMsg };
  }
}

/**
 * Prueba de conexión para verificar que el token y chat ID sean válidos
 */
export async function probarTelegram(customToken?: string, customChatId?: string): Promise<{ success: boolean; botName?: string; error?: string }> {
  const creds = getTelegramCredentials(customChatId);
  const token = customToken?.trim() || creds.botToken;
  const chatId = customChatId?.trim() || creds.chatId;

  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN no configurado' };
  }

  try {
    const resGetMe = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const dataGetMe = await resGetMe.json();
    if (!resGetMe.ok || !dataGetMe.ok) {
      return { success: false, error: dataGetMe.description || 'Token de bot inválido' };
    }

    const botName = dataGetMe.result?.username || dataGetMe.result?.first_name || 'Bot';

    if (chatId) {
      const resSend = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ <b>¡Conexión exitosa con SEIMENJO ERP!</b>\nLas notificaciones de pedidos llegarán a este canal.`,
          parse_mode: 'HTML',
        }),
      });
      const dataSend = await resSend.json();
      if (!resSend.ok || !dataSend.ok) {
        return { success: false, botName, error: `Bot válido (@${botName}), pero falló al enviar mensaje: ${dataSend.description}` };
      }
    }

    return { success: true, botName };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al conectar con Telegram' };
  }
}
