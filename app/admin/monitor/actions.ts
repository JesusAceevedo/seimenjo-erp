'use server';

import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import { verifyStaffUser } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function eliminarDetallesPedido(pedidoId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pedidoId) {
      throw new Error('El ID del pedido es requerido.');
    }
    
    const caller = await verifyStaffUser(token);
    
    // Si no es superusuario, verificar que el pedido pertenece a la empresa del caller
    if (!caller.esSuperusuario) {
      const { data: pedido, error: pedErr } = await supabaseAdmin
        .from('pedidos')
        .select('empresa_id')
        .eq('id', pedidoId)
        .single();
        
      if (pedErr || !pedido || pedido.empresa_id !== caller.empresaId) {
        throw new Error('Acceso denegado: El pedido no pertenece a tu empresa.');
      }
    }

    const { error } = await supabaseAdmin
      .from('pedido_detalles')
      .delete()
      .eq('pedido_id', pedidoId);

    if (error) {
      throw error;
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting order details via admin client:', err);
    return { success: false, error: err.message };
  }
}

export interface ConceptoRecuperado {
  variante_id: string;
  producto_nombre: string;
  gramaje: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  comentarios: string;
}

export async function recuperarDetalleDeFacturaXml(
  pedidoId: string,
  token: string
): Promise<{
  success: boolean;
  error?: string;
  folioFactura?: string;
  uuidFiscal?: string;
  totalXml?: number;
  conceptos?: ConceptoRecuperado[];
}> {
  try {
    if (!pedidoId) throw new Error('El ID del pedido es requerido.');
    const caller = await verifyStaffUser(token);

    // 1. Obtener pedido con facturas asociadas
    const { data: pedido, error: pedErr } = await supabaseAdmin
      .from('pedidos')
      .select('id, empresa_id, folio_factura, precio_total, facturas_clientes(*)')
      .eq('id', pedidoId)
      .single();

    if (pedErr || !pedido) throw new Error('Pedido no encontrado.');

    if (!caller.esSuperusuario && pedido.empresa_id && pedido.empresa_id !== caller.empresaId) {
      throw new Error('Acceso denegado: El pedido no pertenece a tu empresa.');
    }

    // 2. Localizar factura vinculada o buscar por folio
    let factura = Array.isArray(pedido.facturas_clientes)
      ? pedido.facturas_clientes[0]
      : pedido.facturas_clientes;

    if (!factura && pedido.folio_factura) {
      const folioClean = pedido.folio_factura.trim();
      const { data: facByFolio } = await supabaseAdmin
        .from('facturas_clientes')
        .select('*')
        .or(`serie_folio.eq.${folioClean},uuid_fiscal.eq.${folioClean}`)
        .limit(1)
        .maybeSingle();

      if (facByFolio) factura = facByFolio;
    }

    if (!factura || !factura.xml_url) {
      return {
        success: false,
        error: 'El pedido no cuenta con una factura XML asociada en el sistema.'
      };
    }

    // 3. Descargar y obtener contenido de XML
    const xmlPath = (factura.xml_url || '').split(',')[0].trim();
    let xmlText = '';

    if (xmlPath.startsWith('http://') || xmlPath.startsWith('https://')) {
      const resp = await fetch(xmlPath);
      if (!resp.ok) {
        throw new Error('No se pudo descargar el XML desde el enlace provisto.');
      }
      xmlText = await resp.text();
    } else {
      const { data: fileData, error: dlErr } = await supabaseAdmin.storage
        .from('facturas')
        .download(xmlPath);

      if (dlErr || !fileData) {
        throw new Error(`No se pudo descargar el archivo XML del almacenamiento: ${dlErr?.message || 'Archivo no encontrado'}`);
      }
      xmlText = await fileData.text();
    }

    if (!xmlText) {
      throw new Error('El archivo XML de la factura está vacío.');
    }

    // 4. Parsear el XML con XMLParser
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const jsonObj = parser.parse(xmlText);
    const comprobante = jsonObj['cfdi:Comprobante'] || jsonObj['Comprobante'];

    if (!comprobante) {
      return {
        success: false,
        error: 'El archivo XML no cuenta con una estructura CFDI válida.'
      };
    }

    const rawConceptos = comprobante['cfdi:Conceptos']?.['cfdi:Concepto'] || comprobante['Conceptos']?.['Concepto'] || [];
    const conceptosList = Array.isArray(rawConceptos) ? rawConceptos : [rawConceptos].filter(Boolean);

    if (conceptosList.length === 0) {
      return {
        success: false,
        error: 'La factura XML no contiene conceptos o partidas detalladas.'
      };
    }

    // 5. Cargar variantes de producto para mapeo
    const { data: variantes } = await supabaseAdmin
      .from('producto_variantes')
      .select('id, gramaje, precio_base, productos(id, nombre)');

    const conceptos: ConceptoRecuperado[] = [];

    for (const c of conceptosList) {
      const desc = (c['@_Descripcion'] || c['@_descripcion'] || '').toString().trim();
      const cant = parseFloat(c['@_Cantidad'] || c['@_cantidad'] || '1') || 1;
      const valorUnitario = parseFloat(c['@_ValorUnitario'] || c['@_valorUnitario'] || '0') || 0;
      const importe = parseFloat(c['@_Importe'] || c['@_importe'] || '0') || (cant * valorUnitario);

      let matchedVarianteId = '';
      let matchedProdNombre = '';
      let matchedGramaje = '';

      if (variantes && variantes.length > 0) {
        const cleanDesc = desc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Match por nombre de producto y gramaje
        for (const v of variantes) {
          const prod = Array.isArray(v.productos) ? v.productos[0] : v.productos;
          const prodName = (prod?.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const gramaje = (v.gramaje || '').toLowerCase();

          if (prodName && cleanDesc.includes(prodName)) {
            if (gramaje && cleanDesc.includes(gramaje)) {
              matchedVarianteId = v.id;
              matchedProdNombre = prod?.nombre || '';
              matchedGramaje = v.gramaje || '';
              break;
            } else if (!matchedVarianteId) {
              matchedVarianteId = v.id;
              matchedProdNombre = prod?.nombre || '';
              matchedGramaje = v.gramaje || '';
            }
          }
        }

        // Si no hubo coincidencia por nombre, intentar coincidencia por precio unitario
        if (!matchedVarianteId && valorUnitario > 0) {
          const porPrecio = variantes.find(v => Math.abs(Number(v.precio_base) - valorUnitario) < 0.05);
          if (porPrecio) {
            const prod = Array.isArray(porPrecio.productos) ? porPrecio.productos[0] : porPrecio.productos;
            matchedVarianteId = porPrecio.id;
            matchedProdNombre = prod?.nombre || '';
            matchedGramaje = porPrecio.gramaje || '';
          }
        }
      }

      conceptos.push({
        variante_id: matchedVarianteId,
        producto_nombre: matchedProdNombre || desc,
        gramaje: matchedGramaje,
        cantidad: cant,
        precio_unitario: valorUnitario,
        subtotal: importe,
        comentarios: desc
      });
    }

    return {
      success: true,
      folioFactura: factura.serie_folio || pedido.folio_factura,
      uuidFiscal: factura.uuid_fiscal,
      totalXml: parseFloat(comprobante['@_Total'] || comprobante['@_total'] || '0'),
      conceptos
    };
  } catch (err: any) {
    console.error('Error al recuperar detalle desde XML:', err);
    return {
      success: false,
      error: err.message || 'Error al procesar la factura XML.'
    };
  }
}

export interface GuardarDetalleParams {
  pedidoId: string;
  items: Array<{
    variante_id: string;
    cantidad: number;
    comentarios?: string;
    precio_aplicado?: number;
    subtotal?: number;
  }>;
  fecha_produccion?: string;
  fecha_entrega?: string;
  entregado_por?: string;
  costo_envio?: number;
  comentarios?: string;
  actualizarPrecioTotal?: boolean;
  nuevoPrecioTotal?: number;
  token: string;
}

export async function guardarDetallePedidoFaltante(
  params: GuardarDetalleParams
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!params.pedidoId) throw new Error('El ID del pedido es requerido.');
    const caller = await verifyStaffUser(params.token);

    const { data: pedido, error: pedErr } = await supabaseAdmin
      .from('pedidos')
      .select('*')
      .eq('id', params.pedidoId)
      .single();

    if (pedErr || !pedido) throw new Error('Pedido no encontrado.');

    if (!caller.esSuperusuario && pedido.empresa_id && pedido.empresa_id !== caller.empresaId) {
      throw new Error('Acceso denegado: El pedido no pertenece a tu empresa.');
    }

    const updatePayload: Record<string, any> = {};
    if (params.fecha_produccion !== undefined) updatePayload.fecha_produccion = params.fecha_produccion || null;
    if (params.fecha_entrega !== undefined) updatePayload.fecha_entrega = params.fecha_entrega || null;
    if (params.entregado_por !== undefined) updatePayload.entregado_por = params.entregado_por || null;
    if (params.costo_envio !== undefined) updatePayload.costo_envio = Number(params.costo_envio) || 0;
    if (params.comentarios !== undefined) updatePayload.comentarios = params.comentarios || null;

    if (params.actualizarPrecioTotal && params.nuevoPrecioTotal !== undefined) {
      updatePayload.precio_total = Number(params.nuevoPrecioTotal);
    }

    // 1. Actualizar campos del pedido
    if (Object.keys(updatePayload).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from('pedidos')
        .update(updatePayload)
        .eq('id', params.pedidoId);

      if (updErr) throw updErr;
    }

    // 2. Eliminar detalles anteriores
    const { error: delErr } = await supabaseAdmin
      .from('pedido_detalles')
      .delete()
      .eq('pedido_id', params.pedidoId);

    if (delErr) throw delErr;

    // 3. Insertar nuevos detalles
    const validItems = params.items.filter(i => i.variante_id && Number(i.cantidad) > 0);
    if (validItems.length > 0) {
      const targetEmpresaId = pedido.empresa_id || caller.empresaId;
      const rows = validItems.map(item => ({
        pedido_id: params.pedidoId,
        variante_id: item.variante_id,
        cantidad: Number(item.cantidad) || 1,
        precio_aplicado: Number(item.precio_aplicado) || 0,
        subtotal: Number(item.subtotal) || 0,
        comentarios: item.comentarios || null,
        empresa_id: targetEmpresaId
      }));

      const { error: insErr } = await supabaseAdmin
        .from('pedido_detalles')
        .insert(rows);

      if (insErr) throw insErr;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al guardar detalle de pedido faltante:', err);
    return {
      success: false,
      error: err.message || 'Error al guardar la información del pedido.'
    };
  }
}

