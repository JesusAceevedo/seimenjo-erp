'use server';

import nodemailer from 'nodemailer';
import { XMLParser } from 'fast-xml-parser';
import {
  supabaseAdmin,
  getUserEmpresaId,
  getFormaPagoIdByCode,
  getEstatusFacturaIdByName
} from '../../../lib/supabaseAdmin';

// Configuración SMTP por empresa (se cargará desde las variables de entorno o la configuración de la empresa)
let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpConfig() {
  if (smtpTransporter) return smtpTransporter;

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  smtpTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  return smtpTransporter;
}

// 1. Generate Signed URL for secure downloads
export async function obtenerSignedUrl(filePath: string, token: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // If it is a direct Google Drive link or external URL, return it directly
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return { success: true, url: filePath };
    }

    // Use admin client to create the signed URL to bypass storage RLS safely for authorized users
    const { data, error } = await supabaseAdmin.storage.from('facturas').createSignedUrl(filePath, 900); // Valid for 15 minutes
    if (error) return { success: false, error: error.message || 'Error al generar enlace de firma' };
    if (!data?.signedUrl) return { success: false, error: 'URL firmada no disponible' };
    return { success: true, url: data.signedUrl };
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    return { success: false, error: err?.message || 'Error al generar enlace de descarga' };
  }
}

// 2. Simulated Mailer for customer invoices
export async function enviarFacturaPorCorreo(pedidoId: string, token: string): Promise<{ success: boolean; error?: string; email?: string; cliente?: string; numero_pedido?: string; total?: number; uuid_fiscal?: string; xmlUrl?: string | null; pdfUrl?: string | null }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // 1. Get Pedido (must belong to active company)
    const { data: pedido, error: pedErr } = await supabaseAdmin
      .from('pedidos')
      .select('id, numero_pedido, precio_total, cliente_id')
      .eq('id', pedidoId)
      .eq('empresa_id', empresaId)
      .single();
    if (pedErr || !pedido) throw new Error('Pedido no encontrado');

    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from('clientes')
      .select('nombre_local, email_facturacion')
      .eq('id', pedido.cliente_id)
      .eq('empresa_id', empresaId)
      .single();
    if (cliErr || !cliente) throw new Error('Cliente no encontrado');

    if (!cliente.email_facturacion) {
      throw new Error(`El cliente ${cliente.nombre_local} no tiene registrado correo de facturación.`);
    }

    // 2. Get Factura files
    const { data: factura, error: facErr } = await supabaseAdmin
      .from('facturas_clientes')
      .select('xml_url, pdf_url, uuid_fiscal')
      .eq('pedido_id', pedidoId)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (facErr || !factura) {
      throw new Error('No se encontró factura emitida para este pedido.');
    }

    // 3. Generate signed links for the mail
    const [xmlUrl, pdfUrl] = await Promise.all([
      factura.xml_url
        ? (factura.xml_url.startsWith('http://') || factura.xml_url.startsWith('https://')
          ? Promise.resolve(factura.xml_url)
          : supabaseAdmin.storage.from('facturas').createSignedUrl(factura.xml_url, 86400 * 3).then(res => res.data?.signedUrl || null))
        : Promise.resolve(null),
      factura.pdf_url
        ? (factura.pdf_url.startsWith('http://') || factura.pdf_url.startsWith('https://')
          ? Promise.resolve(factura.pdf_url)
          : supabaseAdmin.storage.from('facturas').createSignedUrl(factura.pdf_url, 86400 * 3).then(res => res.data?.signedUrl || null))
        : Promise.resolve(null)
    ]);

    // 4. Send email via SMTP
    const transport = getSmtpConfig();
    const attachmentLinks = [];
    if (xmlUrl) {
      attachmentLinks.push(`<a href="${xmlUrl}" target="_blank" rel="noreferrer">Descargar XML</a>`);
    }
    if (pdfUrl) {
      attachmentLinks.push(`<a href="${pdfUrl}" target="_blank" rel="noreferrer">Descargar PDF</a>`);
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || 'facturacion@seimenjo.com',
      to: cliente.email_facturacion,
      subject: `Factura Electrónica SAT CFDI 4.0 - Pedido #${pedido.numero_pedido}`,
      text: `Estimado/a ${cliente.nombre_local},\n\nLe hacemos llegar la factura correspondiente a su pedido con número #${pedido.numero_pedido} por un total de $${pedido.precio_total} MXN.\n\nUUID Fiscal: ${factura.uuid_fiscal}\n\nLos archivos adjuntos están disponibles en los enlaces firmados a continuación.\n\nSaludos cordiales,\nSistema de Facturación`,
      html: `<p>Estimado/a <strong>${cliente.nombre_local}</strong>,</p>
        <p>Le hacemos llegar la factura correspondiente a su pedido con número <strong>#${pedido.numero_pedido}</strong> por un total de <strong>$${pedido.precio_total} MXN</strong>.</p>
        <p>UUID Fiscal: ${factura.uuid_fiscal}</p>
        <div>
          <p class="text-xs text-gray-600 font-mono">Archivos Adjuntos (Enlaces Firmados de Storage):</p>
          <div>${attachmentLinks.join(' | ')}</div>
        </div>`,
      attachments: [
        ...(xmlUrl ? [{ path: xmlUrl }] : []),
        ...(pdfUrl ? [{ path: pdfUrl }] : [])
      ]
    };

    await transport.sendMail(mailOptions);

    return {
      success: true,
      email: cliente.email_facturacion,
      cliente: cliente.nombre_local,
      numero_pedido: pedido.numero_pedido,
      total: pedido.precio_total,
      uuid_fiscal: factura.uuid_fiscal,
      xmlUrl,
      pdfUrl
    };
  } catch (err: any) {
    console.error('Error sending invoice email:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al enviar el correo' };
  }
}

