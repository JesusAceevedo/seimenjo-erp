'use server';

import { supabaseAdmin, getUserEmpresaId } from '../../../lib/supabaseAdmin';

export async function registrarAbonoSaldoFavor(
  proveedorId: string,
  monto: number,
  concepto: string,
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!proveedorId || monto <= 0) {
      return { success: false, error: 'Monto inválido o proveedor no especificado.' };
    }

    const { data: prov, error: provErr } = await supabaseAdmin
      .from('proveedores')
      .select('id, saldo_favor, nombre_comercial')
      .eq('id', proveedorId)
      .single();

    if (provErr || !prov) throw new Error('Proveedor no encontrado.');

    const nuevoSaldo = Number(prov.saldo_favor || 0) + Number(monto);

    const { error: updateErr } = await supabaseAdmin
      .from('proveedores')
      .update({ saldo_favor: nuevoSaldo })
      .eq('id', proveedorId);

    if (updateErr) throw updateErr;

    const { error: histErr } = await supabaseAdmin
      .from('historial_saldos_favor_proveedores')
      .insert({
        proveedor_id: proveedorId,
        empresa_id: empresaId,
        monto: monto,
        tipo: 'abono',
        concepto: concepto || 'Abono manual a saldo a favor',
        origen_detalle: `Abono directo registrado a favor de ${prov.nombre_comercial}`
      });

    if (histErr) throw histErr;

    return { success: true, nuevoSaldo };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar abono' };
  }
}

export async function aplicarSaldoFavorAGasto(
  proveedorId: string,
  gastoId: string,
  montoAplicar: number,
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!proveedorId || !gastoId || montoAplicar <= 0) {
      return { success: false, error: 'Parámetros inválidos para aplicar el saldo.' };
    }

    const { data: prov, error: provErr } = await supabaseAdmin
      .from('proveedores')
      .select('id, saldo_favor, nombre_comercial')
      .eq('id', proveedorId)
      .single();

    if (provErr || !prov) throw new Error('Proveedor no encontrado.');

    const saldoActual = Number(prov.saldo_favor || 0);
    if (saldoActual < montoAplicar) {
      return { success: false, error: `Saldo a favor insuficiente. Disponible: $${saldoActual.toFixed(2)}` };
    }

    const { data: gasto, error: gastoErr } = await supabaseAdmin
      .from('gastos')
      .select('id, concepto, saldo_favor_aplicado')
      .eq('id', gastoId)
      .single();

    if (gastoErr || !gasto) throw new Error('Gasto no encontrado.');

    const nuevoSaldoProv = saldoActual - montoAplicar;
    const nuevoAplicadoGasto = Number(gasto.saldo_favor_aplicado || 0) + montoAplicar;

    const { error: updProvErr } = await supabaseAdmin
      .from('proveedores')
      .update({ saldo_favor: nuevoSaldoProv })
      .eq('id', proveedorId);

    if (updProvErr) throw updProvErr;

    const { error: updGastoErr } = await supabaseAdmin
      .from('gastos')
      .update({ saldo_favor_aplicado: nuevoAplicadoGasto })
      .eq('id', gastoId);

    if (updGastoErr) throw updGastoErr;

    const { error: histErr } = await supabaseAdmin
      .from('historial_saldos_favor_proveedores')
      .insert({
        proveedor_id: proveedorId,
        empresa_id: empresaId,
        monto: -montoAplicar,
        tipo: 'aplicacion_gasto',
        gasto_id: gastoId,
        concepto: `Aplicación de saldo a favor a factura: ${gasto.concepto || 'Factura'}`,
        origen_detalle: `Descuento de $${montoAplicar.toFixed(2)} aplicado a gasto/factura ID ${gastoId}`
      });

    if (histErr) throw histErr;

    return { success: true, nuevoSaldo: nuevoSaldoProv };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al aplicar saldo a favor' };
  }
}

export async function generarSaldoFavorDesdeConciliacion(
  proveedorId: string,
  movimientoBancarioId: string,
  montoExcedente: number,
  gastoId: string | null,
  concepto: string,
  token: string
) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    if (!proveedorId || montoExcedente <= 0) {
      return { success: false, error: 'Monto de excedente inválido.' };
    }

    const { data: prov, error: provErr } = await supabaseAdmin
      .from('proveedores')
      .select('id, saldo_favor, nombre_comercial')
      .eq('id', proveedorId)
      .single();

    if (provErr || !prov) throw new Error('Proveedor no encontrado.');

    const nuevoSaldo = Number(prov.saldo_favor || 0) + Number(montoExcedente);

    const { error: updateErr } = await supabaseAdmin
      .from('proveedores')
      .update({ saldo_favor: nuevoSaldo })
      .eq('id', proveedorId);

    if (updateErr) throw updateErr;

    const { error: histErr } = await supabaseAdmin
      .from('historial_saldos_favor_proveedores')
      .insert({
        proveedor_id: proveedorId,
        empresa_id: empresaId,
        monto: montoExcedente,
        tipo: 'excedente_conciliacion',
        gasto_id: gastoId || null,
        movimiento_bancario_id: movimientoBancarioId,
        concepto: concepto || 'Sobrante generado desde Conciliación Bancaria',
        origen_detalle: `Excedente de pago en movimiento bancario ID ${movimientoBancarioId}`
      });

    if (histErr) throw histErr;

    return { success: true, nuevoSaldo };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al generar saldo a favor desde conciliación' };
  }
}

export async function obtenerHistorialSaldoFavor(proveedorId: string, token: string) {
  try {
    const { empresaId } = await getUserEmpresaId(token);
    const { data, error } = await supabaseAdmin
      .from('historial_saldos_favor_proveedores')
      .select('*, gastos(concepto, uuid_fiscal), movimientos_bancarios(concepto, fecha)')
      .eq('proveedor_id', proveedorId)
      .eq('empresa_id', empresaId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al obtener historial' };
  }
}
