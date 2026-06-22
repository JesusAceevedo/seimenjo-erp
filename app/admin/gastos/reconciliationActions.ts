'use server';

import { supabaseAdmin, getUserEmpresaId } from '../../../lib/supabaseAdmin';

// Helper to extract RFC from bank description (SAT CFDI RFC Regex)
function extraerRfcDeConcepto(concepto: string): string | null {
  if (!concepto) return null;
  const regex = /RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i;
  const match = concepto.match(regex);
  return match ? match[1].toUpperCase() : null;
}

// Helper to check if concept indicates a Cash transaction
function esMovimientoEfectivo(concepto: string): boolean {
  if (!concepto) return false;
  const c = concepto.toUpperCase();
  return c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO');
}

// 1. IMPORTAR MOVIMIENTOS BANCARIOS DESDE EXCEL / CSV
export async function importarMovimientosBancarios(
  movements: {
    fecha: string;
    concepto: string;
    retiro?: number | string;
    deposito?: number | string;
    referencia?: string;
  }[],
  token: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // Get Pendiente status ID
    const { data: statusPendiente } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id')
      .eq('clave', 'pendiente')
      .single();

    const estatusId = statusPendiente?.id;

    const formattedMovements = movements.map((m) => {
      const r = Math.abs(Number(m.retiro) || 0);
      const d = Math.abs(Number(m.deposito) || 0);
      const montoVal = d - r;
      const tipo = d > 0 ? 'Deposito' : 'Retiro';
      const rfc = extraerRfcDeConcepto(m.concepto);

      // Parse date format DD-MM-YYYY, YYYY-MM-DD, or Excel serial number
      let fechaFormatted = m.fecha;
      if (m.fecha && /^\d+(\.\d+)?$/.test(m.fecha)) {
        const serial = parseFloat(m.fecha);
        const date = new Date((serial - 25569) * 86400 * 1000);
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        fechaFormatted = `${yyyy}-${mm}-${dd}`;
      } else if (m.fecha && m.fecha.includes('-')) {
        const parts = m.fecha.split('-');
        if (parts[2] && parts[2].length === 4) {
          fechaFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          const parsedDate = new Date(m.fecha);
          if (!isNaN(parsedDate.getTime())) {
            const yyyy = parsedDate.getFullYear();
            const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(parsedDate.getDate()).padStart(2, '0');
            fechaFormatted = `${yyyy}-${mm}-${dd}`;
          }
        }
      } else if (m.fecha && m.fecha.includes('/')) {
        const parts = m.fecha.split('/');
        if (parts[2] && parts[2].length === 4) {
          fechaFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          const parsedDate = new Date(m.fecha);
          if (!isNaN(parsedDate.getTime())) {
            const yyyy = parsedDate.getFullYear();
            const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(parsedDate.getDate()).padStart(2, '0');
            fechaFormatted = `${yyyy}-${mm}-${dd}`;
          }
        }
      } else if (m.fecha) {
        const parsedDate = new Date(m.fecha);
        if (!isNaN(parsedDate.getTime())) {
          const yyyy = parsedDate.getFullYear();
          const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const dd = String(parsedDate.getDate()).padStart(2, '0');
          fechaFormatted = `${yyyy}-${mm}-${dd}`;
        }
      }

      return {
        fecha: fechaFormatted,
        concepto: m.concepto,
        retiro: r,
        deposito: d,
        monto: montoVal,
        tipo_movimiento: tipo,
        referencia: m.referencia || null,
        estatus_conciliacion_id: estatusId,
        rfc_proveedor: rfc,
        empresa_id: empresaId,
        visible_egresos: false,
        visible_ingresos: false
      };
    });

    const { data, error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .insert(formattedMovements)
      .select('id');

    if (error) throw error;

    return { success: true, count: data?.length || 0 };
  } catch (err: any) {
    console.error('Error importing bank movements:', err);
    return { success: false, error: err.message || 'Error al importar movimientos' };
  }
}