// 3. Save invoice data in DB atomically (handling both association & standalone flows)
export async function guardarFacturaEnBaseDatos(payload: {
  isGasto: boolean;
  asociarExistente: boolean;
  existenteId?: string; // Gasto ID or Pedido ID
  xmlData: {
    total: number;
    subtotal: number;
    iva: number;
    fecha: string;
    serie: string;
    folio: string;
    formaPagoCode: string;
    uuid: string;
    fechaTimbrado: string;
    emisorRfc: string;
    emisorNombre: string;
    receptorRfc: string;
    receptorNombre: string;
    usoCfdi?: string;
    isComplementoPago?: boolean;
    uuidsRelacionados?: string[];
  };
  xmlUrl: string;
  pdfUrl: string;
  ticketUrl?: string | null;
}, token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { isGasto, asociarExistente, existenteId, xmlData, xmlUrl, pdfUrl, ticketUrl } = payload;

    // Validación estricta de RFC por empresa activa
    if (empresaId) {
      const { data: empData } = await supabaseAdmin
        .from('empresas')
        .select('rfc, nombre')
        .eq('id', empresaId)
        .maybeSingle();

      if (empData?.rfc) {
        const activeEmpRfc = empData.rfc.trim().toUpperCase();
        if (isGasto) {
          const recRfc = (xmlData.receptorRfc || '').trim().toUpperCase();
          if (recRfc && recRfc !== activeEmpRfc) {
            throw new Error(`El XML no pertenece a esta empresa (${empData.nombre || ''}). El RFC receptor (${xmlData.receptorRfc}) no coincide con el RFC oficial de la empresa (${activeEmpRfc}).`);
          }
        } else {
          const emiRfc = (xmlData.emisorRfc || '').trim().toUpperCase();
          if (emiRfc && emiRfc !== activeEmpRfc) {
            throw new Error(`El XML no pertenece a esta empresa (${empData.nombre || ''}). El RFC emisor (${xmlData.emisorRfc}) no coincide con el RFC oficial de la empresa (${activeEmpRfc}).`);
          }
        }
      }
    }

    const formaPagoId = await getFormaPagoIdByCode(xmlData.formaPagoCode);
    const estatusFacturaId = await getEstatusFacturaIdByName('Facturado');

    // 1. Proactive Duplication Validation (UUID check)
    if (isGasto) {
      const { data: duplicateGasto } = await supabaseAdmin
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto')
        .ilike('uuid_fiscal', xmlData.uuid)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (duplicateGasto) {
        throw new Error(`Esta factura ya está registrada en el Gasto: "${duplicateGasto.concepto}" (Monto: $${duplicateGasto.monto}, Fecha: ${duplicateGasto.fecha_gasto}).`);
      }
    } else {
      const { data: duplicateVenta } = await supabaseAdmin
        .from('facturas_clientes')
        .select('id, total, pedido_id, fecha_emision')
        .ilike('uuid_fiscal', xmlData.uuid)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (duplicateVenta) {
        throw new Error(`Esta factura ya está registrada en la Venta/Pedido ID: ${duplicateVenta.pedido_id} (Total: $${duplicateVenta.total}).`);
      }
    }

    if (isGasto) {
      // --- REGISTRO DE GASTO (PROVEEDOR) ---
      // Match or create supplier by RFC (always run this to link supplier)
      let proveedorId = null;
      if (xmlData.emisorRfc) {
        const { data: prov } = await supabaseAdmin
          .from('proveedores')
          .select('id')
          .eq('rfc', xmlData.emisorRfc.toUpperCase())
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (prov) {
          proveedorId = prov.id;
        } else {
          const { data: newProv, error: errP } = await supabaseAdmin
            .from('proveedores')
            .insert({
              rfc: xmlData.emisorRfc.toUpperCase(),
              nombre_comercial: xmlData.emisorNombre || xmlData.emisorRfc,
              razon_social: xmlData.emisorNombre || xmlData.emisorRfc,
              empresa_id: empresaId
            })
            .select('id')
            .single();
          if (errP) throw errP;
          proveedorId = newProv.id;
        }
      }

      if (asociarExistente && existenteId) {
        // CAMINO 1: Asociar a Gasto existente
        const { data: parentGasto, error: gastoErr } = await supabaseAdmin
          .from('gastos')
          .select('id, concepto, monto, xml_url, pdf_url, ticket_url, uuid_fiscal, subtotal, iva_acreditable, categoria_id, proveedor_id, movimiento_bancario_id')
          .eq('id', existenteId)
          .eq('empresa_id', empresaId)
          .single();
        if (gastoErr || !parentGasto) throw new Error('No se encontró el gasto a asociar.');

        if (xmlData.isComplementoPago) {
          // --- OPCCIÓN 2: Guardar como Gasto Hijo (REP) ---
          const { data: childGasto, error: childErr } = await supabaseAdmin
            .from('gastos')
            .insert({
              fecha_gasto: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
              concepto: `REP (Complemento de Pago) para: ${parentGasto.concepto}`,
              monto: xmlData.total, // Real payment amount
              subtotal: xmlData.subtotal,
              iva_acreditable: xmlData.iva,
              uuid_fiscal: xmlData.uuid.toUpperCase(),
              fecha_timbrado: xmlData.fechaTimbrado || null,
              xml_url: xmlUrl,
              pdf_url: pdfUrl,
              ticket_url: ticketUrl || null,
              proveedor_id: proveedorId || parentGasto.proveedor_id,
              categoria_id: parentGasto.categoria_id,
              forma_pago_id: formaPagoId,
              estatus_factura_id: estatusFacturaId,
              estatus_facturado: true,
              metodo_pago: mapFormaPagoCodeToMetodo(xmlData.formaPagoCode),
              gasto_padre_id: parentGasto.id,
              movimiento_bancario_id: parentGasto.movimiento_bancario_id,
              empresa_id: empresaId,
              es_deducible: true
            })
            .select()
            .single();

          if (childErr) throw childErr;
          return { success: true, mode: 'association', data: [childGasto] };
        } else {
          // --- REGULAR INVOICE UPDATE ---
          if (Math.abs(Number(parentGasto.monto) - Number(xmlData.total)) > 0.01) {
            throw new Error(`El importe del gasto ($${Number(parentGasto.monto).toFixed(2)}) no coincide con el total de la factura ($${Number(xmlData.total).toFixed(2)}).`);
          }

          const currentXml = parentGasto.xml_url || '';
          const currentPdf = parentGasto.pdf_url || '';
          const currentTicket = parentGasto.ticket_url || '';

          const newXml = currentXml ? `${currentXml},${xmlUrl}` : xmlUrl;
          const newPdf = currentPdf ? `${currentPdf},${pdfUrl}` : pdfUrl;
          const newTicket = ticketUrl ? (currentTicket ? `${currentTicket},${ticketUrl}` : ticketUrl) : currentTicket;

          const { data, error } = await supabaseAdmin
            .from('gastos')
            .update({
              uuid_fiscal: parentGasto.uuid_fiscal || xmlData.uuid,
              subtotal: parentGasto.subtotal || xmlData.subtotal,
              iva_acreditable: parentGasto.iva_acreditable || xmlData.iva,
              xml_url: newXml,
              pdf_url: newPdf,
              ticket_url: newTicket || null,
              proveedor_id: proveedorId || parentGasto.proveedor_id,
              forma_pago_id: formaPagoId,
              estatus_factura_id: estatusFacturaId,
              estatus_facturado: true
            })
            .eq('id', existenteId)
            .eq('empresa_id', empresaId)
            .select();

          if (error) throw error;
          return { success: true, mode: 'association', data };
        }
      } else {
        // CAMINO 2: Gasto suelto (INSERT)
        const { data, error } = await supabaseAdmin
          .from('gastos')
          .insert({
            fecha_gasto: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
            concepto: xmlData.isComplementoPago 
              ? `REP (Complemento de Pago) suelto (UUID: ${xmlData.uuid.substring(0, 8)})`
              : `Gasto por factura XML (UUID: ${xmlData.uuid.substring(0, 8)})`,
            monto: xmlData.total,
            subtotal: xmlData.subtotal,
            iva_acreditable: xmlData.iva,
            uuid_fiscal: xmlData.uuid.toUpperCase(),
            fecha_timbrado: xmlData.fechaTimbrado || null,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            ticket_url: ticketUrl || null,
            proveedor_id: proveedorId,
            forma_pago_id: formaPagoId,
            estatus_factura_id: estatusFacturaId,
            estatus_facturado: true,
            metodo_pago: mapFormaPagoCodeToMetodo(xmlData.formaPagoCode),
            empresa_id: empresaId,
            es_deducible: true
          })
          .select();

        if (error) throw error;
        return { success: true, mode: 'creation', data };
      }
    } else {
      // --- REGISTRO DE VENTA (CLIENTE) ---
      // Match/Create Cliente by Receptor RFC
      let clienteId = null;
      if (xmlData.receptorRfc) {
        const { data: cli } = await supabaseAdmin
          .from('clientes')
          .select('id')
          .eq('rfc', xmlData.receptorRfc.toUpperCase())
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (cli) {
          clienteId = cli.id;
        } else {
          const { data: newCli, error: errC } = await supabaseAdmin
            .from('clientes')
            .insert({
              rfc: xmlData.receptorRfc.toUpperCase(),
              nombre_local: xmlData.receptorNombre || xmlData.receptorRfc,
              razon_social: xmlData.receptorNombre || xmlData.receptorRfc,
              empresa_id: empresaId
            })
            .select('id')
            .single();
          if (errC) throw errC;
          clienteId = newCli.id;
        }
      }

      if (asociarExistente && existenteId) {
        // CAMINO 1: Asociar a Pedido existente (INSERT factura + UPDATE pedido)
        const { data: pedido, error: pedErr } = await supabaseAdmin
          .from('pedidos')
          .select('precio_total')
          .eq('id', existenteId)
          .eq('empresa_id', empresaId)
          .single();
        if (pedErr || !pedido) throw new Error('No se encontró el pedido a asociar.');
        if (!xmlData.isComplementoPago && Math.abs(Number(pedido.precio_total) - Number(xmlData.total)) > 0.01) {
          throw new Error(`El importe del pedido ($${Number(pedido.precio_total).toFixed(2)}) no coincide con el total de la factura ($${Number(xmlData.total).toFixed(2)}).`);
        }

        // 1. Insert Client Invoice
        const { data, error } = await supabaseAdmin
          .from('facturas_clientes')
          .insert({
            pedido_id: existenteId,
            cliente_id: clienteId,
            uuid_fiscal: xmlData.uuid.toUpperCase(),
            serie_folio: `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || null,
            fecha_emision: xmlData.fecha || null,
            fecha_timbrado: xmlData.fechaTimbrado || null,
            subtotal: xmlData.subtotal,
            iva_trasladado: xmlData.iva,
            total: xmlData.total,
            forma_pago_id: formaPagoId,
            estatus_factura_id: estatusFacturaId,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            ticket_url: ticketUrl || null,
            uso_cfdi_clave: xmlData.usoCfdi || 'G03',
            empresa_id: empresaId
          })
          .select();

        if (error) throw error;

        // 2. Update Pedido status
        const { error: pedError } = await supabaseAdmin
          .from('pedidos')
          .update({
            folio_factura: `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || 'FACTURADO',
            estatus_pago: 'Liquidado'
          })
          .eq('id', existenteId)
          .eq('empresa_id', empresaId);

        if (pedError) console.error('Error updating associated pedido status:', pedError);

        return { success: true, mode: 'association', data };
      } else {
        // CAMINO 2: Subida suelta (INSERT factura + CONCILIACIÓN AUTOMÁTICA)
        // 1. Insert standalone Client Invoice
        const { data, error } = await supabaseAdmin
          .from('facturas_clientes')
          .insert({
            cliente_id: clienteId,
            uuid_fiscal: xmlData.uuid.toUpperCase(),
            serie_folio: `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || null,
            fecha_emision: xmlData.fecha || null,
            fecha_timbrado: xmlData.fechaTimbrado || null,
            subtotal: xmlData.subtotal,
            iva_trasladado: xmlData.iva,
            total: xmlData.total,
            forma_pago_id: formaPagoId,
            estatus_factura_id: estatusFacturaId,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            ticket_url: ticketUrl || null,
            uso_cfdi_clave: xmlData.usoCfdi || 'G03',
            empresa_id: empresaId
          })
          .select('id')
          .single();

        if (error) throw error;

        // 2. Conciliación Inteligente: Look for an un-invoiced, un-liquidated order with same total & client
        let matchedPedidoId = null;
        if (clienteId) {
          const { data: matchedP } = await supabaseAdmin
            .from('pedidos')
            .select('id, numero_pedido')
            .eq('cliente_id', clienteId)
            .eq('precio_total', xmlData.total)
            .neq('estatus_pago', 'Liquidado')
            .is('folio_factura', null)
            .eq('empresa_id', empresaId)
            .order('creado_en', { ascending: false })
            .limit(1)
            .maybeSingle();

          const folioStr = `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || (xmlData.uuid ? `UUID-${xmlData.uuid.substring(0, 6)}` : 'FACTURADO');

          if (matchedP) {
            matchedPedidoId = matchedP.id;
            console.log(`Auto-conciliated: matched Invoice with Pedido #${matchedP.numero_pedido}`);

            // Link invoice to this pedido
            await supabaseAdmin
              .from('facturas_clientes')
              .update({ pedido_id: matchedPedidoId })
              .eq('id', data.id)
              .eq('empresa_id', empresaId);

            // Mark order as invoiced & paid
            await supabaseAdmin
              .from('pedidos')
              .update({
                folio_factura: folioStr,
                estatus_pago: 'Liquidado'
              })
              .eq('id', matchedPedidoId)
              .eq('empresa_id', empresaId);
          } else {
            // Check for multiple orders of the same client whose sum equals xmlData.total
            const { data: clientOrders } = await supabaseAdmin
              .from('pedidos')
              .select('id, numero_pedido, precio_total')
              .eq('cliente_id', clienteId)
              .is('folio_factura', null)
              .neq('estatus_pago', 'Cancelado')
              .eq('empresa_id', empresaId)
              .order('creado_en', { ascending: false });

            if (clientOrders && clientOrders.length > 1) {
              let matchedSubset: typeof clientOrders = [];
              let currentSum = 0;
              for (const p of clientOrders) {
                if (currentSum + Number(p.precio_total) <= xmlData.total + 0.01) {
                  currentSum += Number(p.precio_total);
                  matchedSubset.push(p);
                  if (Math.abs(currentSum - xmlData.total) < 0.01) break;
                }
              }

              if (Math.abs(currentSum - xmlData.total) < 0.01 && matchedSubset.length > 0) {
                matchedPedidoId = matchedSubset[0].id;
                const matchedIds = matchedSubset.map(p => p.id);

                console.log(`Auto-conciliated: matched Invoice with ${matchedSubset.length} Pedidos (${matchedSubset.map(p => '#' + p.numero_pedido).join(', ')})`);

                await supabaseAdmin
                  .from('facturas_clientes')
                  .update({ pedido_id: matchedPedidoId })
                  .eq('id', data.id)
                  .eq('empresa_id', empresaId);

                await supabaseAdmin
                  .from('pedidos')
                  .update({
                    folio_factura: folioStr,
                    estatus_pago: 'Liquidado'
                  })
                  .in('id', matchedIds)
                  .eq('empresa_id', empresaId);
              }
            }
          }
        }

        return { success: true, mode: 'creation', autoMatched: !!matchedPedidoId, data };
      }
    }
  } catch (err: any) {
    console.error('Error saving invoice metadata:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al guardar metadatos en la base de datos' };
  }
}

