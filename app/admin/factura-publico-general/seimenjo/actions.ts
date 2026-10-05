'use server';

import { getUserEmpresaId, supabaseAdmin } from '../../../../lib/supabaseAdmin';

interface PedidoCreadoDesdeFactura {
  id: string;
  numero_pedido: number;
}

function isPublicoGeneralCheck(rfc?: string | null, name?: string | null, folio?: string | null) {
  const r = String(rfc || '').trim().toUpperCase();
  const n = String(name || '').trim().toUpperCase();
  const f = String(folio || '').trim().toUpperCase();

  // Es factura global si el nombre del receptor es explícitamente genérico (ej. PUBLICO EN GENERAL, VENTA AL PUBLICO EN GENERAL)
  // o si la serie/folio indica explícitamente factura global (GLOBAL, PG).
  if (n.includes('PUBLICO EN GENERAL') || n.includes('PÚBLICO EN GENERAL') || n.includes('VENTA AL PUBLICO') || n.includes('VENTA AL PÚBLICO')) return true;
  if (f.includes('GLOBAL') || f.startsWith('PG-') || f === 'PG') return true;

  // Si el RFC es genérico pero el receptor no tiene nombre o es literalmente "PUBLICO" / "MOSTRADOR"
  if ((r.includes('XAXX010101') || r.includes('XEXX010101')) && (n === '' || n === 'PUBLICO' || n === 'MOSTRADOR')) {
    return true;
  }

  return false;
}

