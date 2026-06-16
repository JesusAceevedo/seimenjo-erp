'use server';

import { supabase } from '../../../lib/supabase';

// Helper to map SAT payment codes to DB names
async function getFormaPagoIdByCode(code: string) {
  try {
    const { data } = await supabase.from('formas_pago').select('id, nombre');
    if (!data || data.length === 0) return null;
    
    let term = 'Efectivo';
    if (code === '03') term = 'Transferencia';
    else if (code === '04' || code === '28') term = 'Tarjeta';
    else if (code === '02') term = 'Cheque';
    
    const match = data.find(f => f.nombre.toLowerCase().includes(term.toLowerCase()));
    return match ? match.id : data[0].id;
  } catch (err) {
    console.error('Error auto-mapping FormaPago:', err);
    return null;
  }
}

// Helper to get status id by name
async function getEstatusFacturaIdByName(name = 'Facturado') {
  try {
    const { data } = await supabase.from('estatus_factura').select('id').ilike('nombre', name).maybeSingle();
    if (data) return data.id;
    const { data: first } = await supabase.from('estatus_factura').select('id').limit(1).maybeSingle();
    return first ? first.id : null;
  } catch (err) {
    console.error('Error fetching EstatusFactura:', err);
    return null;
  }
}

// 1. Generate Signed URL for secure downloads
export async function obtenerSignedUrl(filePath: string) {
  try {
    const { data, error } = await supabase.storage.from('facturas').createSignedUrl(filePath, 900); // Valid for 15 minutes
    if (error) throw error;
    return { success: true, url: data.signedUrl };
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    return { success: false, error: err.message || 'Error al generar enlace de descarga' };
  }
}