// 2. TOGGLE VISIBILIDAD (CREA/DESTRUYE GASTO DE FORMA AUTOMÁTICA EN EGRESOS)
export async function toggleMovimientoVisibilidad(
  movimientoId: string,
  modulo: 'egresos' | 'ingresos',
  visible: boolean,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const field = modulo === 'egresos' ? 'visible_egresos' : 'visible_ingresos';
    
    // 1. Update movement visibility
    const { data: movement, error: updateErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({ [field]: visible })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    if (!movement) throw new Error('Movimiento no encontrado.');

    if (modulo === 'egresos') {
      if (visible) {
        // Create matching Gasto if not exists
        const { data: existingGasto } = await supabaseAdmin
          .from('gastos')
          .select('id')
          .eq('movimiento_bancario_id', movimientoId)
          .eq('empresa_id', empresaId)
          .maybeSingle();

        if (!existingGasto) {
          let metodoPago = 'Transferencia';
          if (esMovimientoEfectivo(movement.concepto)) {
            metodoPago = 'Efectivo';
          }

          const { error: insertGastoErr } = await supabaseAdmin.from('gastos').insert({
            fecha_gasto: movement.fecha,
            concepto: movement.concepto,
            monto: Math.abs(movement.monto),
            metodo_pago: metodoPago,
            movimiento_bancario_id: movimientoId,
            estatus_facturado: false,
            empresa_id: empresaId
          });

          if (insertGastoErr) throw insertGastoErr;
        }
      } else {
        // Hide/Delete associated Gasto
        const { error: deleteGastoErr } = await supabaseAdmin
          .from('gastos')
          .delete()
          .eq('movimiento_bancario_id', movimientoId)
          .eq('empresa_id', empresaId);

        if (deleteGastoErr) throw deleteGastoErr;

        // Delete any junction relationships
        await supabaseAdmin
          .from('conciliaciones_bancarias')
          .delete()
          .eq('movimiento_id', movimientoId)
          .eq('empresa_id', empresaId);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error toggling movement visibility:', err);
    return { success: false, error: err.message || 'Error al cambiar visibilidad' };
  }
}

// 3. CONCILIACIÓN INTELIGENTE / AUTOMÁTICA
export async function autoConciliarMovimientos(token: string): Promise<{ success: boolean; matchedCount: number; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // Get all reconciliation statuses
    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');

    const getStatusId = (clave: string) => catalog?.find((c) => c.clave === clave)?.id || null;

    const statusComprobado = getStatusId('comprobado');
    const statusIncompletoComprobado = getStatusId('incompleto_comprobado');
    const statusNoDeducible = getStatusId('no_deducible');

    // 1. Get bank movements for this company that are 'pendiente'
    const { data: movements, error: movsErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('estatus_conciliacion_id', getStatusId('pendiente'))
      .order('fecha', { ascending: true });

    if (movsErr) throw movsErr;
    if (!movements || movements.length === 0) {
      return { success: true, matchedCount: 0 };
    }

    // 2. Get unmatched Gastos (retiros)
    const { data: pendingGastos } = await supabaseAdmin
      .from('gastos')
      .select('*, proveedores(rfc)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null);

    // 3. Get unmatched Pedidos (depositos)
    const { data: pendingPedidos } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(rfc)')
      .eq('empresa_id', empresaId)
      .is('movimiento_bancario_id', null);

    let matchedCount = 0;

    for (const mov of movements) {
      const isCash = esMovimientoEfectivo(mov.concepto);
      const isRetiro = mov.tipo_movimiento === 'Retiro';
      const absMonto = Math.abs(mov.monto);

      if (isRetiro) {
        if (isCash) {
          const hasTicket = !!mov.pdf_ticket_url || !!mov.xml_url;
          const targetStatus = hasTicket ? statusComprobado : statusIncompletoComprobado;
          
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({
              estatus_conciliacion_id: targetStatus,
              visible_egresos: true
            })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);

          const { data: existingGasto } = await supabaseAdmin
            .from('gastos')
            .select('id')
            .eq('movimiento_bancario_id', mov.id)
            .eq('empresa_id', empresaId)
            .maybeSingle();

          if (!existingGasto) {
            await supabaseAdmin.from('gastos').insert({
              fecha_gasto: mov.fecha,
              concepto: mov.concepto,
              monto: absMonto,
              metodo_pago: 'Efectivo',
              movimiento_bancario_id: mov.id,
              estatus_facturado: hasTicket,
              empresa_id: empresaId
            });
          }

          matchedCount++;
          continue;
        }

        const matches = (pendingGastos || [])
          .filter((g) => {
            const sameAmount = Math.abs(Number(g.monto) - absMonto) < 0.05;
            if (!sameAmount) return false;

            const gDate = new Date(g.fecha_gasto || g.fecha || '');
            const mDate = new Date(mov.fecha);
            const validDate = gDate <= mDate;

            if (mov.rfc_proveedor && g.proveedores?.rfc) {
              const rfcMatch = mov.rfc_proveedor.toUpperCase() === g.proveedores.rfc.toUpperCase();
              return validDate && rfcMatch;
            }

            return validDate;
          })
          .sort((a, b) => {
            const diffA = new Date(mov.fecha).getTime() - new Date(a.fecha_gasto || a.fecha || '').getTime();
            const diffB = new Date(mov.fecha).getTime() - new Date(b.fecha_gasto || b.fecha || '').getTime();
            return diffA - diffB;
          });

        const bestMatch = matches[0];

        if (bestMatch) {
          await supabaseAdmin
            .from('gastos')
            .update({ movimiento_bancario_id: mov.id, estatus_facturado: true })
            .eq('id', bestMatch.id)
            .eq('empresa_id', empresaId);

          await supabaseAdmin.from('conciliaciones_bancarias').insert({
            movimiento_id: mov.id,
            gasto_id: bestMatch.id,
            monto_asociado: absMonto,
            empresa_id: empresaId
          });

          const hasInvoiceXml = !!bestMatch.xml_url || !!mov.xml_url;
          const hasInvoicePdf = !!bestMatch.pdf_url || !!mov.pdf_factura_url;
          const hasTicket = !!bestMatch.ticket_url || !!mov.pdf_ticket_url;

          const targetStatus = (hasInvoiceXml && hasInvoicePdf && hasTicket)
            ? statusComprobado
            : statusIncompletoComprobado;

          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({
              estatus_conciliacion_id: targetStatus,
              visible_egresos: true,
              xml_url: mov.xml_url || bestMatch.xml_url || null,
              pdf_factura_url: mov.pdf_factura_url || bestMatch.pdf_url || null,
              pdf_ticket_url: mov.pdf_ticket_url || bestMatch.ticket_url || null
            })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);

          if (pendingGastos) {
            const index = pendingGastos.indexOf(bestMatch);
            if (index > -1) pendingGastos.splice(index, 1);
          }

          matchedCount++;
        } else {
          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({ estatus_conciliacion_id: statusNoDeducible })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);
        }

      } else {
        const matches = (pendingPedidos || [])
          .filter((p) => {
            const sameAmount = Math.abs(Number(p.precio_total) - absMonto) < 0.05;
            if (!sameAmount) return false;

            const pDate = new Date(p.fecha_pedido || p.created_at || '');
            const mDate = new Date(mov.fecha);
            return pDate <= mDate;
          })
          .sort((a, b) => {
            const diffA = new Date(mov.fecha).getTime() - new Date(a.fecha_pedido || a.created_at || '').getTime();
            const diffB = new Date(mov.fecha).getTime() - new Date(b.fecha_pedido || b.created_at || '').getTime();
            return diffA - diffB;
          });

        const bestMatch = matches[0];

        if (bestMatch) {
          await supabaseAdmin
            .from('pedidos')
            .update({ movimiento_bancario_id: mov.id, estatus_pago: 'Liquidado' })
            .eq('id', bestMatch.id)
            .eq('empresa_id', empresaId);

          await supabaseAdmin.from('conciliaciones_bancarias').insert({
            movimiento_id: mov.id,
            pedido_id: bestMatch.id,
            monto_asociado: absMonto,
            empresa_id: empresaId
          });

          const { data: clientInvoice } = await supabaseAdmin
            .from('facturas_clientes')
            .select('xml_url, pdf_url, ticket_url')
            .eq('pedido_id', bestMatch.id)
            .eq('empresa_id', empresaId)
            .maybeSingle();

          await supabaseAdmin
            .from('movimientos_bancarios')
            .update({
              estatus_conciliacion_id: statusComprobado,
              visible_ingresos: true,
              xml_url: clientInvoice?.xml_url || null,
              pdf_factura_url: clientInvoice?.pdf_url || null,
              pdf_ticket_url: clientInvoice?.ticket_url || null
            })
            .eq('id', mov.id)
            .eq('empresa_id', empresaId);

          if (pendingPedidos) {
            const index = pendingPedidos.indexOf(bestMatch);
            if (index > -1) pendingPedidos.splice(index, 1);
          }

          matchedCount++;
        }
      }
    }

    return { success: true, matchedCount };
  } catch (err: any) {
    console.error('Error running auto reconciliation:', err);
    return { success: false, matchedCount: 0, error: err.message || 'Error al ejecutar conciliación automática' };
  }
}

