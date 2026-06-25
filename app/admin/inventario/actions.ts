'use server';

import { supabaseAdmin, getUserEmpresaId } from '../../../lib/supabaseAdmin';

export async function registrarMovimientoInventario(
  token: string,
  almacenId: string,
  productoVarianteId: string,
  tipoMovimiento: 'Entrada' | 'Salida' | 'Ajuste',
  cantidad: number,
  costoUnitario: number,
  referencia: string = ''
) {
  try {
    const { empresaId, userId } = await getUserEmpresaId(token);

    // Obtener el ID del staff
    const { data: staff } = await supabaseAdmin
      .from('usuarios_staff')
      .select('id')
      .eq('supabase_auth_id', userId)
      .single();

    const creadoPor = staff?.id || null;

    // Llamar al RPC para transacción atómica
    const { error: rpcError } = await supabaseAdmin.rpc('registrar_movimiento_inventario', {
      p_empresa_id: empresaId,
      p_almacen_id: almacenId,
      p_producto_variante_id: productoVarianteId,
      p_tipo_movimiento: tipoMovimiento,
      p_cantidad: cantidad,
      p_costo_unitario: costoUnitario,
      p_referencia: referencia,
      p_creado_por: creadoPor
    });

    if (rpcError) throw rpcError;

    return { success: true };
  } catch (error: any) {
    console.error('Error en registrarMovimientoInventario:', error);
    return { success: false, error: error.message };
  }
}

export async function transferirStock(
  token: string,
  almacenOrigenId: string,
  almacenDestinoId: string,
  productoVarianteId: string,
  cantidad: number,
  referencia: string = 'Transferencia entre almacenes'
) {
  try {
    if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a 0');

    const { empresaId, userId } = await getUserEmpresaId(token);

    const { data: staff } = await supabaseAdmin
      .from('usuarios_staff')
      .select('id')
      .eq('supabase_auth_id', userId)
      .single();

    const creadoPor = staff?.id || null;

    // 1. Salida del almacén origen
    const { error: errorSalida } = await supabaseAdmin.rpc('registrar_movimiento_inventario', {
      p_empresa_id: empresaId,
      p_almacen_id: almacenOrigenId,
      p_producto_variante_id: productoVarianteId,
      p_tipo_movimiento: 'Transferencia',
      p_cantidad: -cantidad, // Negativo para la salida
      p_costo_unitario: 0,   // Costo se mantiene
      p_referencia: referencia,
      p_creado_por: creadoPor
    });

    if (errorSalida) throw errorSalida;

    // 2. Entrada al almacén destino
    const { error: errorEntrada } = await supabaseAdmin.rpc('registrar_movimiento_inventario', {
      p_empresa_id: empresaId,
      p_almacen_id: almacenDestinoId,
      p_producto_variante_id: productoVarianteId,
      p_tipo_movimiento: 'Transferencia',
      p_cantidad: cantidad, // Positivo para la entrada
      p_costo_unitario: 0,
      p_referencia: referencia,
      p_creado_por: creadoPor
    });

    if (errorEntrada) {
      // Intento de rollback manual si falla el destino (aunque idealmente debería ser otra RPC atómica)
      await supabaseAdmin.rpc('registrar_movimiento_inventario', {
        p_empresa_id: empresaId,
        p_almacen_id: almacenOrigenId,
        p_producto_variante_id: productoVarianteId,
        p_tipo_movimiento: 'Transferencia',
        p_cantidad: cantidad, // Regresar al origen
        p_costo_unitario: 0,
        p_referencia: 'Rollback ' + referencia,
        p_creado_por: creadoPor
      });
      throw errorEntrada;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error en transferirStock:', error);
    return { success: false, error: error.message };
  }
}