// 2. Simulated Mailer for customer invoices
export async function enviarFacturaPorCorreo(pedidoId: string) {
  try {
    // 1. Get Pedido & Cliente details
    const { data: pedido, error: pedErr } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, precio_total, cliente_id')
      .eq('id', pedidoId)
      .single();
    if (pedErr || !pedido) throw new Error('Pedido no encontrado');

    const { data: cliente, error: cliErr } = await supabase
      .from('clientes')
      .select('nombre_local, email_facturacion')
      .eq('id', pedido.cliente_id)
      .single();
    if (cliErr || !cliente) throw new Error('Cliente no encontrado');

    if (!cliente.email_facturacion) {
      throw new Error(`El cliente ${cliente.nombre_local} no tiene registrado correo de facturación.`);
    }

    // 2. Get Factura files
    const { data: factura, error: facErr } = await supabase
      .from('facturas_clientes')
      .select('xml_url, pdf_url, uuid_fiscal')
      .eq('pedido_id', pedidoId)
      .maybeSingle();

    if (facErr || !factura) {
      throw new Error('No se encontró factura emitida para este pedido.');
    }

    // 3. Generate signed links for the mail
    const [xmlLink, pdfLink] = await Promise.all([
      factura.xml_url ? supabase.storage.from('facturas').createSignedUrl(factura.xml_url, 86400 * 3) : Promise.resolve({ data: null }), // 3 days
      factura.pdf_url ? supabase.storage.from('facturas').createSignedUrl(factura.pdf_url, 86400 * 3) : Promise.resolve({ data: null })
    ]);

    const xmlUrl = xmlLink.data?.signedUrl || null;
    const pdfUrl = pdfLink.data?.signedUrl || null;

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
    console.error('Error simulating invoice email:', err);
    return { success: false, error: err.message || 'Error en el envío de correo' };
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
  };
  xmlUrl: string;
  pdfUrl: string;
}) {
  try {
    const { isGasto, asociarExistente, existenteId, xmlData, xmlUrl, pdfUrl } = payload;

    const formaPagoId = await getFormaPagoIdByCode(xmlData.formaPagoCode);
    const estatusFacturaId = await getEstatusFacturaIdByName('Facturado');

    if (isGasto) {
      // --- REGISTRO DE GASTO (PROVEEDOR) ---
      if (asociarExistente && existenteId) {
        // CAMINO 1: Asociar a Gasto existente (UPDATE)
        const { data: gasto, error: gastoErr } = await supabase
          .from('gastos')
          .select('monto')
          .eq('id', existenteId)
          .single();
        if (gastoErr || !gasto) throw new Error('No se encontró el gasto a asociar.');
        if (Math.abs(Number(gasto.monto) - Number(xmlData.total)) > 0.01) {
          throw new Error(`El importe del gasto ($${Number(gasto.monto).toFixed(2)}) no coincide con el total de la factura ($${Number(xmlData.total).toFixed(2)}).`);
        }

        const { data, error } = await supabase
          .from('gastos')
          .update({
            uuid_fiscal: xmlData.uuid,
            subtotal: xmlData.subtotal,
            iva_acreditable: xmlData.iva,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            forma_pago_id: formaPagoId,
            estatus_factura_id: estatusFacturaId,
            estatus_facturado: true
          })
          .eq('id', existenteId)
          .select();
        
        if (error) throw error;
        return { success: true, mode: 'association', data };
      } else {
        // CAMINO 2: Gasto suelto (INSERT)
        // 1. Match/Create Proveedor by RFC
        let proveedorId = null;
        if (xmlData.emisorRfc) {
          const { data: prov } = await supabase
            .from('proveedores')
            .select('id')
            .eq('rfc', xmlData.emisorRfc.toUpperCase())
            .maybeSingle();
          
          if (prov) {
            proveedorId = prov.id;
          } else {
            const { data: newProv, error: errP } = await supabase
              .from('proveedores')
              .insert({
                rfc: xmlData.emisorRfc.toUpperCase(),
                nombre_comercial: xmlData.emisorNombre || xmlData.emisorRfc,
                razon_social: xmlData.emisorNombre || xmlData.emisorRfc
              })
              .select('id')
              .single();
            if (errP) throw errP;
            proveedorId = newProv.id;
          }
        }

        // 2. Insert Gasto
        const { data, error } = await supabase
          .from('gastos')
          .insert({
            fecha_gasto: xmlData.fecha ? xmlData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
            concepto: `Gasto por factura XML (UUID: ${xmlData.uuid.substring(0, 8)})`,
            monto: xmlData.total,
            subtotal: xmlData.subtotal,
            iva_acreditable: xmlData.iva,
            uuid_fiscal: xmlData.uuid,
            fecha_timbrado: xmlData.fechaTimbrado || null,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            proveedor_id: proveedorId,
            forma_pago_id: formaPagoId,
            estatus_factura_id: estatusFacturaId,
            estatus_facturado: true,
            metodo_pago: xmlData.formaPagoCode === '01' ? 'Efectivo' : 'Transferencia'
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
        const { data: cli } = await supabase
          .from('clientes')
          .select('id')
          .eq('rfc', xmlData.receptorRfc.toUpperCase())
          .maybeSingle();
        
        if (cli) {
          clienteId = cli.id;
        } else {
          const { data: newCli, error: errC } = await supabase
            .from('clientes')
            .insert({
              rfc: xmlData.receptorRfc.toUpperCase(),
              nombre_local: xmlData.receptorNombre || xmlData.receptorRfc,
              razon_social: xmlData.receptorNombre || xmlData.receptorRfc
            })
            .select('id')
            .single();
          if (errC) throw errC;
          clienteId = newCli.id;
        }
      }

      if (asociarExistente && existenteId) {
        // CAMINO 1: Asociar a Pedido existente (INSERT factura + UPDATE pedido)
        const { data: pedido, error: pedErr } = await supabase
          .from('pedidos')
          .select('precio_total')
          .eq('id', existenteId)
          .single();
        if (pedErr || !pedido) throw new Error('No se encontró el pedido a asociar.');
        if (Math.abs(Number(pedido.precio_total) - Number(xmlData.total)) > 0.01) {
          throw new Error(`El importe del pedido ($${Number(pedido.precio_total).toFixed(2)}) no coincide con el total de la factura ($${Number(xmlData.total).toFixed(2)}).`);
        }

        // 1. Insert Client Invoice
        const { data, error } = await supabase
          .from('facturas_clientes')
          .insert({
            pedido_id: existenteId,
            cliente_id: clienteId,
            uuid_fiscal: xmlData.uuid,
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
            uso_cfdi_clave: xmlData.usoCfdi || 'G03'
          })
          .select();
        
        if (error) throw error;

        // 2. Update Pedido status
        const { error: pedError } = await supabase
          .from('pedidos')
          .update({
            folio_factura: `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || 'FACTURADO',
            estatus_pago: 'Liquidado'
          })
          .eq('id', existenteId);
        
        if (pedError) console.error('Error updating associated pedido status:', pedError);

        return { success: true, mode: 'association', data };
      } else {
        // CAMINO 2: Subida suelta (INSERT factura + CONCILIACIÓN AUTOMÁTICA)
        // 1. Insert standalone Client Invoice
        const { data, error } = await supabase
          .from('facturas_clientes')
          .insert({
            cliente_id: clienteId,
            uuid_fiscal: xmlData.uuid,
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
            uso_cfdi_clave: xmlData.usoCfdi || 'G03'
          })
          .select('id')
          .single();

        if (error) throw error;

        // 2. Conciliación Inteligente: Look for an un-invoiced, un-liquidated order with same total & client
        let matchedPedidoId = null;
        if (clienteId) {
          const { data: matchedP } = await supabase
            .from('pedidos')
            .select('id, numero_pedido')
            .eq('cliente_id', clienteId)
            .eq('precio_total', xmlData.total)
            .neq('estatus_pago', 'Liquidado')
            .is('folio_factura', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (matchedP) {
            matchedPedidoId = matchedP.id;
            console.log(`Auto-conciliated: matched Invoice with Pedido #${matchedP.numero_pedido}`);
            
            // Link invoice to this pedido
            await supabase
              .from('facturas_clientes')
              .update({ pedido_id: matchedPedidoId })
              .eq('id', data.id);

            // Mark order as invoiced & paid
            await supabase
              .from('pedidos')
              .update({
                folio_factura: `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || 'FACTURADO',
                estatus_pago: 'Liquidado'
              })
              .eq('id', matchedPedidoId);
          }
        }

        return { success: true, mode: 'creation', autoMatched: !!matchedPedidoId, data };
      }
    }
  } catch (err: any) {
    console.error('Error saving invoice metadata:', err);
    return { success: false, error: err.message || 'Error al guardar metadatos en la base de datos' };
  }
}