// 4. CONCILIACIÓN MANUAL (SOPORTE UNO-A-MUCHOS, MUCHOS-A-UNO Y CARGA DE DOCUMENTOS DUAL)
export async function guardarConciliacionManual(
  movimientoId: string,
  payload: {
    gastosIds: string[];
    pedidosIds: string[];
    xmlUrl?: string | null;
    pdfFacturaUrl?: string | null;
    pdfTicketUrl?: string | null;
    storageProvider?: 'Supabase' | 'GoogleDrive';
    estatusClave?: string;
  },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: mov, error: movErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .select('*')
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId)
      .single();

    if (movErr || !mov) throw new Error('Movimiento no encontrado.');

    await supabaseAdmin
      .from('conciliaciones_bancarias')
      .delete()
      .eq('movimiento_id', movimientoId)
      .eq('empresa_id', empresaId);

    await supabaseAdmin
      .from('gastos')
      .update({ movimiento_bancario_id: null })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    await supabaseAdmin
      .from('pedidos')
      .update({ movimiento_bancario_id: null })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    let associatedXml = null;
    let associatedPdf = null;
    let associatedTicket = null;

    if (mov.tipo_movimiento === 'Retiro' && payload.gastosIds.length > 0) {
      const { error: linkErr } = await supabaseAdmin
        .from('gastos')
        .update({ movimiento_bancario_id: movimientoId, estatus_facturado: true })
        .in('id', payload.gastosIds)
        .eq('empresa_id', empresaId);

      if (linkErr) throw linkErr;

      const { data: gastosFiles } = await supabaseAdmin
        .from('gastos')
        .select('xml_url, pdf_url, ticket_url')
        .in('id', payload.gastosIds)
        .eq('empresa_id', empresaId);

      if (gastosFiles) {
        for (const g of gastosFiles) {
          if (!associatedXml && g.xml_url) associatedXml = g.xml_url;
          if (!associatedPdf && g.pdf_url) associatedPdf = g.pdf_url;
          if (!associatedTicket && g.ticket_url) associatedTicket = g.ticket_url;
        }
      }

      const junctionEntries = payload.gastosIds.map((gId) => {
        return {
          movimiento_id: movimientoId,
          gasto_id: gId,
          monto_asociado: Math.abs(mov.monto),
          empresa_id: empresaId
        };
      });

      const { error: jErr } = await supabaseAdmin.from('conciliaciones_bancarias').insert(junctionEntries);
      if (jErr) throw jErr;
    }

    if (mov.tipo_movimiento === 'Deposito' && payload.pedidosIds.length > 0) {
      const { error: linkErr } = await supabaseAdmin
        .from('pedidos')
        .update({ movimiento_bancario_id: movimientoId, estatus_pago: 'Liquidado' })
        .in('id', payload.pedidosIds)
        .eq('empresa_id', empresaId);

      if (linkErr) throw linkErr;

      const { data: pedidosFiles } = await supabaseAdmin
        .from('facturas_clientes')
        .select('xml_url, pdf_url, ticket_url')
        .in('pedido_id', payload.pedidosIds)
        .eq('empresa_id', empresaId);

      if (pedidosFiles) {
        for (const f of pedidosFiles) {
          if (!associatedXml && f.xml_url) associatedXml = f.xml_url;
          if (!associatedPdf && f.pdf_url) associatedPdf = f.pdf_url;
          if (!associatedTicket && f.ticket_url) associatedTicket = f.ticket_url;
        }
      }

      const junctionEntries = payload.pedidosIds.map((pId) => {
        return {
          movimiento_id: movimientoId,
          pedido_id: pId,
          monto_asociado: Math.abs(mov.monto),
          empresa_id: empresaId
        };
      });

      const { error: jErr } = await supabaseAdmin.from('conciliaciones_bancarias').insert(junctionEntries);
      if (jErr) throw jErr;
    }

    const { data: catalog } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('id, clave');

    const getStatusId = (clave: string) => catalog?.find((c) => c.clave === clave)?.id || null;

    let targetStatusClave = payload.estatusClave || 'pendiente';
    if (!payload.estatusClave) {
      const hasXml = !!payload.xmlUrl || !!mov.xml_url || !!associatedXml;
      const hasPdf = !!payload.pdfFacturaUrl || !!mov.pdf_factura_url || !!associatedPdf;
      const hasTicket = !!payload.pdfTicketUrl || !!mov.pdf_ticket_url || !!associatedTicket;
      const isCash = esMovimientoEfectivo(mov.concepto);

      if (isCash) {
        targetStatusClave = hasTicket ? 'comprobado' : 'incompleto_comprobado';
      } else {
        const hasInvoice = (mov.tipo_movimiento === 'Deposito') || (payload.gastosIds.length > 0);
        if (!hasInvoice) {
          targetStatusClave = 'no_deducible';
        } else if (hasXml && hasPdf && hasTicket) {
          targetStatusClave = 'comprobado';
        } else {
          targetStatusClave = 'incompleto_comprobado';
        }
      }
    }

    const targetStatusId = getStatusId(targetStatusClave);

    const updatePayload: any = {
      estatus_conciliacion_id: targetStatusId,
      visible_egresos: mov.tipo_movimiento === 'Retiro' && payload.gastosIds.length > 0,
      visible_ingresos: mov.tipo_movimiento === 'Deposito' && payload.pedidosIds.length > 0
    };

    updatePayload.xml_url = payload.xmlUrl || associatedXml || mov.xml_url || null;
    updatePayload.pdf_factura_url = payload.pdfFacturaUrl || associatedPdf || mov.pdf_factura_url || null;
    updatePayload.pdf_ticket_url = payload.pdfTicketUrl || associatedTicket || mov.pdf_ticket_url || null;
    if (payload.storageProvider !== undefined) updatePayload.storage_provider = payload.storageProvider;

    const { error: updateMovErr } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update(updatePayload)
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (updateMovErr) throw updateMovErr;

    return { success: true };
  } catch (err: any) {
    console.error('Error saving manual reconciliation:', err);
    return { success: false, error: err.message || 'Error al guardar conciliación manual' };
  }
}

