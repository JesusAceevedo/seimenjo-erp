export interface Almacen {
  id: string;
  nombre: string;
  empresa_id?: string | null;
  created_at?: string;
}

export interface StockItem {
  id: string;
  cantidad_actual: number;
  costo_promedio: number;
  almacen_id: string;
  almacenes?: {
    nombre: string;
  } | null;
  producto_variantes?: {
    gramaje: string;
    precio_base: number;
    productos?: {
      nombre: string;
    } | null;
  } | null;
}

export type InventarioTab = 'dashboard' | 'movimientos' | 'ajustes';
