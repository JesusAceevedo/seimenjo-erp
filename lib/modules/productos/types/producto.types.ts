export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  imagen_url: string | null;
  precio_base?: number | null;
  unidad_medida?: string | null;
  created_at?: string;
}

export interface Variante {
  id: string;
  producto_id: string;
  gramaje: string;
  precio_base: number;
  created_at?: string;
}

export interface Cliente {
  id: string;
  nombre_local: string;
  razon_social: string | null;
}

export interface PrecioEspecial {
  id: string;
  cliente_id: string;
  variante_id: string;
  precio_pactado: number;
  clientes?: Cliente;
}

export interface CatalogItem {
  id: string;
  nombre: string;
}

export type CatalogType = 'categorias' | 'unidades';

export interface GuardarProductoInput {
  id?: string | null;
  nombre: string;
  categoria: string;
  precioBase?: string | number | null;
  unidadMedida?: string | null;
  imagenFile?: File | null;
  imagenUrlExistente?: string | null;
}

export interface GuardarVarianteInput {
  productoId: string;
  gramaje: string;
  precioBase: number;
}

export interface GuardarPrecioEspecialInput {
  clienteId: string;
  varianteId: string;
  precioPactado: number;
}
