'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function eliminarDetallesPedido(pedidoId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!pedidoId) {
      throw new Error('El ID del pedido es requerido.');
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
