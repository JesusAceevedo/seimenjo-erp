'use server';

import { supabaseAdmin, getUserEmpresaId } from '../../../lib/supabaseAdmin';

export interface LineaAsientoInput {
  cuenta_contable_id: string;
  cargo: number;
  abono: number;
  concepto?: string;
}

export interface AsientoManualInput {
  tipo: 'ingreso' | 'egreso' | 'traspaso' | 'diario';
  fecha: string;
  concepto: string;
  lineas: LineaAsientoInput[];
}

// ---------------------------------------------------------------------------
// HELPER INTERNO: Obtener o Resolver Cuentas de Configuración Contable
// ---------------------------------------------------------------------------
async function resolverMapaCuentas(empresaId: string): Promise<Record<string, string>> {
  // 1. Cargar configuración guardada por la empresa
  const { data: configs } = await supabaseAdmin
    .from('configuracion_contable')
    .select('clave, cuenta_contable_id')
    .eq('empresa_id', empresaId);

  const mapa: Record<string, string> = {};
  if (configs) {
    configs.forEach((c: any) => {
      mapa[c.clave] = c.cuenta_contable_id;
    });
  }

  // 2. Cargar catálogo disponible (específico de la empresa o global SAT con empresa_id IS NULL)
  const { data: cuentas } = await supabaseAdmin
    .from('cuentas_contables')
    .select('id, codigo')
    .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`);

  const buscarIdPorCodigo = (prefix: string) => {
    const found = (cuentas || []).find((c: any) => c.codigo && c.codigo.startsWith(prefix));
    return found ? found.id : null;
  };

  // Fallbacks por defecto basados en CUC SAT si no hay configuración personalizada
  const fallbacks: Record<string, string> = {
    cuenta_banco: buscarIdPorCodigo('102.01') || buscarIdPorCodigo('101.00') || '',
    cuenta_caja_chica: buscarIdPorCodigo('101.01') || buscarIdPorCodigo('101.00') || '',
    cuentas_por_cobrar: buscarIdPorCodigo('105.01') || buscarIdPorCodigo('100.00') || '',
    iva_acreditable: buscarIdPorCodigo('118.01') || '',
    iva_pendiente_acreditable: buscarIdPorCodigo('118.02') || buscarIdPorCodigo('118.01') || '',
    cuentas_por_pagar: buscarIdPorCodigo('201.01') || buscarIdPorCodigo('200.00') || '',
    iva_trasladado: buscarIdPorCodigo('208.01') || '',
    iva_pendiente_trasladar: buscarIdPorCodigo('208.02') || buscarIdPorCodigo('208.01') || '',
    retencion_isr: buscarIdPorCodigo('216.01') || '',
    retencion_iva: buscarIdPorCodigo('216.02') || '',
    ventas: buscarIdPorCodigo('401.01') || buscarIdPorCodigo('400.00') || '',
    gastos_generales: buscarIdPorCodigo('601.01') || buscarIdPorCodigo('600.00') || '',
    gastos_comisiones: buscarIdPorCodigo('601.02') || buscarIdPorCodigo('601.01') || ''
  };

  return { ...fallbacks, ...mapa };
}

// ---------------------------------------------------------------------------
// 1. SINCRONIZAR ASIENTOS (MOTOR AUTOMÁTICO IDEMPOTENTE)
// ---------------------------------------------------------------------------
export async function sincronizarAsientos(token: string, periodo: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { empresaId, userId } = await getUserEmpresaId(token);

    // 1. Verificar si el periodo está cerrado
    const { data: cierre } = await supabaseAdmin
      .from('cierres_mensuales')
      .select('estatus')
      .eq('empresa_id', empresaId)
      .eq('mes', periodo)
      .single();

    if (cierre && (cierre.estatus === 'cerrado_definitivo' || cierre.estatus === 'pre_cerrado')) {
      return { success: false, error: `El periodo ${periodo} se encuentra cerrado (${cierre.estatus}). No se pueden sincronizar asientos.` };
    }

    const cuentasMap = await resolverMapaCuentas(empresaId);
    let totalAsientosGenerados = 0;

    // -----------------------------------------------------------------------
    // A. PROCESAR EGRESOS (GASTOS)
    // -----------------------------------------------------------------------
    const { data: gastos } = await supabaseAdmin
      .from('gastos')
      .select('*, categorias_gasto(cuenta_contable_id), movimientos_bancarios(*)')
      .eq('empresa_id', empresaId)
      .gte('fecha_gasto', `${periodo}-01`)
      .lte('fecha_gasto', `${periodo}-31`);

    if (gastos && gastos.length > 0) {
      for (const gasto of gastos) {
        if (gasto.gasto_padre_id) continue; // Los complementos se asientan por su padre o transacción

        // Verificar si ya existe un asiento para este gasto
        const { data: existente } = await supabaseAdmin
          .from('asientos')
          .select('id, estatus')
          .eq('empresa_id', empresaId)
          .eq('referencia_tabla', 'gastos')
          .eq('referencia_id', gasto.id)
          .single();

        if (existente && existente.estatus === 'contabilizado') {
          continue; // Ya está contabilizado firmemente
        }

        // Si es borrador previo, eliminamos sus detalles antiguos para re-asentar
        if (existente && existente.estatus === 'borrador') {
          await supabaseAdmin.from('asientos').delete().eq('id', existente.id);
        }

        const montoTotal = Number(gasto.monto || 0);
        if (montoTotal <= 0) continue;

        // Calcular descomposicion fiscal (IVA, Retenciones)
        let iva = 0;
        if (gasto.iva_acreditable !== undefined && gasto.iva_acreditable !== null) {
          iva = Number(gasto.iva_acreditable);
        } else if (gasto.subtotal && montoTotal > Number(gasto.subtotal)) {
          iva = montoTotal - Number(gasto.subtotal);
        } else if (gasto.uuid_fiscal) {
          iva = Math.round((montoTotal - (montoTotal / 1.16)) * 100) / 100;
        }

        const retIsr = Number(gasto.retencion_isr || 0);
        const retIva = Number(gasto.retencion_iva || 0);
        const subtotal = Math.max(0, montoTotal - iva + retIsr + retIva);

        // Determinación de cuentas contables
        const cuentaGastoId = gasto.categorias_gasto?.cuenta_contable_id || cuentasMap.gastos_generales;
        const estaPagado = !!gasto.movimientos_bancarios || gasto.metodo_pago === '01' || gasto.metodo_pago === '03';
        const cuentaIvaId = estaPagado ? cuentasMap.iva_acreditable : cuentasMap.iva_pendiente_acreditable;

        let cuentaAbonoId = cuentasMap.cuentas_por_pagar;
        if (estaPagado) {
          cuentaAbonoId = gasto.metodo_pago === '01' ? cuentasMap.cuenta_caja_chica : cuentasMap.cuenta_banco;
        }

        // Construcción de líneas del asiento (Partida Doble)
        const lineas: any[] = [];
        let totalCargo = 0;
        let totalAbono = 0;

        // 1. Cargo a Gasto (Subtotal)
        if (subtotal > 0 && cuentaGastoId) {
          lineas.push({ cuenta_contable_id: cuentaGastoId, cargo: subtotal, abono: 0, concepto: `Gasto: ${gasto.concepto || 'Egreso'}` });
          totalCargo += subtotal;
        }

        // 2. Cargo a IVA
        if (iva > 0 && cuentaIvaId) {
          lineas.push({ cuenta_contable_id: cuentaIvaId, cargo: iva, abono: 0, concepto: 'IVA Acreditable' });
          totalCargo += iva;
        }

        // 3. Abono a Retención ISR (si existe)
        if (retIsr > 0 && cuentasMap.retencion_isr) {
          lineas.push({ cuenta_contable_id: cuentasMap.retencion_isr, cargo: 0, abono: retIsr, concepto: 'Retención ISR' });
          totalAbono += retIsr;
        }

        // 4. Abono a Retención IVA (si existe)
        if (retIva > 0 && cuentasMap.retencion_iva) {
          lineas.push({ cuenta_contable_id: cuentasMap.retencion_iva, cargo: 0, abono: retIva, concepto: 'Retención IVA' });
          totalAbono += retIva;
        }

        // 5. Abono a Banco/Caja/CxP (Monto Total Neto)
        if (montoTotal > 0 && cuentaAbonoId) {
          lineas.push({ cuenta_contable_id: cuentaAbonoId, cargo: 0, abono: montoTotal, concepto: 'Pago/Contrapartida de Egreso' });
          totalAbono += montoTotal;
        }

        // Validar descuadres por redondeo (cuadre a 2 decimales)
        const diff = Math.round((totalCargo - totalAbono) * 100) / 100;
        if (diff !== 0 && lineas.length > 0) {
          lineas[0].cargo = Math.max(0, lineas[0].cargo - diff);
        }

        if (lineas.length >= 2) {
          // Obtener folio secuencial
          const { data: folio } = await supabaseAdmin.rpc('siguiente_folio_asiento', {
            p_empresa_id: empresaId,
            p_periodo: periodo
          });

          const { data: nuevoAsiento, error: asErr } = await supabaseAdmin
            .from('asientos')
            .insert({
              empresa_id: empresaId,
              tipo: 'egreso',
              fecha: gasto.fecha_gasto || `${periodo}-01`,
              periodo: periodo,
              concepto: `Póliza Egreso - ${gasto.proveedores?.nombre_comercial || gasto.concepto || 'Gasto'}`,
              uuid_fiscal: gasto.uuid_fiscal,
              referencia_tabla: 'gastos',
              referencia_id: gasto.id,
              numero_folio: folio || 1,
              estatus: 'contabilizado',
              contabilizado_por: userId
            })
            .select('id')
            .single();

          if (!asErr && nuevoAsiento) {
            const detalleEntries = lineas.map(l => ({ ...l, asiento_id: nuevoAsiento.id }));
            await supabaseAdmin.from('asientos_detalle').insert(detalleEntries);
            totalAsientosGenerados++;
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // B. PROCESAR INGRESOS (VENTAS / PEDIDOS LIQUIDADOS)
    // -----------------------------------------------------------------------
    const { data: pedidos } = await supabaseAdmin
      .from('pedidos')
      .select('*, clientes(nombre_local), facturas_clientes(*)')
      .eq('empresa_id', empresaId)
      .eq('estatus_pago', 'Liquidado')
      .gte('fecha_pedido', `${periodo}-01`)
      .lte('fecha_pedido', `${periodo}-31`);

    if (pedidos && pedidos.length > 0) {
      for (const pedido of pedidos) {
        const { data: existente } = await supabaseAdmin
          .from('asientos')
          .select('id, estatus')
          .eq('empresa_id', empresaId)
          .eq('referencia_tabla', 'pedidos')
          .eq('referencia_id', pedido.id)
          .single();

        if (existente && existente.estatus === 'contabilizado') continue;
        if (existente && existente.estatus === 'borrador') {
          await supabaseAdmin.from('asientos').delete().eq('id', existente.id);
        }

        const totalVenta = Number(pedido.precio_total || 0);
        if (totalVenta <= 0) continue;

        const subtotal = Math.round((totalVenta / 1.16) * 100) / 100;
        const ivaTrasladado = Math.round((totalVenta - subtotal) * 100) / 100;

        const lineas: any[] = [];
        // Cargo a Banco/Caja/CxC
        lineas.push({
          cuenta_contable_id: cuentasMap.cuenta_banco || cuentasMap.cuentas_por_cobrar,
          cargo: totalVenta,
          abono: 0,
          concepto: `Cobro Pedido #${pedido.numero_pedido || ''}`
        });

        // Abono a Ventas
        lineas.push({
          cuenta_contable_id: cuentasMap.ventas,
          cargo: 0,
          abono: subtotal,
          concepto: `Ventas e Ingresos del Periodo`
        });

        // Abono a IVA Trasladado
        if (ivaTrasladado > 0 && cuentasMap.iva_trasladado) {
          lineas.push({
            cuenta_contable_id: cuentasMap.iva_trasladado,
            cargo: 0,
            abono: ivaTrasladado,
            concepto: `IVA Trasladado Cobrado`
          });
        }

        const { data: folio } = await supabaseAdmin.rpc('siguiente_folio_asiento', {
          p_empresa_id: empresaId,
          p_periodo: periodo
        });

        const { data: nuevoAsiento, error: asErr } = await supabaseAdmin
          .from('asientos')
          .insert({
            empresa_id: empresaId,
            tipo: 'ingreso',
            fecha: pedido.fecha_pedido || `${periodo}-01`,
            periodo: periodo,
            concepto: `Póliza Ingreso - Venta Pedido #${pedido.numero_pedido || ''} ${pedido.clientes?.nombre_local || ''}`,
            uuid_fiscal: pedido.facturas_clientes?.[0]?.uuid_fiscal || null,
            referencia_tabla: 'pedidos',
            referencia_id: pedido.id,
            numero_folio: folio || 1,
            estatus: 'contabilizado',
            contabilizado_por: userId
          })
          .select('id')
          .single();

        if (!asErr && nuevoAsiento) {
          const detalleEntries = lineas.map(l => ({ ...l, asiento_id: nuevoAsiento.id }));
          await supabaseAdmin.from('asientos_detalle').insert(detalleEntries);
          totalAsientosGenerados++;
        }
      }
    }

    return { success: true, count: totalAsientosGenerados };
  } catch (err: any) {
    console.error('Error en sincronizarAsientos:', err);
    return { success: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// 2. REVERTIR ASIENTO (CONTRA-ASIENTO DE CANCELACIÓN)
// ---------------------------------------------------------------------------
export async function revertirAsiento(asientoId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId, userId } = await getUserEmpresaId(token);

    // Obtener asiento original y sus líneas
    const { data: original, error: origErr } = await supabaseAdmin
      .from('asientos')
      .select('*, asientos_detalle(*)')
      .eq('id', asientoId)
      .eq('empresa_id', empresaId)
      .single();

    if (origErr || !original) throw new Error('Asiento no encontrado');
    if (original.estatus === 'cancelado') throw new Error('El asiento ya fue cancelado.');

    // Verificar si el periodo está cerrado
    const { data: cierre } = await supabaseAdmin
      .from('cierres_mensuales')
      .select('estatus')
      .eq('empresa_id', empresaId)
      .eq('mes', original.periodo)
      .single();

    if (cierre && cierre.estatus === 'cerrado_definitivo') {
      throw new Error(`No se pueden revertir asientos en un periodo cerrado definitivamente (${original.periodo}).`);
    }

    // Generar contra-asiento de cancelación con montos invertidos
    const lineasReversas = (original.asientos_detalle || []).map((det: any) => ({
      cuenta_contable_id: det.cuenta_contable_id,
      cargo: det.abono, // Inversión: Abono pasa a Cargo
      abono: det.cargo, // Inversión: Cargo pasa a Abono
      concepto: `Reversión: ${det.concepto || ''}`
    }));

    const { data: folio } = await supabaseAdmin.rpc('siguiente_folio_asiento', {
      p_empresa_id: empresaId,
      p_periodo: original.periodo
    });

    const { data: nuevoContra, error: contraErr } = await supabaseAdmin
      .from('asientos')
      .insert({
        empresa_id: empresaId,
        tipo: original.tipo,
        fecha: new Date().toISOString().substring(0, 10),
        periodo: original.periodo,
        concepto: `Cancelación / Contra-Asiento de Folio #${original.numero_folio} - ${original.concepto}`,
        uuid_fiscal: original.uuid_fiscal,
        referencia_tabla: original.referencia_tabla,
        referencia_id: original.referencia_id,
        numero_folio: folio || 1,
        estatus: 'contabilizado',
        contabilizado_por: userId
      })
      .select('id')
      .single();

    if (contraErr || !nuevoContra) throw new Error('Error al crear contra-asiento: ' + contraErr?.message);

    const detalleEntries = lineasReversas.map((l: any) => ({ ...l, asiento_id: nuevoContra.id }));
    await supabaseAdmin.from('asientos_detalle').insert(detalleEntries);

    // Actualizar asiento original a estatus cancelado
    await supabaseAdmin
      .from('asientos')
      .update({ estatus: 'cancelado' })
      .eq('id', asientoId);

    return { success: true };
  } catch (err: any) {
    console.error('Error al revertir asiento:', err);
    return { success: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// 3. GUARDAR ASIENTO MANUAL (PÓLIZA DE DIARIO)
// ---------------------------------------------------------------------------
export async function guardarAsientoManual(payload: AsientoManualInput, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId, userId } = await getUserEmpresaId(token);
    const periodo = payload.fecha.substring(0, 7);

    // Validar periodo cerrado
    const { data: cierre } = await supabaseAdmin
      .from('cierres_mensuales')
      .select('estatus')
      .eq('empresa_id', empresaId)
      .eq('mes', periodo)
      .single();

    if (cierre && cierre.estatus === 'cerrado_definitivo') {
      throw new Error(`El periodo ${periodo} está cerrado definitivamente.`);
    }

    // Validar partida doble: SUM(cargo) == SUM(abono)
    const totalCargo = payload.lineas.reduce((s, l) => s + Number(l.cargo || 0), 0);
    const totalAbono = payload.lineas.reduce((s, l) => s + Number(l.abono || 0), 0);

    const diff = Math.abs(totalCargo - totalAbono);
    if (diff > 0.01) {
      throw new Error(`Descuadre en póliza manual: Total Cargo ($${totalCargo.toFixed(2)}) != Total Abono ($${totalAbono.toFixed(2)}).`);
    }

    const { data: folio } = await supabaseAdmin.rpc('siguiente_folio_asiento', {
      p_empresa_id: empresaId,
      p_periodo: periodo
    });

    const { data: asiento, error: asErr } = await supabaseAdmin
      .from('asientos')
      .insert({
        empresa_id: empresaId,
        tipo: payload.tipo || 'diario',
        fecha: payload.fecha,
        periodo: periodo,
        concepto: payload.concepto,
        numero_folio: folio || 1,
        estatus: 'contabilizado',
        contabilizado_por: userId
      })
      .select('id')
      .single();

    if (asErr || !asiento) throw new Error('Error al registrar cabecera de póliza: ' + asErr?.message);

    const detalleEntries = payload.lineas.map(l => ({
      asiento_id: asiento.id,
      cuenta_contable_id: l.cuenta_contable_id,
      cargo: l.cargo,
      abono: l.abono,
      concepto: l.concepto || payload.concepto
    }));

    const { error: detErr } = await supabaseAdmin.from('asientos_detalle').insert(detalleEntries);
    if (detErr) throw detErr;

    return { success: true };
  } catch (err: any) {
    console.error('Error al guardar asiento manual:', err);
    return { success: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// 4. CONSULTAR CATÁLOGO DE CUENTAS
// ---------------------------------------------------------------------------
export async function obtenerCatalogoCuentas(token: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { data, error } = await supabaseAdmin
      .from('cuentas_contables')
      .select('*')
      .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
      .order('codigo', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// 5. OBTENER / GUARDAR CONFIGURACIÓN CONTABLE DE LA EMPRESA
// ---------------------------------------------------------------------------
export async function obtenerConfiguracionContable(token: string): Promise<{ success: boolean; data?: Record<string, string>; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const mapa = await resolverMapaCuentas(empresaId);
    return { success: true, data: mapa };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function guardarConfiguracionContable(token: string, clave: string, cuentaContableId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    const { error } = await supabaseAdmin
      .from('configuracion_contable')
      .upsert(
        { empresa_id: empresaId, clave: clave, cuenta_contable_id: cuentaContableId },
        { onConflict: 'empresa_id,clave' }
      );

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// 6. GENERAR BALANZA DE COMPROBACIÓN
// ---------------------------------------------------------------------------
export async function obtenerBalanzaComprobacion(token: string, periodo: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { empresaId } = await getUserEmpresaId(token);

    // Cargar catálogo de cuentas
    const { data: cuentas } = await supabaseAdmin
      .from('cuentas_contables')
      .select('*')
      .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
      .order('codigo');

    // Cargar detalles de asientos del periodo
    const { data: detalles } = await supabaseAdmin
      .from('asientos_detalle')
      .select('cuenta_contable_id, cargo, abono, asientos!inner(empresa_id, periodo, estatus)')
      .eq('asientos.empresa_id', empresaId)
      .eq('asientos.periodo', periodo)
      .neq('asientos.estatus', 'cancelado');

    const sumas: Record<string, { cargos: number; abonos: number }> = {};

    (detalles || []).forEach((d: any) => {
      const cId = d.cuenta_contable_id;
      if (!sumas[cId]) sumas[cId] = { cargos: 0, abonos: 0 };
      sumas[cId].cargos += Number(d.cargo || 0);
      sumas[cId].abonos += Number(d.abono || 0);
    });

    const balanza = (cuentas || []).map((c: any) => {
      const s = sumas[c.id] || { cargos: 0, abonos: 0 };
      const saldoInicial = 0; // Se extiende con persistencia de saldos mensuales
      const neto = s.cargos - s.abonos;
      const saldoFinal = c.naturaleza === 'deudora' ? saldoInicial + neto : saldoInicial - neto;

      return {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
        nivel: c.nivel,
        es_agrupadora: c.es_agrupadora,
        saldo_inicial: saldoInicial,
        cargos: s.cargos,
        abonos: s.abonos,
        saldo_final: saldoFinal
      };
    });

    return { success: true, data: balanza };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}