// 4. Comprobar egreso manual por transferencia con múltiples facturas XML
export async function comprobarEgresoConFacturas(
  egresoPadreId: string,
  subgastosIds: string[],
  comentariosComprobacion: string | undefined,
  token: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!egresoPadreId) {
      throw new Error('El ID del egreso principal es requerido.');
    }
    if (!subgastosIds || subgastosIds.length === 0) {
      throw new Error('Debes seleccionar al menos una factura XML para comprobar.');
    }

    // 1. Obtener datos del egreso padre para validar y documentar
    const { data: egresoPadre, error: egresoErr } = await supabaseAdmin
      .from('gastos')
      .select('monto, concepto, comentarios')
      .eq('id', egresoPadreId)
      .eq('empresa_id', empresaId)
      .single();

    if (egresoErr || !egresoPadre) {
      throw new Error('No se encontró el egreso principal en la base de datos.');
    }

    // 2. Asociar los subgastos al egreso padre (gasto_padre_id)
    const { error: assocErr } = await supabaseAdmin
      .from('gastos')
      .update({ gasto_padre_id: egresoPadreId })
      .in('id', subgastosIds)
      .eq('empresa_id', empresaId);

    if (assocErr) throw assocErr;

    // 3. Obtener detalles de las facturas asociadas para consolidar en comentarios
    const { data: subgastos } = await supabaseAdmin
      .from('gastos')
      .select('uuid_fiscal, folio_factura, monto')
      .in('id', subgastosIds)
      .eq('empresa_id', empresaId);

    const detComprobantes = subgastos
      ? subgastos
          .map(
            (s) =>
              `Factura XML (UUID: ${s.uuid_fiscal?.substring(0, 8) || 'N/A'}${
                s.folio_factura ? `, Folio: ${s.folio_factura}` : ''
              }, Monto: $${Number(s.monto).toFixed(2)})`
          )
          .join('; ')
      : '';

    const nuevoComentario = `[COMPROBADO CON XMLs: ${detComprobantes}]${
      comentariosComprobacion ? ` - Nota: ${comentariosComprobacion}` : ''
    }${egresoPadre.comentarios ? ` | ${egresoPadre.comentarios}` : ''}`;

    // 4. Actualizar egreso padre: marcar como facturado/comprobado y añadir comentarios detallados
    const { data, error: updateErr } = await supabaseAdmin
      .from('gastos')
      .update({
        estatus_facturado: true,
        comentarios: nuevoComentario.substring(0, 1000)
      })
      .eq('id', egresoPadreId)
      .eq('empresa_id', empresaId)
      .select();

    if (updateErr) throw updateErr;

    return { success: true, data };
  } catch (err: any) {
    console.error('Error en comprobarEgresoConFacturas:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return {
      success: false,
      error: message || 'Error al comprobar el egreso con las facturas seleccionadas'
    };
  }
}