export async function eliminarPedidoAdmin(
  pedidoId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pedidoId) throw new Error('El ID del pedido es requerido.');
    const caller = await verifyStaffUser(token);

    // 1. Obtener pedido a eliminar
    const { data: pedido, error: pedErr } = await supabaseAdmin
      .from('pedidos')
      .select('id, empresa_id, fecha_pedido, creado_en, folio_factura, estatus_pago, movimiento_bancario_id')
      .eq('id', pedidoId)
      .single();

    if (pedErr || !pedido) throw new Error('Pedido no encontrado.');

    if (!caller.esSuperusuario && pedido.empresa_id && pedido.empresa_id !== caller.empresaId) {
      throw new Error('Acceso denegado: El pedido no pertenece a tu empresa.');
    }

    if (!caller.esSuperusuario && pedido.estatus_pago === 'Liquidado') {
      throw new Error('Solo los superusuarios tienen autorización para eliminar pedidos ya liquidados.');
    }

    // 2. Comprobar si el periodo contable está cerrado de forma definitiva
    const opDate = pedido.fecha_pedido || (pedido.creado_en ? pedido.creado_en.substring(0, 10) : null);
    let mesCierreId: string | null = null;

    if (opDate && pedido.empresa_id) {
      const mesStr = opDate.substring(0, 7); // YYYY-MM
      const { data: cierre } = await supabaseAdmin
        .from('cierres_mensuales')
        .select('id, estatus')
        .eq('empresa_id', pedido.empresa_id)
        .eq('mes', mesStr)
        .maybeSingle();

      if (cierre && cierre.estatus === 'cerrado_definitivo') {
        if (!caller.esSuperusuario) {
          throw new Error(`El periodo contable ${mesStr} está cerrado de manera definitiva. Solo los superusuarios pueden realizar modificaciones o eliminaciones.`);
        }
        mesCierreId = cierre.id;
        // Superusuario: abrir temporalmente el cierre para permitir el DELETE sin violar el trigger
        await supabaseAdmin
          .from('cierres_mensuales')
          .update({ estatus: 'abierto' })
          .eq('id', mesCierreId);
      }
    }

    try {
      // 3. Desvincular o eliminar facturas_clientes vinculadas
      await supabaseAdmin
        .from('facturas_clientes')
        .delete()
        .eq('pedido_id', pedidoId);

      // Si tiene folio_factura registrado, también verificar si quedó huérfana por serie_folio
      if (pedido.folio_factura) {
        let facQuery = supabaseAdmin
          .from('facturas_clientes')
          .delete()
          .or(`serie_folio.eq.${pedido.folio_factura},uuid_fiscal.eq.${pedido.folio_factura}`);
        if (pedido.empresa_id) facQuery = facQuery.eq('empresa_id', pedido.empresa_id);
        await facQuery;
      }

      // 4. Limpiar conciliaciones bancarias asociadas
      await supabaseAdmin
        .from('conciliaciones_bancarias')
        .delete()
        .eq('pedido_id', pedidoId);

      // 5. Si tenía movimiento bancario vinculado, desvincular y ocultar de ingresos
      if (pedido.movimiento_bancario_id) {
        await supabaseAdmin
          .from('movimientos_bancarios')
          .update({
            visible_ingresos: false
          })
          .eq('id', pedido.movimiento_bancario_id);
      }

      // 6. Eliminar detalles de pedido
      await supabaseAdmin
        .from('pedido_detalles')
        .delete()
        .eq('pedido_id', pedidoId);

      // 7. Eliminar el pedido
      const { error: delErr } = await supabaseAdmin
        .from('pedidos')
        .delete()
        .eq('id', pedidoId);

      if (delErr) throw delErr;

      return { success: true };
    } finally {
      // Si se abrió temporalmente el cierre mensual, restaurar el estado cerrado_definitivo
      if (mesCierreId) {
        await supabaseAdmin
          .from('cierres_mensuales')
          .update({ estatus: 'cerrado_definitivo' })
          .eq('id', mesCierreId);
      }
    }
  } catch (err: any) {
    console.error('Error al eliminar pedido admin:', err);
    return {
      success: false,
      error: err.message || 'Error al eliminar pedido'
    };
  }
}