// 5. OBTENER CATALOGO DE ESTATUS DE CONCILIACIÓN
export async function getEstatusCatalog(token: string): Promise<{ success: boolean; catalog?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data, error } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .select('*')
      .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
      .order('nombre', { ascending: true });

    if (error) throw error;
    return { success: true, catalog: data || [] };
  } catch (err: any) {
    console.error('Error getting status catalog:', err);
    return { success: false, error: err.message || 'Error al cargar catálogo de estatus' };
  }
}

// 6. ACTUALIZAR / CREAR ESTATUS EN EL CATALOGO (CATALOGO EXPANDIBLE Y ACTUALIZABLE)
export async function guardarEstatusCatalogItem(
  payload: {
    id?: string;
    clave: string;
    nombre: string;
    descripcion?: string;
    color: string;
  },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    if (payload.id) {
      const { error } = await supabaseAdmin
        .from('estatus_conciliacion_bancaria')
        .update({
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          color: payload.color
        })
        .eq('id', payload.id)
        .eq('empresa_id', empresaId);

      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('estatus_conciliacion_bancaria')
        .insert({
          clave: payload.clave.toLowerCase().replace(/\s+/g, '_'),
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          color: payload.color,
          empresa_id: empresaId
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving status catalog item:', err);
    return { success: false, error: err.message || 'Error al guardar estatus del catálogo' };
  }
}

// 7. ELIMINAR ESTATUS PERSONALIZADO DEL CATALOGO
export async function eliminarEstatusCatalogItem(id: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { error } = await supabaseAdmin
      .from('estatus_conciliacion_bancaria')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .not('empresa_id', 'is', null);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting status catalog item:', err);
    return { success: false, error: err.message || 'Error al eliminar estatus' };
  }
}

// 8. ELIMINAR MOVIMIENTO BANCARIO (solo si NO está conciliado)
export async function eliminarMovimientoBancario(movimientoId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: conciliacion } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .select('id')
      .eq('movimiento_id', movimientoId)
      .eq('empresa_id', empresaId)
      .limit(1)
      .maybeSingle();

    if (conciliacion) {
      throw new Error('No se puede eliminar un movimiento bancario que ya se encuentra conciliado.');
    }

    await supabaseAdmin
      .from('gastos')
      .delete()
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    const { error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .delete()
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting bank movement:', err);
    return { success: false, error: err.message || 'Error al eliminar el movimiento bancario' };
  }
}