// 5. Save/Update Supplier
export async function guardarProveedor(proveedor: any, token: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!proveedor.nombre_comercial) {
      throw new Error('El nombre comercial es requerido.');
    }
    if (!proveedor.rfc) {
      throw new Error('El RFC es requerido.');
    }

    const payload = {
      nombre_comercial: proveedor.nombre_comercial,
      razon_social: proveedor.razon_social || proveedor.nombre_comercial,
      rfc: proveedor.rfc.toUpperCase().trim(),
      telefono: proveedor.telefono || null,
      email: proveedor.email || null,
      alias: proveedor.alias || null,
      portal_facturacion: proveedor.portal_facturacion || null,
      sitio_web: proveedor.sitio_web || null,
      direccion: proveedor.direccion || null,
      comentarios: proveedor.comentarios || null,
      banco_nombre: proveedor.banco_nombre || null,
      cuenta_clabe: proveedor.cuenta_clabe || null,
      cuenta_numero: proveedor.cuenta_numero || null,
      convenio_numero: proveedor.convenio_numero || null,
      referencia_bancaria: proveedor.referencia_bancaria || null,
      empresa_id: empresaId
    };

    if (proveedor.id) {
      // Update
      const { data, error } = await supabaseAdmin
        .from('proveedores')
        .update(payload)
        .eq('id', proveedor.id)
        .eq('empresa_id', empresaId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } else {
      // Insert
      // Check if RFC already exists for this company
      const { data: existing } = await supabaseAdmin
        .from('proveedores')
        .select('id')
        .eq('rfc', payload.rfc)
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (existing) {
        throw new Error(`Ya existe un proveedor registrado con el RFC: ${payload.rfc}`);
      }

      const { data, error } = await supabaseAdmin
        .from('proveedores')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    }
  } catch (err: any) {
    console.error('Error en guardarProveedor:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al guardar el proveedor' };
  }
}

// 6. Delete Supplier
export async function eliminarProveedor(id: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    
    // Check if supplier has associated invoices/gastos
    const { count, error: countErr } = await supabaseAdmin
      .from('gastos')
      .select('id', { count: 'exact', head: true })
      .eq('proveedor_id', id)
      .eq('empresa_id', empresaId);

    if (countErr) throw countErr;
    if (count && count > 0) {
      throw new Error('No se puede eliminar el proveedor porque tiene gastos o facturas asociadas.');
    }

    const { error } = await supabaseAdmin
      .from('proveedores')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error en eliminarProveedor:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al eliminar el proveedor' };
  }
}

// 7. Get all invoices (gastos) emitted by a supplier
export async function obtenerFacturasPorProveedor(proveedorId: string, token: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    
    const { data, error } = await supabaseAdmin
      .from('gastos')
      .select('id, fecha_gasto, concepto, monto, subtotal, iva_acreditable, uuid_fiscal, xml_url, pdf_url, ticket_url, gasto_padre_id')
      .eq('proveedor_id', proveedorId)
      .eq('empresa_id', empresaId)
      .order('fecha_gasto', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error en obtenerFacturasPorProveedor:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al obtener facturas del proveedor' };
  }
}

// ── Actualizar categoría de un gasto ─────────────────────────────────────────
export async function actualizarCategoriaGasto(
  gastoId: string,
  categoriaId: string | null,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { error } = await supabaseAdmin
      .from('gastos')
      .update({ categoria_id: categoriaId })
      .eq('id', gastoId)
      .eq('empresa_id', empresaId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al actualizar categoría' };
  }
}

export async function procesarLoteFacturas(payloads: {
  isGasto: boolean;
  xmlData: {
    total: number;
    subtotal: number;
    iva: number;
    fecha: string;
    serie: string;
    folio: string;
    formaPagoCode: string;
    uuid: string;
    fechaTimbrado: string;
    emisorRfc: string;
    emisorNombre: string;
    receptorRfc: string;
    receptorNombre: string;
    usoCfdi?: string;
    isComplementoPago?: boolean;
    uuidsRelacionados?: string[];
    isCanceled?: boolean;
  };
  xmlUrl?: string;
}[], token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const estatusFacturaId = await getEstatusFacturaIdByName('Facturado');
    // Asumimos que podemos necesitar el ID de cancelado, pero si falla getEstatusFacturaIdByName, usaremos otro enfoque.
    // getEstatusFacturaIdByName('Cancelado')
    
    let agregados = 0;
    let actualizados = 0;
    let ignorados = 0;
    let errores = 0;
    let detallesErrores: string[] = [];

    for (const payload of payloads) {
      try {
        const { isGasto, xmlData, xmlUrl } = payload;
        const formaPagoId = await getFormaPagoIdByCode(xmlData.formaPagoCode);
        
        let targetTable = isGasto ? 'gastos' : 'facturas_clientes';
        
        // Check if exists by UUID
        const { data: existingRecord } = await supabaseAdmin
          .from(targetTable)
          .select('id, uuid_fiscal, monto, subtotal, iva_acreditable, estatus_facturado, total')
          .ilike('uuid_fiscal', xmlData.uuid)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (existingRecord) {
          // Si es cancelación explícita en el payload
          if (xmlData.isCanceled) {
             const { error: updErr } = await supabaseAdmin
               .from(targetTable)
               .update({ 
                  monto: 0, 
                  subtotal: 0, 
                  ...(isGasto ? { iva_acreditable: 0 } : {}), 
                  ...(isGasto ? {} : { total: 0 }),
                  estatus_facturado: false // O un estatus específico de cancelación
               })
               .eq('id', existingRecord.id);
             if (!updErr) actualizados++; else { errores++; detallesErrores.push(`Error al actualizar UUID ${xmlData.uuid}: ${updErr.message}`); console.error('UpdErr:', updErr); }
             continue;
          }

          // Si existe pero no está cancelado, verificamos si los montos difieren
          const currentTotal = isGasto ? existingRecord.monto : existingRecord.total;
          if (Math.abs(Number(currentTotal) - Number(xmlData.total)) > 0.01) {
             // Actualizar montos
             const { error: updErr } = await supabaseAdmin
               .from(targetTable)
               .update({ 
                  ...(isGasto ? { monto: xmlData.total, subtotal: xmlData.subtotal, iva_acreditable: xmlData.iva } : { total: xmlData.total, subtotal: xmlData.subtotal }), 
                  ...(xmlUrl ? { xml_url: xmlUrl } : {})
               })
               .eq('id', existingRecord.id);
             if (!updErr) actualizados++; else { errores++; detallesErrores.push(`Error al actualizar UUID ${xmlData.uuid}: ${updErr.message}`); console.error('UpdErr:', updErr); }
          } else {
             ignorados++;
          }
        } else {
          // NO EXISTE -> INSERTAR NUEVO
          if (isGasto) {
             // Proveedor
             let proveedorId = null;
             if (xmlData.emisorRfc) {
               const { data: prov } = await supabaseAdmin
                 .from('proveedores')
                 .select('id')
                 .eq('rfc', xmlData.emisorRfc.toUpperCase())
                 .eq('empresa_id', empresaId)
                 .maybeSingle();
               if (prov) {
                 proveedorId = prov.id;
               } else {
                 const { data: newProv } = await supabaseAdmin
                   .from('proveedores')
                   .insert({
                     rfc: xmlData.emisorRfc.toUpperCase(),
                     nombre_comercial: xmlData.emisorNombre || xmlData.emisorRfc,
                     razon_social: xmlData.emisorNombre || xmlData.emisorRfc,
                     empresa_id: empresaId
                   })
                   .select('id').single();
                 if (newProv) proveedorId = newProv.id;
               }
             }

             const { error: insErr } = await supabaseAdmin
               .from('gastos')
               .insert({
                 fecha_gasto: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
                 concepto: xmlData.usoCfdi ? `Factura (Uso: ${xmlData.usoCfdi})` : 'Gasto Facturado',
                 monto: xmlData.total,
                 subtotal: xmlData.subtotal,
                 iva_acreditable: xmlData.iva,
                 uuid_fiscal: xmlData.uuid.toUpperCase(),
                 fecha_timbrado: xmlData.fechaTimbrado || null,
                 xml_url: xmlUrl,
                 proveedor_id: proveedorId,
                 forma_pago_id: formaPagoId,
                 estatus_factura_id: estatusFacturaId,
                 estatus_facturado: true,
                 metodo_pago: mapFormaPagoCodeToMetodo(xmlData.formaPagoCode),
                 empresa_id: empresaId,
                 es_deducible: true
               });
             if (!insErr) agregados++; else { errores++; detallesErrores.push(`Error al insertar Gasto UUID ${xmlData.uuid}: ${insErr.message}`); console.error('InsErrGasto:', insErr); }
          } else {
             // Factura Cliente (Ventas)
             const { error: insErr } = await supabaseAdmin
               .from('facturas_clientes')
               .insert({
                 pedido_id: null, // Factura suelta
                 fecha_emision: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
                 subtotal: xmlData.subtotal,
                 iva: xmlData.iva,
                 total: xmlData.total,
                 uuid_fiscal: xmlData.uuid.toUpperCase(),
                 fecha_timbrado: xmlData.fechaTimbrado || null,
                 xml_url: xmlUrl,
                 empresa_id: empresaId
               });
             if (!insErr) agregados++; else { errores++; detallesErrores.push(`Error al insertar Venta UUID ${xmlData.uuid}: ${insErr.message}`); console.error('InsErrVenta:', insErr); }
          }
        }
      } catch (err: any) {
        console.error('Error procesando payload masivo:', err);
        errores++;
        detallesErrores.push(`Error procesando XML: ${err.message}`);
      }
    }

    return { success: true, resumen: { agregados, actualizados, ignorados, errores, detallesErrores } };
  } catch (error: any) {
    console.error('Error en procesarLoteFacturas:', error);
    return { success: false, error: error.message || 'Error al procesar el lote.' };
  }
}