export async function crearPedidoDesdeFacturaSeimenjo(
  facturaId: string,
  token: string
): Promise<{ success: boolean; pedido?: PedidoCreadoDesdeFactura; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('No se encontró la empresa de la sesión.');

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .select('nombre')
      .eq('id', empresaId)
      .maybeSingle();

    if (empresaError || !empresa?.nombre?.toLowerCase().includes('seimenjo') || empresa.nombre.toLowerCase().includes('sakura')) {
      throw new Error('Esta acción está disponible únicamente para Seimenjo.');
    }

    const { data: factura, error: facturaError } = await supabaseAdmin
      .from('facturas_clientes')
      .select('*, clientes(id, nombre_local, razon_social, rfc, telefono)')
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .single();

    if (facturaError || !factura) throw new Error('No se encontró la factura.');

    const clienteFacturaObj = Array.isArray(factura.clientes) ? factura.clientes[0] : factura.clientes;
    const rfc = String(clienteFacturaObj?.rfc || factura.rfc_receptor || '').trim().toUpperCase();
    const clienteNombreRaw = clienteFacturaObj?.nombre_local || clienteFacturaObj?.razon_social ||
      factura.razon_social_receptor || factura.nombre_receptor || '';

    if (isPublicoGeneralCheck(rfc, clienteNombreRaw, factura.serie_folio)) {
      throw new Error('La Factura al Público en General no genera un pedido individual.');
    }

    const linkFactura = async (pedidoId: string) => {
      const { data: linked, error: linkError } = await supabaseAdmin
        .from('facturas_clientes')
        .update({ pedido_id: pedidoId })
        .eq('id', facturaId)
        .eq('empresa_id', empresaId)
        .is('pedido_id', null)
        .select('id')
        .maybeSingle();

      if (linkError) throw linkError;
      if (linked) return;

      const { data: latest, error: latestError } = await supabaseAdmin
        .from('facturas_clientes')
        .select('pedido_id')
        .eq('id', facturaId)
        .eq('empresa_id', empresaId)
        .single();

      if (latestError || latest?.pedido_id !== pedidoId) {
        throw new Error('La factura ya se vinculó a otro pedido. Actualiza la lista antes de continuar.');
      }
    };

    if (factura.pedido_id) {
      const { data: linkedPedido, error: linkedPedidoError } = await supabaseAdmin
        .from('pedidos')
        .select('id, numero_pedido')
        .eq('id', factura.pedido_id)
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (linkedPedidoError || !linkedPedido) throw new Error('La factura ya tiene un pedido asociado.');
      return { success: true, pedido: linkedPedido };
    }

    let existingPedido: PedidoCreadoDesdeFactura | null = null;
    if (factura.serie_folio) {
      const { data } = await supabaseAdmin
        .from('pedidos')
        .select('id, numero_pedido')
        .eq('empresa_id', empresaId)
        .eq('folio_factura', factura.serie_folio)
        .maybeSingle();
      existingPedido = data;
    }
    if (!existingPedido && factura.uuid_fiscal) {
      const { data } = await supabaseAdmin
        .from('pedidos')
        .select('id, numero_pedido')
        .eq('empresa_id', empresaId)
        .or(`folio_factura.eq.${factura.uuid_fiscal},folio_factura.eq.UUID:${factura.uuid_fiscal}`)
        .maybeSingle();
      existingPedido = data;
    }
    if (existingPedido) {
      await linkFactura(existingPedido.id);
      return { success: true, pedido: existingPedido };
    }

    const { data: lastPedido, error: lastPedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('numero_pedido')
      .eq('empresa_id', empresaId)
      .order('numero_pedido', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPedidoError) throw lastPedidoError;

    const clienteNombre = clienteNombreRaw || 'Cliente sin nombre';
    const siguienteNumeroPedido = (Number(lastPedido?.numero_pedido) || 0) + 1;
    const folioFactura = factura.serie_folio || (factura.uuid_fiscal ? `UUID:${factura.uuid_fiscal}` : `FAC-${siguienteNumeroPedido}`);

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .insert({
        empresa_id: empresaId,
        numero_pedido: siguienteNumeroPedido,
        cliente_id: factura.cliente_id || null,
        cliente_nombre: clienteNombre,
        cliente_telefono: factura.clientes?.telefono || null,
        fecha_pedido: factura.fecha_emision ? String(factura.fecha_emision).slice(0, 10) : new Date().toISOString().slice(0, 10),
        precio_total: Number(factura.total || 0),
        costo_envio: 0,
        estatus_pago: 'Liquidado',
        metodo_pago: factura.forma_pago_id || '03',
        folio_factura: folioFactura,
        movimiento_bancario_id: null,
      })
      .select('id, numero_pedido')
      .single();

    if (pedidoError || !pedido) throw new Error(pedidoError?.message || 'No se pudo crear el pedido.');

    try {
      await linkFactura(pedido.id);
    } catch (error) {
      await supabaseAdmin
        .from('pedidos')
        .delete()
        .eq('id', pedido.id)
        .eq('empresa_id', empresaId);
      throw error;
    }

    return { success: true, pedido };
  } catch (error: unknown) {
    console.error('Error al crear pedido Seimenjo desde factura:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo crear el pedido desde la factura.',
    };
  }
}

