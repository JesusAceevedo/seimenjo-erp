import { supabase } from '../../../supabase';
import { Almacen, StockItem } from '../types/inventario.types';

export class InventarioRepository {
  async listarAlmacenes(empresaId?: string): Promise<Almacen[]> {
    let query = supabase.from('almacenes').select('*').order('nombre', { ascending: true });
    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Almacen[];
  }

  async listarStock(almacenId?: string): Promise<StockItem[]> {
    let query = supabase
      .from('inventario_stock')
      .select(`
        id,
        cantidad_actual,
        costo_promedio,
        almacen_id,
        almacenes (nombre),
        producto_variantes (
          gramaje,
          precio_base,
          productos (nombre)
        )
      `)
      .order('id', { ascending: true });

    if (almacenId) {
      query = query.eq('almacen_id', almacenId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as StockItem[];
  }
}