// ── Eliminar Gasto (solo si NO está conciliado) ─────────────────────────────────────────
export async function eliminarGasto(gastoId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    
    const { data: gasto } = await supabaseAdmin
      .from('gastos')
      .select('movimiento_bancario_id')
      .eq('id', gastoId)
      .eq('empresa_id', empresaId)
      .single();
      
    if (gasto?.movimiento_bancario_id) {
      throw new Error('No se puede eliminar un gasto que ya se encuentra conciliado.');
    }

    // Eliminar gastos hijos (comprobantes/REP)
    await supabaseAdmin
      .from('gastos')
      .delete()
      .eq('gasto_padre_id', gastoId)
      .eq('empresa_id', empresaId);

    const { error } = await supabaseAdmin
      .from('gastos')
      .delete()
      .eq('id', gastoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al eliminar el gasto' };
  }
}

// ── Eliminar Pedido/Venta (solo si NO está conciliado) ─────────────────────────────────────────
export async function eliminarPedidoSano(pedidoId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('movimiento_bancario_id')
      .eq('id', pedidoId)
      .eq('empresa_id', empresaId)
      .single();

    if (pedido?.movimiento_bancario_id) {
      throw new Error('No se puede eliminar una venta/pedido que ya se encuentra conciliado.');
    }

    await supabaseAdmin
      .from('facturas_clientes')
      .delete()
      .eq('pedido_id', pedidoId)
      .eq('empresa_id', empresaId);

    await supabaseAdmin
      .from('pedido_detalles')
      .delete()
      .eq('pedido_id', pedidoId)
      .eq('empresa_id', empresaId);

    const { error } = await supabaseAdmin
      .from('pedidos')
      .delete()
      .eq('id', pedidoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al eliminar el pedido' };
  }
}
export async function eliminarFacturaCliente(
  facturaId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    const { data: factura } = await supabaseAdmin
      .from('facturas_clientes')
      .select('pedido_id')
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .single();

    if (factura?.pedido_id) {
      throw new Error('No se puede eliminar una factura que ya está vinculada a un pedido.');
    }

    const { error } = await supabaseAdmin
      .from('facturas_clientes')
      .delete()
      .eq('id', facturaId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al eliminar la factura' };
  }
}

function mapFormaPagoCodeToMetodo(code: string): string {
  return code ? code.trim().padStart(2, '0') : '99';
}