// 9. EDITAR MOVIMIENTO BANCARIO (solo si NO está conciliado)
export async function editarMovimientoBancario(
  movimientoId: string,
  updates: { fecha: string; concepto: string; retiro: number; deposito: number },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data: conciliacion } = await supabaseAdmin
      .from('conciliaciones_bancarias')
      .select('id')
      .eq('movimiento_id', movimientoId)
      .eq('empresa_id', empresaId)
      .limit(1)
      .maybeSingle();

    if (conciliacion) {
      throw new Error('No se puede editar un movimiento bancario que ya se encuentra conciliado.');
    }

    const rfc = extraerRfcDeConcepto(updates.concepto);
    const monto = Math.abs(updates.deposito) - Math.abs(updates.retiro);
    const tipo_movimiento = updates.deposito > 0 ? 'Deposito' : 'Retiro';

    const { error } = await supabaseAdmin
      .from('movimientos_bancarios')
      .update({
        fecha: updates.fecha,
        concepto: updates.concepto,
        retiro: Math.abs(updates.retiro),
        deposito: Math.abs(updates.deposito),
        monto: monto,
        tipo_movimiento,
        rfc_proveedor: rfc
      })
      .eq('id', movimientoId)
      .eq('empresa_id', empresaId);

    if (error) throw error;
    
    // Actualizar posible gasto vinculado por visibilidad
    await supabaseAdmin
      .from('gastos')
      .update({
        fecha_gasto: updates.fecha,
        concepto: updates.concepto,
        monto: Math.abs(monto)
      })
      .eq('movimiento_bancario_id', movimientoId)
      .eq('empresa_id', empresaId);

    return { success: true };
  } catch (err: any) {
    console.error('Error editing bank movement:', err);
    return { success: false, error: err.message || 'Error al editar el movimiento bancario' };
  }
}
