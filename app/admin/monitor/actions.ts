'use server';

import { createClient } from '@supabase/supabase-js';
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