export async function sincronizarMetodosPagoXml(token?: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token ?? '');
    const supabase = supabaseAdmin;

    // Traer todos los gastos de la empresa que tienen XML
    const { data: gastos, error } = await supabase
      .from('gastos')
      .select('id, metodo_pago, forma_pago_id, xml_url')
      .eq('empresa_id', empresaId)
      .not('xml_url', 'is', null);

    if (error) throw error;
    if (!gastos || gastos.length === 0) return { success: true, count: 0 };

    let corregidos = 0;

    for (const g of gastos) {
      if (!g.xml_url) continue;
      const urls = g.xml_url.split(',').filter(Boolean);
      if (urls.length === 0) continue;

      try {
        let text = '';
        if (urls[0].startsWith('http://') || urls[0].startsWith('https://')) {
          const res = await fetch(urls[0]);
          if (!res.ok) continue;
          text = await res.text();
        } else {
          // Download directly from Supabase Storage
          const { data: fileData, error: downloadErr } = await supabase.storage.from('facturas').download(urls[0]);
          if (downloadErr || !fileData) {
            console.error("Error downloading XML from storage for Gasto " + g.id, downloadErr);
            continue;
          }
          text = await fileData.text();
        }

        const formaPagoMatch = 
          text.match(/FormaPago\s*=\s*['"]([^'"]+)['"]/i) || 
          text.match(/formaDePago\s*=\s*['"]([^'"]+)['"]/i) ||
          text.match(/FormaDePagoP\s*=\s*['"]([^'"]+)['"]/i) ||
          text.match(/formaDePagoP\s*=\s*['"]([^'"]+)['"]/i);

        if (formaPagoMatch && formaPagoMatch[1]) {
          const codigo = formaPagoMatch[1];
          const correcto = mapFormaPagoCodeToMetodo(codigo);
          const formaPagoId = await getFormaPagoIdByCode(correcto);

          if (correcto && (g.metodo_pago !== correcto || g.forma_pago_id !== formaPagoId)) {
            await supabase.from('gastos').update({ 
              metodo_pago: correcto,
              forma_pago_id: formaPagoId
            }).eq('id', g.id);
            corregidos++;
          }
        }
      } catch (e) {
        console.error("Error procesando XML de gasto " + g.id, e);
      }
    }

    return { success: true, count: corregidos };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function consultarSatYActualizarCfdi(
  tipo: 'gasto' | 'venta',
  re: string,
  rr: string,
  tt: number,
  uuid: string,
  token: string
): Promise<{ success: boolean; estado: 'Vigente' | 'Cancelado' | 'No Encontrado'; actualizado: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    
    // Formatear el total a 6 decimales con relleno de ceros a la izquierda (total de 18 caracteres)
    const parts = Number(tt).toFixed(6).split('.');
    const integerPart = parts[0].padStart(10, '0');
    const decimalPart = parts[1];
    const ttFormatted = `${integerPart}.${decimalPart}`;

    const expresionImpresa = `?re=${re}&rr=${rr}&tt=${ttFormatted}&id=${uuid}`;

    const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
   <soapenv:Header/>
   <soapenv:Body>
      <tem:Consulta>
         <tem:expresionImpresa><![CDATA[${expresionImpresa}]]></tem:expresionImpresa>
      </tem:Consulta>
   </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch('https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=utf-8',
        'SOAPAction': 'http://tempuri.org/IConsultaCFDIService/Consulta'
      },
      body: soapEnvelope,
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    
    let estado: 'Vigente' | 'Cancelado' | 'No Encontrado' = 'No Encontrado';
    const estadoMatch = xmlText.match(/<a:Estado>([^<]+)<\/a:Estado>/) || xmlText.match(/<Estado>([^<]+)<\/Estado>/);
    if (estadoMatch) {
      const est = estadoMatch[1].trim();
      if (est === 'Vigente') estado = 'Vigente';
      else if (est === 'Cancelado') estado = 'Cancelado';
    }

    let actualizado = false;

    if (estado === 'Cancelado') {
      const targetTable = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';
      
      let canceladoEstatusId = null;
      const { data: canceladoEstatus } = await supabaseAdmin
        .from('estatus_factura')
        .select('id')
        .ilike('nombre', 'Cancelado')
        .maybeSingle();

      if (canceladoEstatus) {
        canceladoEstatusId = canceladoEstatus.id;
      } else {
        const { data: newStatus, error: insErr } = await supabaseAdmin
          .from('estatus_factura')
          .insert({ nombre: 'Cancelado' })
          .select('id')
          .single();
        if (!insErr && newStatus) {
          canceladoEstatusId = newStatus.id;
        }
      }

      const { data: record } = await supabaseAdmin
        .from(targetTable)
        .select('*')
        .ilike('uuid_fiscal', uuid)
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (record) {
        if (tipo === 'gasto') {
          // Check if it was reconciled
          const { data: concs } = await supabaseAdmin
            .from('conciliaciones_bancarias')
            .select('movimiento_id')
            .eq('gasto_id', record.id)
            .eq('empresa_id', empresaId);

          if (concs && concs.length > 0) {
            const { data: pendienteStatus } = await supabaseAdmin
              .from('estatus_conciliacion_bancaria')
              .select('id')
              .eq('clave', 'pendiente')
              .maybeSingle();

            const movIds = concs.map(c => c.movimiento_id).filter(Boolean);
            if (movIds.length > 0 && pendienteStatus) {
              await supabaseAdmin
                .from('movimientos_bancarios')
                .update({ estatus_conciliacion_id: pendienteStatus.id })
                .in('id', movIds)
                .eq('empresa_id', empresaId);
            }

            await supabaseAdmin
              .from('conciliaciones_bancarias')
              .delete()
              .eq('gasto_id', record.id)
              .eq('empresa_id', empresaId);
          }

          // Update Gasto to cancelled status and zero amounts
          const { error: updErr } = await supabaseAdmin
            .from('gastos')
            .update({
              monto: 0,
              subtotal: 0,
              iva_acreditable: 0,
              estatus_factura_id: canceladoEstatusId,
              estatus_facturado: false,
              movimiento_bancario_id: null
            })
            .eq('id', record.id)
            .eq('empresa_id', empresaId);

          if (!updErr) actualizado = true;
        } else {
          // For sales (facturas_clientes)
          const { error: updErr } = await supabaseAdmin
            .from('facturas_clientes')
            .update({
              total: 0,
              subtotal: 0,
              iva_trasladado: 0,
              estatus_factura_id: canceladoEstatusId
            })
            .eq('id', record.id)
            .eq('empresa_id', empresaId);

          if (!updErr) actualizado = true;
        }
      }
    }

    return { success: true, estado, actualizado };
  } catch (err: any) {
    console.error('Error in consultarSatYActualizarCfdi:', err);
    return { success: false, estado: 'No Encontrado', actualizado: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 12. Vinculación Manual y Trayectoria de Pedidos (Ventas ↔ XML ↔ Conciliación)
// ---------------------------------------------------------------------------

export async function vincularFacturaAPedido(
  facturaId: string,
  pedidoId: string | string[],
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    const targetPedidoIds = Array.isArray(pedidoId) ? pedidoId : [pedidoId];
    if (targetPedidoIds.length === 0) throw new Error('Debes seleccionar al menos un pedido.');

    // 1. Obtener la factura de cliente
    const { data: factura, error: fErr } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*')
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .single();

    if (fErr || !factura) throw new Error('Factura de cliente no encontrada.');

    // 2. Obtener los pedidos objetivos
    const { data: pedidosList, error: pErr } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(rfc)')
      .in('id', targetPedidoIds)
      .eq('empresa_id', empresaId);

    if (pErr || !pedidosList || pedidosList.length === 0) throw new Error('Pedido(s) no encontrado(s).');

    // 3. Vincular la factura al primer pedido en la tabla facturas_clientes
    const primaryPedidoId = targetPedidoIds[0];
    const { error: updFErr } = await supabaseAdmin
      .from('facturas_clientes')
      .update({ pedido_id: primaryPedidoId })
      .eq('id', facturaId)
      .eq('empresa_id', empresaId);

    if (updFErr) throw updFErr;

    // 4. Sincronizar el folio de factura en TODOS los pedidos seleccionados
    const folioStr = factura.serie_folio || (factura.uuid_fiscal ? `UUID:${factura.uuid_fiscal.substring(0, 8)}` : '');
    if (folioStr) {
      await supabaseAdmin
        .from('pedidos')
        .update({ folio_factura: folioStr })
        .in('id', targetPedidoIds)
        .eq('empresa_id', empresaId);
    }

    // 5. Si alguno de los pedidos ya tiene un movimiento bancario conciliado, sincronizar los documentos XML/PDF al movimiento bancario
    const xmlToSet = factura.xml_url || null;
    const pdfToSet = factura.pdf_url || null;
    const ticketToSet = factura.ticket_url || null;

    for (const p of pedidosList) {
      if (p.movimiento_bancario_id) {
        await supabaseAdmin
          .from('movimientos_bancarios')
          .update({
            ...(xmlToSet ? { xml_url: xmlToSet } : {}),
            ...(pdfToSet ? { pdf_url: pdfToSet } : {}),
            ...(ticketToSet ? { pdf_ticket_url: ticketToSet } : {})
          })
          .eq('id', p.movimiento_bancario_id)
          .eq('empresa_id', empresaId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al vincular factura a pedido(s):', err);
    return { success: false, error: err.message || 'Error al vincular factura.' };
  }
}

export async function desvincularFacturaDePedido(
  facturaId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    // 1. Obtener la factura para saber cuál pedido tenía
    const { data: factura } = await supabaseAdmin
      .from('facturas_clientes')
      .select('pedido_id')
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .single();

    const previousPedidoId = factura?.pedido_id;

    // 2. Desvincular la factura
    const { error: updErr } = await supabaseAdmin
      .from('facturas_clientes')
      .update({ pedido_id: null })
      .eq('id', facturaId)
      .eq('empresa_id', empresaId);

    if (updErr) throw updErr;

    // 3. Si había un pedido vinculado, verificar si le quedan otras facturas
    if (previousPedidoId) {
      const { data: remaining } = await supabaseAdmin
        .from('facturas_clientes')
        .select('id, serie_folio, uuid_fiscal')
        .eq('pedido_id', previousPedidoId)
        .eq('empresa_id', empresaId);

      if (!remaining || remaining.length === 0) {
        await supabaseAdmin
          .from('pedidos')
          .update({ folio_factura: null })
          .eq('id', previousPedidoId)
          .eq('empresa_id', empresaId);
      } else {
        const nextFolio = remaining[0].serie_folio || `UUID:${remaining[0].uuid_fiscal?.substring(0, 8)}`;
        await supabaseAdmin
          .from('pedidos')
          .update({ folio_factura: nextFolio })
          .eq('id', previousPedidoId)
          .eq('empresa_id', empresaId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al desvincular factura de pedido:', err);
    return { success: false, error: err.message || 'Error al desvincular factura.' };
  }
}

export async function obtenerFacturasClientesSinVincular(
  token: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida.');

    const { data, error } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*, clientes(nombre_local, rfc, email_facturacion), estatus_factura(nombre)')
      .eq('empresa_id', empresaId)
      .is('pedido_id', null)
      .order('fecha_emision', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('Error al obtener facturas sin vincular:', err);
    return { success: false, error: err.message || 'Error al cargar facturas sin vincular.' };
  }
}

export async function obtenerTrayectoriaPedido(
  pedidoId: string,
  token: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida.');

    // 1. Pedido con cliente
    const { data: pedido, error: pErr } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(*), pedido_detalles(*, producto_variantes(*, productos(*)))')
      .eq('id', pedidoId)
      .eq('empresa_id', empresaId)
      .single();

    if (pErr || !pedido) throw new Error('Pedido no encontrado.');

    // 2. Facturas de clientes asociadas
    let { data: facturas } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*, estatus_factura(nombre), formas_pago(nombre, codigo)')
      .eq('pedido_id', pedidoId)
      .eq('empresa_id', empresaId);

    // Fallback: Si la factura fue vinculada a múltiples pedidos o mediante folio_factura
    if ((!facturas || facturas.length === 0) && pedido.folio_factura) {
      const folioClean = pedido.folio_factura.trim().toLowerCase();
      const { data: factByFolio } = await supabaseAdmin
        .from('facturas_clientes')
        .select('*, estatus_factura(nombre), formas_pago(nombre, codigo)')
        .eq('empresa_id', empresaId)
        .or(`serie_folio.ilike.%${folioClean}%,uuid_fiscal.ilike.%${folioClean}%`);

      if (factByFolio && factByFolio.length > 0) {
        facturas = factByFolio;
      }
    }

    // 3. Movimiento bancario (si existe)
    let movimientoBancario = null;
    let conciliacionEntry = null;

    if (pedido.movimiento_bancario_id) {
      const { data: mov } = await supabaseAdmin
        .from('movimientos_bancarios')
        .select('*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*)')
        .eq('id', pedido.movimiento_bancario_id)
        .eq('empresa_id', empresaId)
        .maybeSingle();

      movimientoBancario = mov;
    }

    // Buscar también en la tabla junction de conciliaciones_bancarias
    const { data: concJunction } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .select('*, movimientos_bancarios(*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*))')
      .eq('pedido_id', pedidoId)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (concJunction) {
      conciliacionEntry = concJunction;
      if (!movimientoBancario && concJunction.movimientos_bancarios) {
        movimientoBancario = concJunction.movimientos_bancarios;
      }
    }

    return {
      success: true,
      data: {
        pedido,
        facturas: facturas || [],
        movimientoBancario,
        conciliacionEntry
      }
    };
  } catch (err: any) {
    console.error('Error al obtener trayectoria del pedido:', err);
    return { success: false, error: err.message || 'Error al obtener la trayectoria.' };
  }
}

export async function crearPedidoDesdeFactura(
  facturaId: string,
  token: string
): Promise<{ success: boolean; pedido?: any; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    // 1. Obtener los datos de la factura
    const { data: factura, error: fErr } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*, clientes(id, nombre_local, rfc)')
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .single();

    if (fErr || !factura) throw new Error('Factura no encontrada.');

    // 2. Determinar el siguiente número de pedido disponible
    const { data: maxPed } = await supabaseAdmin
      .from('pedidos')
      .select('numero_pedido')
      .eq('empresa_id', empresaId)
      .order('numero_pedido', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumeroPedido = (maxPed?.numero_pedido ? Number(maxPed.numero_pedido) : 0) + 1;
    const clienteNombre = factura.clientes?.nombre_local || factura.razon_social_receptor || 'Público en General';
    const folioStr = factura.serie_folio || (factura.uuid_fiscal ? `UUID:${factura.uuid_fiscal.substring(0, 8)}` : `FAC-${nextNumeroPedido}`);

    // 3. Crear el nuevo registro en pedidos
    const { data: newPedido, error: pErr } = await supabaseAdmin
      .from('pedidos')
      .insert({
        empresa_id: empresaId,
        numero_pedido: nextNumeroPedido,
        cliente_id: factura.cliente_id || null,
        cliente_nombre: clienteNombre,
        precio_total: Number(factura.total || 0),
        costo_envio: 0,
        estatus_pago: 'Liquidado',
        folio_factura: folioStr,
        fecha_pedido: factura.fecha_emision || new Date().toISOString().split('T')[0],
        metodo_pago: factura.metodo_pago || '03',
        movimiento_bancario_id: factura.movimiento_bancario_id || null
      })
      .select('*, clientes(id, nombre_local, rfc)')
      .single();

    if (pErr || !newPedido) throw new Error(pErr?.message || 'Error al crear el pedido.');

    // 4. Vincular la factura al nuevo pedido creado
    await supabaseAdmin
      .from('facturas_clientes')
      .update({ pedido_id: newPedido.id })
      .eq('id', facturaId)
      .eq('empresa_id', empresaId);

    // 5. Si la factura tiene un movimiento bancario, asociarle los documentos XML/PDF
    if (factura.movimiento_bancario_id) {
      await supabaseAdmin
        .from('movimientos_bancarios')
        .update({
          ...(factura.xml_url ? { xml_url: factura.xml_url } : {}),
          ...(factura.pdf_url ? { pdf_url: factura.pdf_url } : {})
        })
        .eq('id', factura.movimiento_bancario_id)
        .eq('empresa_id', empresaId);
    }

    return { success: true, pedido: newPedido };
  } catch (err: any) {
    console.error('Error al crear pedido desde factura:', err);
    return { success: false, error: err.message || 'Error al generar el pedido.' };
  }
}

/**
 * Vincula una factura emitida a un cliente buscado o creado a partir de su RFC.
 */
export async function vincularFacturaClientePorRfc(
  facturaId: string,
  rfc: string,
  token: string,
  nombreSugerido?: string
): Promise<{ success: boolean; cliente?: any; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    const cleanRfc = (rfc || '').trim().toUpperCase();
    if (!cleanRfc) throw new Error('El RFC es requerido.');

    // 1. Buscar cliente por RFC en la empresa
    let { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, nombre_local, razon_social, rfc')
      .eq('empresa_id', empresaId)
      .eq('rfc', cleanRfc)
      .maybeSingle();

    // 2. Si no existe, crearlo
    if (!cliente) {
      const nombreNuevo = (nombreSugerido || '').trim() || `CLIENTE ${cleanRfc}`;
      const { data: newCli, error: insErr } = await supabaseAdmin
        .from('clientes')
        .insert({
          empresa_id: empresaId,
          rfc: cleanRfc,
          nombre_local: nombreNuevo,
          razon_social: nombreNuevo,
          es_anonimo: false
        })
        .select('id, nombre_local, razon_social, rfc')
        .single();

      if (insErr || !newCli) {
        throw new Error(`Error al crear cliente con RFC ${cleanRfc}: ${insErr?.message}`);
      }
      cliente = newCli;
    }

    // 3. Actualizar la factura
    const { error: upErr } = await supabaseAdmin
      .from('facturas_clientes')
      .update({ cliente_id: cliente.id })
      .eq('id', facturaId)
      .eq('empresa_id', empresaId);

    if (upErr) throw upErr;

    return { success: true, cliente };
  } catch (err: any) {
    console.error('Error al vincular cliente por RFC:', err);
    return { success: false, error: err.message || 'Error al vincular el cliente.' };
  }
}

/**
 * Escanea facturas emitidas de la empresa sin cliente asignado y las vincula
 * automáticamente al cliente correspondiente con base en el RFC receptor del XML.
 */
export async function autoVincularFacturasEmitidasPorRfc(
  token: string
): Promise<{ success: boolean; vinculadasCount: number; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    // 1. Obtener facturas de la empresa que no tengan cliente asignado
    const { data: facturas, error: fcErr } = await supabaseAdmin
      .from('facturas_clientes')
      .select('id, xml_url, cliente_id')
      .eq('empresa_id', empresaId);

    if (fcErr) throw fcErr;
    if (!facturas || facturas.length === 0) {
      return { success: true, vinculadasCount: 0 };
    }

    // 2. Cargar todos los clientes de la empresa
    const { data: clientes } = await supabaseAdmin
      .from('clientes')
      .select('id, rfc, nombre_local')
      .eq('empresa_id', empresaId);

    const clientByRfc = new Map<string, any>();
    (clientes || []).forEach((c: any) => {
      if (c.rfc) clientByRfc.set(c.rfc.trim().toUpperCase(), c);
    });

    let vinculadasCount = 0;

    for (const f of facturas) {
      if (!f.cliente_id && f.xml_url) {
        try {
          const { data: fileData } = await supabaseAdmin.storage.from('facturas').download(f.xml_url);
          if (fileData) {
            const xmlText = await fileData.text();
            const receptorMatch = xmlText.match(/<cfdi:Receptor[^>]+Rfc="([^"]+)"/i) ||
                                  xmlText.match(/<Receptor[^>]+Rfc="([^"]+)"/i) ||
                                  xmlText.match(/rfc="([^"]+)"/i);
            const rfcReceptor = receptorMatch ? receptorMatch[1].trim().toUpperCase() : null;

            if (rfcReceptor) {
              let matchedCli = clientByRfc.get(rfcReceptor);
              if (!matchedCli) {
                const nameMatch = xmlText.match(/<cfdi:Receptor[^>]+Nombre="([^"]+)"/i) ||
                                  xmlText.match(/<Receptor[^>]+Nombre="([^"]+)"/i);
                const nombreReceptor = nameMatch ? nameMatch[1].trim() : `CLIENTE ${rfcReceptor}`;
                const { data: newC } = await supabaseAdmin
                  .from('clientes')
                  .insert({
                    empresa_id: empresaId,
                    rfc: rfcReceptor,
                    nombre_local: nombreReceptor,
                    razon_social: nombreReceptor,
                    es_anonimo: false
                  })
                  .select('id, rfc, nombre_local')
                  .single();

                if (newC) {
                  matchedCli = newC;
                  clientByRfc.set(rfcReceptor, newC);
                }
              }

              if (matchedCli) {
                await supabaseAdmin
                  .from('facturas_clientes')
                  .update({ cliente_id: matchedCli.id })
                  .eq('id', f.id);
                vinculadasCount++;
              }
            }
          }
        } catch (xmlErr) {
          console.warn(`No se pudo procesar XML de factura ${f.id}:`, xmlErr);
        }
      }
    }

    return { success: true, vinculadasCount };
  } catch (err: any) {
    console.error('Error en autoVincularFacturasEmitidasPorRfc:', err);
    return { success: false, vinculadasCount: 0, error: err.message || 'Error al auto-vincular facturas.' };
  }
}

