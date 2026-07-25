'use server';

import {
  supabaseAdmin,
  getUserEmpresaId,
  getFormaPagoIdByCode,
  getEstatusFacturaIdByName
} from '../../../lib/supabaseAdmin';

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
    if (error) throw error;
    return { success: true, url: data.signedUrl };
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error al generar enlace de descarga' };
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
    const message = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return { success: false, error: message || 'Error en el envío de correo' };
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
  pedidoId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('Sesión no válida o empresa no especificada.');

    // 1. Obtener la factura de cliente
    const { data: factura, error: fErr } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*')
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .single();

    if (fErr || !factura) throw new Error('Factura de cliente no encontrada.');

    // 2. Obtener el pedido objetivo
    const { data: pedido, error: pErr } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(rfc)')
      .eq('id', pedidoId)
      .eq('empresa_id', empresaId)
      .single();

    if (pErr || !pedido) throw new Error('Pedido no encontrado.');

    // 3. Vincular la factura al pedido
    const { error: updFErr } = await supabaseAdmin
      .from('facturas_clientes')
      .update({ pedido_id: pedidoId })
      .eq('id', facturaId)
      .eq('empresa_id', empresaId);

    if (updFErr) throw updFErr;

    // 4. Sincronizar el folio de factura en el pedido
    const folioStr = factura.serie_folio || (factura.uuid_fiscal ? `UUID:${factura.uuid_fiscal.substring(0, 8)}` : '');
    if (folioStr) {
      await supabaseAdmin
        .from('pedidos')
        .update({ folio_factura: folioStr })
        .eq('id', pedidoId)
        .eq('empresa_id', empresaId);
    }

    // 5. Si el pedido ya tiene un movimiento bancario conciliado, sincronizar los documentos XML/PDF al movimiento bancario
    if (pedido.movimiento_bancario_id) {
      const xmlToSet = factura.xml_url || null;
      const pdfToSet = factura.pdf_url || null;
      const ticketToSet = factura.ticket_url || null;

      await supabaseAdmin
        .from('movimientos_bancarios')
        .update({
          ...(xmlToSet ? { xml_url: xmlToSet } : {}),
          ...(pdfToSet ? { pdf_factura_url: pdfToSet } : {}),
          ...(ticketToSet ? { pdf_ticket_url: ticketToSet } : {}),
          visible_ingresos: true
        })
        .eq('id', pedido.movimiento_bancario_id)
        .eq('empresa_id', empresaId);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al vincular factura a pedido:', err);
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
    const { data: facturas } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*, estatus_factura(nombre), formas_pago(nombre, codigo)')
      .eq('pedido_id', pedidoId)
      .eq('empresa_id', empresaId);

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

