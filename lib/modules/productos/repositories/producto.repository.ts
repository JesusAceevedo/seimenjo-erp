import { supabase } from '../../../supabase';
import {
  Producto,
  Variante,
  Cliente,
  PrecioEspecial,
  CatalogItem,
  CatalogType
} from '../types/producto.types';

export class ProductoRepository {
  async listarProductos(): Promise<Producto[]> {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre');
    if (error) throw error;
    return (data || []) as Producto[];
  }

  async listarClientes(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre_local, razon_social')
      .order('nombre_local');
    if (error) throw error;
    return (data || []) as Cliente[];
  }

  async listarCategorias(): Promise<CatalogItem[]> {
    try {
      const { data, error } = await supabase
        .from('cat_categories_producto')
        .select('id, nombre')
        .order('nombre');
      if (error) {
        const retry = await supabase
          .from('cat_categorias_producto')
          .select('id, nombre')
          .order('nombre');
        if (!retry.error && retry.data) return retry.data as CatalogItem[];
        console.warn('Advertencia al consultar categorías:', error.message);
        return [];
      }
      return (data || []) as CatalogItem[];
    } catch (err) {
      console.warn('Excepción al cargar categorías:', err);
      return [];
    }
  }

  async listarUnidadesMedida(): Promise<CatalogItem[]> {
    try {
      const { data, error } = await supabase
        .from('cat_unidades_medida')
        .select('id, nombre')
        .order('nombre');
      if (error) {
        console.warn('Advertencia al consultar unidades de medida:', error.message);
        return [];
      }
      return (data || []) as CatalogItem[];
    } catch (err) {
      console.warn('Excepción al cargar unidades de medida:', err);
      return [];
    }
  }

  async listarVariantesPorProducto(productoId: string): Promise<Variante[]> {
    const { data, error } = await supabase
      .from('producto_variantes')
      .select('*')
      .eq('producto_id', productoId)
      .order('gramaje');
    if (error) throw error;
    return (data || []) as Variante[];
  }

  async listarPreciosEspecialesPorVariante(varianteId: string): Promise<PrecioEspecial[]> {
    const { data, error } = await supabase
      .from('precios_especiales')
      .select('*, clientes(id, nombre_local, razon_social)')
      .eq('variante_id', varianteId);
    if (error) throw error;
    return (data || []) as PrecioEspecial[];
  }

  async subirImagenStorage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `productos/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('productos-imagenes')
      .upload(fileName, file);

    if (uploadError) {
      throw new Error(`Error al subir imagen a Supabase Storage: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('productos-imagenes')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  }

  async upsertProducto(payload: Partial<Producto>): Promise<Producto> {
    const { data, error } = await supabase
      .from('productos')
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Producto;
  }

  async sincronizarVariantePorDefecto(
    productoId: string,
    gramaje: string,
    precioBase: number
  ): Promise<void> {
    const { data: existingVars } = await supabase
      .from('producto_variantes')
      .select('id, gramaje')
      .eq('producto_id', productoId);

    const defaultVar = existingVars?.find(v => v.gramaje === gramaje) || existingVars?.[0];

    const varPayload: {
      id?: string;
      producto_id: string;
      gramaje: string;
      precio_base: number;
    } = {
      producto_id: productoId,
      gramaje: gramaje.trim(),
      precio_base: precioBase
    };

    if (defaultVar) {
      varPayload.id = defaultVar.id;
    }

    const { error } = await supabase
      .from('producto_variantes')
      .upsert(varPayload);

    if (error) {
      console.error('Error al sincronizar variante por defecto:', error);
    }
  }

  async eliminarProducto(id: string): Promise<void> {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async insertarVariante(payload: { producto_id: string; gramaje: string; precio_base: number }): Promise<Variante> {
    const { data, error } = await supabase
      .from('producto_variantes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Variante;
  }

  async eliminarVariante(id: string): Promise<void> {
    const { error } = await supabase
      .from('producto_variantes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async upsertPrecioEspecial(payload: { cliente_id: string; variante_id: string; precio_pactado: number }): Promise<void> {
    const { error } = await supabase
      .from('precios_especiales')
      .upsert(payload, {
        onConflict: 'cliente_id,variante_id'
      });

    if (error) throw error;
  }

  async eliminarPrecioEspecial(id: string): Promise<void> {
    const { error } = await supabase
      .from('precios_especiales')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async upsertCatalogItem(type: CatalogType, nombre: string, id?: string): Promise<void> {
    const tableName = type === 'categorias' ? 'cat_categories_producto' : 'cat_unidades_medida';
    const payload: { id?: string; nombre: string } = { nombre: nombre.trim() };
    if (id) payload.id = id;

    const { error } = await supabase
      .from(tableName)
      .upsert(payload);

    if (error) {
      if (type === 'categorias') {
        const fallback = await supabase.from('cat_categorias_producto').upsert(payload);
        if (!fallback.error) return;
      }
      throw error;
    }
  }

  async eliminarCatalogItem(type: CatalogType, id: string): Promise<void> {
    const tableName = type === 'categorias' ? 'cat_categories_producto' : 'cat_unidades_medida';
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      if (type === 'categorias') {
        const fallback = await supabase.from('cat_categorias_producto').delete().eq('id', id);
        if (!fallback.error) return;
      }
      throw error;
    }
  }
}