/**
 * Sincroniza automáticamente cualquier XML de CFDI emitido por la empresa activa
 * que haya sido adjuntado a movimientos bancarios (depósitos de ingresos),
 * asegurando que quede registrado en facturas_clientes y ligado a su cliente por RFC.
 */
export async function sincronizarFacturasEmitidasDesdeDepositos(
  token: string
): Promise<{ success: boolean; insertadasCount: number; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    // 1. Obtener RFC de la empresa activa
    const { data: empData } = await supabaseAdmin
      .from('empresas')
      .select('rfc')
      .eq('id', empresaId)
      .maybeSingle();

    const empresaRfc = (empData?.rfc || '').trim().toUpperCase();
    if (!empresaRfc) return { success: true, insertadasCount: 0 };

    // 2. Obtener movimientos bancarios de tipo depósito con xml_url
    const { data: movs, error: movErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('id, concepto, monto, deposito, xml_url, pdf_factura_url, fecha')
      .eq('empresa_id', empresaId)
      .eq('tipo_movimiento', 'Deposito')
      .not('xml_url', 'is', null);

    if (movErr) throw movErr;
    if (!movs || movs.length === 0) return { success: true, insertadasCount: 0 };

    // 3. Catálogos auxiliares
    const { data: estatusList } = await supabaseAdmin.from('estatus_factura').select('id, nombre');
    const facturadoEstatus = (estatusList || []).find((e: any) => e.nombre?.toLowerCase() === 'facturado') || estatusList?.[0];
    const { data: formasPagoList } = await supabaseAdmin.from('formas_pago').select('id, codigo');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

    let insertadasCount = 0;

    for (const m of movs) {
      const xmlPaths = (m.xml_url || '').split(',').filter(Boolean);
      const pdfPaths = (m.pdf_factura_url || '').split(',').filter(Boolean);

      for (let i = 0; i < xmlPaths.length; i++) {
        const path = xmlPaths[i];
        const pdfPath = pdfPaths[i] || pdfPaths[0] || null;

        try {
          const { data: fileData, error: dlErr } = await supabaseAdmin.storage.from('facturas').download(path);
          if (dlErr || !fileData) continue;

          const xmlText = await fileData.text();
          const jsonObj = parser.parse(xmlText);
          const cfdi = jsonObj['cfdi:Comprobante'] || jsonObj['Comprobante'];
          if (!cfdi) continue;

          const timbre = cfdi?.['cfdi:Complemento']?.['tfd:TimbreFiscalDigital'] || cfdi?.['Complemento']?.['tfd:TimbreFiscalDigital'];
          const uuid = (timbre?.['@_UUID'] || timbre?.['@_uuid'] || '').trim();
          if (!uuid) continue;

          const emisor = cfdi?.['cfdi:Emisor'] || cfdi?.['Emisor'];
          const emisorRfc = (emisor?.['@_Rfc'] || emisor?.['@_rfc'] || '').trim().toUpperCase();

          // Validar que el CFDI sea emitido por esta empresa
          if (emisorRfc !== empresaRfc) continue;

          // Verificar si ya existe en facturas_clientes
          const { data: existingFc } = await supabaseAdmin
            .from('facturas_clientes')
            .select('id')
            .eq('uuid_fiscal', uuid.toLowerCase())
            .maybeSingle();

          if (existingFc) continue;

          const receptor = cfdi?.['cfdi:Receptor'] || cfdi?.['Receptor'];
          const receptorRfc = (receptor?.['@_Rfc'] || receptor?.['@_rfc'] || '').trim().toUpperCase();
          const receptorNombre = (receptor?.['@_Nombre'] || receptor?.['@_nombre'] || '').trim();

          // Buscar o crear cliente por RFC receptor
          let clienteId = null;
          if (receptorRfc) {
            let { data: cli } = await supabaseAdmin
              .from('clientes')
              .select('id')
              .eq('rfc', receptorRfc)
              .eq('empresa_id', empresaId)
              .maybeSingle();

            if (!cli) {
              const nombreCli = receptorNombre || `CLIENTE ${receptorRfc}`;
              const { data: newCli } = await supabaseAdmin
                .from('clientes')
                .insert({
                  rfc: receptorRfc,
                  nombre_local: nombreCli,
                  razon_social: nombreCli,
                  empresa_id: empresaId,
                  es_anonimo: false
                })
                .select('id')
                .single();
              cli = newCli;
            }
            clienteId = cli?.id || null;
          }

          const total = parseFloat(cfdi['@_Total'] || cfdi['@_total'] || '0');
          const subtotal = parseFloat(cfdi['@_SubTotal'] || cfdi['@_subtotal'] || '0') || total;
          const fechaRaw = cfdi['@_Fecha'] || cfdi['@_fecha'] || '';
          const fechaEmision = fechaRaw ? fechaRaw.split('T')[0] : m.fecha;
          const fechaTimbrado = timbre?.['@_FechaTimbrado'] || timbre?.['@_fechaTimbrado'] || null;
          const serie = (cfdi['@_Serie'] || cfdi['@_serie'] || '').trim();
          const folio = (cfdi['@_Folio'] || cfdi['@_folio'] || '').trim();
          const folioStr = folio ? (serie + folio) : (serie || (cfdi['@_TipoDeComprobante'] === 'I' ? 'FAC' : 'CFDI'));
          const formaPagoCode = (cfdi['@_FormaPago'] || cfdi['@_formaPago'] || '').trim();
          const fpMatch = (formasPagoList || []).find((f: any) => f.codigo === formaPagoCode);
          const usoCfdi = (receptor?.['@_UsoCFDI'] || receptor?.['@_usoCFDI'] || 'G03').trim();

          // Calcular IVA
          let iva = 0;
          const imp = cfdi['cfdi:Impuestos'] || cfdi['Impuestos'];
          const tras = imp?.['cfdi:Traslados']?.['cfdi:Traslado'] || imp?.['Traslados']?.['Traslado'];
          if (tras) {
            const trasArr = Array.isArray(tras) ? tras : [tras];
            for (const t of trasArr) {
              if (t['@_Impuesto'] === '002') iva += parseFloat(t['@_Importe'] || '0');
            }
          }

          const { error: insErr } = await supabaseAdmin
            .from('facturas_clientes')
            .insert({
              empresa_id: empresaId,
              cliente_id: clienteId,
              uuid_fiscal: uuid.toLowerCase(),
              serie_folio: folioStr,
              total: total,
              subtotal: subtotal,
              iva_trasladado: iva,
              fecha_emision: fechaEmision,
              fecha_timbrado: fechaTimbrado,
              forma_pago_id: fpMatch ? fpMatch.id : null,
              estatus_factura_id: facturadoEstatus?.id || null,
              uso_cfdi_clave: usoCfdi,
              xml_url: path,
              pdf_url: pdfPath
            });

          if (!insErr) insertadasCount++;
        } catch (subErr) {
          console.warn(`Error procesando XML de depósito ${path}:`, subErr);
        }
      }
    }

    return { success: true, insertadasCount };
  } catch (err: any) {
    console.error('Error en sincronizarFacturasEmitidasDesdeDepositos:', err);
    return { success: false, insertadasCount: 0, error: err.message || 'Error al sincronizar facturas emitidas.' };
  }
}


