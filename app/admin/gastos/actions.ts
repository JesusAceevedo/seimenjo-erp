'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Helper to validate user token and return company ID and user ID
async function getUserEmpresaId(token: string): Promise<{ empresaId: string; userId: string }> {
  if (!token) throw new Error('Usuario no autenticado (Token no proporcionado).');
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) throw new Error('Sesión de usuario inválida o expirada.');

  const { data: staff, error: staffErr } = await supabaseAdmin
    .from('usuarios_staff')
    .select('empresa_id')
    .eq('supabase_auth_id', user.id)
    .single();

  if (staffErr || !staff) throw new Error('No se encontró el perfil de staff asociado a tu cuenta.');
  return { empresaId: staff.empresa_id, userId: user.id };
}

// Helper to map SAT payment codes to DB names
async function getFormaPagoIdByCode(code: string): Promise<number | null> {
  try {
    const { data } = await supabaseAdmin.from('formas_pago').select('id, nombre');
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
async function getEstatusFacturaIdByName(name = 'Facturado'): Promise<number | null> {
  try {
    const { data } = await supabaseAdmin.from('estatus_factura').select('id').ilike('nombre', name).maybeSingle();
    if (data) return data.id;
    const { data: first } = await supabaseAdmin.from('estatus_factura').select('id').limit(1).maybeSingle();
    return first ? first.id : null;
  } catch (err: unknown) {
    console.error('Error fetching EstatusFactura:', err);
    return null;
  }
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
        .eq('uuid_fiscal', xmlData.uuid)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (duplicateGasto) {
        throw new Error(`Esta factura ya está registrada en el Gasto: "${duplicateGasto.concepto}" (Monto: $${duplicateGasto.monto}, Fecha: ${duplicateGasto.fecha_gasto}).`);
      }
    } else {
      const { data: duplicateVenta } = await supabaseAdmin
        .from('facturas_clientes')
        .select('id, total, pedido_id, fecha_emision')
        .eq('uuid_fiscal', xmlData.uuid)
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
              uuid_fiscal: xmlData.uuid,
              fecha_timbrado: xmlData.fechaTimbrado || null,
              xml_url: xmlUrl,
              pdf_url: pdfUrl,
              ticket_url: ticketUrl || null,
              proveedor_id: proveedorId || parentGasto.proveedor_id,
              categoria_id: parentGasto.categoria_id,
              forma_pago_id: formaPagoId,
              estatus_factura_id: estatusFacturaId,
              estatus_facturado: true,
              metodo_pago: xmlData.formaPagoCode === '01' ? 'Efectivo' : 'Transferencia',
              gasto_padre_id: parentGasto.id,
              movimiento_bancario_id: parentGasto.movimiento_bancario_id,
              empresa_id: empresaId
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
            uuid_fiscal: xmlData.uuid,
            fecha_timbrado: xmlData.fechaTimbrado || null,
            xml_url: xmlUrl,
            pdf_url: pdfUrl,
            ticket_url: ticketUrl || null,
            proveedor_id: proveedorId,
            forma_pago_id: formaPagoId,
            estatus_factura_id: estatusFacturaId,
            estatus_facturado: true,
            metodo_pago: xmlData.formaPagoCode === '01' ? 'Efectivo' : 'Transferencia',
            empresa_id: empresaId
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
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

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
                folio_factura: `${xmlData.serie || ''}${xmlData.folio || ''}`.trim() || 'FACTURADO',
                estatus_pago: 'Liquidado'
              })
              .eq('id', matchedPedidoId)
              .eq('empresa_id', empresaId);
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