export async function vincularFacturaAPedidoSeimenjo(
  facturaId: string,
  pedidoId: string,
  token: string
): Promise<{ success: boolean; pedido?: PedidoCreadoDesdeFactura; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!empresaId) throw new Error('No se encontró la empresa de la sesión.');

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .select('nombre')
      .eq('id', empresaId)
      .maybeSingle();
    const nombreEmpresa = String(empresa?.nombre || '').toLowerCase();
    if (empresaError || !nombreEmpresa.includes('seimenjo') || nombreEmpresa.includes('sakura')) {
      throw new Error('Esta acción está disponible únicamente para Seimenjo.');
    }

    const [{ data: factura, error: facturaError }, { data: pedido, error: pedidoError }] = await Promise.all([
      supabaseAdmin
        .from('facturas_clientes')
        .select('*, clientes(id, nombre_local, razon_social, rfc)')
        .eq('id', facturaId)
        .eq('empresa_id', empresaId)
        .single(),
      supabaseAdmin
        .from('pedidos')
        .select('id, numero_pedido, cliente_id, cliente_nombre, precio_total, folio_factura, clientes(id, nombre_local, razon_social, rfc), facturas_clientes(id, pedido_id)')
        .eq('id', pedidoId)
        .eq('empresa_id', empresaId)
        .single(),
    ]);

    if (facturaError || !factura) throw new Error('No se encontró la factura.');
    if (pedidoError || !pedido) throw new Error('No se encontró el pedido.');

    const clienteFacturaObj = Array.isArray(factura.clientes) ? factura.clientes[0] : factura.clientes;
    const rfcFactura = String(clienteFacturaObj?.rfc || factura.rfc_receptor || '').trim().toUpperCase();
    const clienteFacturaRaw = clienteFacturaObj?.nombre_local || clienteFacturaObj?.razon_social ||
      factura.razon_social_receptor || factura.nombre_receptor || '';
    if (isPublicoGeneralCheck(rfcFactura, clienteFacturaRaw, factura.serie_folio)) {
      throw new Error('Las facturas al Público en General o Globales no pueden vincularse a pedidos individuales.');
    }

    if (factura.pedido_id && factura.pedido_id !== pedidoId) {
      throw new Error('Esta factura ya está vinculada a otro pedido.');
    }

    // Verificar si el pedido ya tiene un CFDI confirmado en BD que sea diferente
    const otroCfdiEnPedido = pedido.facturas_clientes?.find((linkedFactura: { id: string }) => linkedFactura.id !== facturaId);
    if (otroCfdiEnPedido) {
      throw new Error('Este pedido ya tiene otro CFDI vinculado.');
    }

    const totalFactura = Number(factura.total || 0);
    const totalPedido = Number(pedido.precio_total || 0);
    if (Math.abs(totalPedido - totalFactura) > 0.05) {
      throw new Error(`El importe del pedido ($${totalPedido.toFixed(2)}) no coincide con el total de la factura ($${totalFactura.toFixed(2)}).`);
    }

    // Vinculación atómica y protección contra condiciones de carrera
    const { data: linkedFactura, error: linkError } = await supabaseAdmin
      .from('facturas_clientes')
      .update({ pedido_id: pedidoId })
      .eq('id', facturaId)
      .eq('empresa_id', empresaId)
      .or(`pedido_id.is.null,pedido_id.eq.${pedidoId}`)
      .select('id')
      .maybeSingle();

    if (linkError) throw linkError;
    if (!linkedFactura && factura.pedido_id !== pedidoId) {
      throw new Error('La factura ya fue asignada o cambió de estado. Actualiza la página e inténtalo de nuevo.');
    }

    // Verificar que no se hayan vinculado dos facturas concurrentemente al mismo pedido
    const { data: duplicateLinks } = await supabaseAdmin
      .from('facturas_clientes')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('pedido_id', pedidoId)
      .neq('id', facturaId);

    if (duplicateLinks && duplicateLinks.length > 0) {
      // Revertir
      await supabaseAdmin
        .from('facturas_clientes')
        .update({ pedido_id: null })
        .eq('id', facturaId)
        .eq('empresa_id', empresaId);
      throw new Error('El pedido ya fue vinculado concurrentemente a otro CFDI.');
    }

    const nuevoFolio = factura.serie_folio || (factura.uuid_fiscal ? `UUID:${factura.uuid_fiscal}` : pedido.folio_factura) || null;
    const updatePedidoData: { folio_factura: string | null; cliente_id?: string | null } = {
      folio_factura: nuevoFolio,
    };
    if (!pedido.cliente_id && factura.cliente_id) {
      updatePedidoData.cliente_id = factura.cliente_id;
    }

    const { error: updatePedidoError } = await supabaseAdmin
      .from('pedidos')
      .update(updatePedidoData)
      .eq('id', pedidoId)
      .eq('empresa_id', empresaId);

    if (updatePedidoError) {
      await supabaseAdmin
        .from('facturas_clientes')
        .update({ pedido_id: null })
        .eq('id', facturaId)
        .eq('empresa_id', empresaId)
        .eq('pedido_id', pedidoId);
      throw updatePedidoError;
    }

    return { success: true, pedido: { id: pedido.id, numero_pedido: pedido.numero_pedido } };
  } catch (error: unknown) {
    console.error('Error al vincular factura a pedido Seimenjo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'No se pudo vincular la factura al pedido.',
    };
  }
}