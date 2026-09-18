import { ProductoRepository } from '../repositories/producto.repository';
import {
  Producto,
  Variante,
  Cliente,
  PrecioEspecial,
  CatalogItem,
  CatalogType,
  GuardarProductoInput,
  GuardarVarianteInput,
  GuardarPrecioEspecialInput
} from '../types/producto.types';

export class ProductoService {
  constructor(private repo: ProductoRepository = new ProductoRepository()) {}

  async obtenerTodosLosProductos(): Promise<Producto[]> {
    return await this.repo.listarProductos();
  }

  async obtenerClientes(): Promise<Cliente[]> {
    return await this.repo.listarClientes();
  }

  async obtenerCatalogos(): Promise<{ categorias: CatalogItem[]; unidades: CatalogItem[] }> {
    const [categorias, unidades] = await Promise.all([
      this.repo.listarCategorias(),
      this.repo.listarUnidadesMedida()
    ]);
    return { categorias, unidades };
  }

  async obtenerVariantesPorProducto(productoId: string): Promise<Variante[]> {
    if (!productoId) return [];
    return await this.repo.listarVariantesPorProducto(productoId);
  }

  async obtenerPreciosEspecialesPorVariante(varianteId: string): Promise<PrecioEspecial[]> {
    if (!varianteId) return [];
    return await this.repo.listarPreciosEspecialesPorVariante(varianteId);
  }

  async guardarProducto(input: GuardarProductoInput): Promise<Producto> {
    const nombreLimpio = input.nombre?.trim();
    if (!nombreLimpio) {
      throw new Error('El nombre del producto es obligatorio.');
    }

    let parsedPrice: number | null = null;
    if (input.precioBase !== undefined && input.precioBase !== null && input.precioBase !== '') {
      parsedPrice = typeof input.precioBase === 'number' ? input.precioBase : parseFloat(input.precioBase);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        throw new Error('El precio base debe ser un número válido mayor o igual a cero.');
      }
    }

    let finalImageUrl = input.imagenUrlExistente || null;

    if (input.imagenFile) {
      finalImageUrl = await this.repo.subirImagenStorage(input.imagenFile);
    }

    const payload: Partial<Producto> = {
      nombre: nombreLimpio,
      categoria: input.categoria,
      imagen_url: finalImageUrl,
      precio_base: parsedPrice,
      unidad_medida: input.unidadMedida || null
    };

    if (input.id) {
      payload.id = input.id;
    }

    const savedProducto = await this.repo.upsertProducto(payload);

    // Sincronizar automáticamente con producto_variantes si hay precio base y unidad de medida
    if (parsedPrice !== null && input.unidadMedida) {
      await this.repo.sincronizarVariantePorDefecto(
        savedProducto.id,
        input.unidadMedida,
        parsedPrice
      );
    }

    return savedProducto;
  }

  async eliminarProducto(id: string): Promise<void> {
    if (!id) throw new Error('ID de producto no válido.');
    await this.repo.eliminarProducto(id);
  }

  async agregarVariante(input: GuardarVarianteInput): Promise<Variante> {
    if (!input.productoId) {
      throw new Error('Debe seleccionar un producto.');
    }
    const gramajeLimpio = input.gramaje?.trim();
    if (!gramajeLimpio) {
      throw new Error('El gramaje o presentación es obligatorio.');
    }
    if (isNaN(input.precioBase) || input.precioBase <= 0) {
      throw new Error('El precio base debe ser un número positivo.');
    }

    return await this.repo.insertarVariante({
      producto_id: input.productoId,
      gramaje: gramajeLimpio,
      precio_base: input.precioBase
    });
  }

  async eliminarVariante(id: string): Promise<void> {
    if (!id) throw new Error('ID de variante no válido.');
    await this.repo.eliminarVariante(id);
  }

  async guardarPrecioEspecial(input: GuardarPrecioEspecialInput): Promise<void> {
    if (!input.varianteId) {
      throw new Error('Debe seleccionar una variante.');
    }
    if (!input.clienteId) {
      throw new Error('Debe seleccionar un cliente.');
    }
    if (isNaN(input.precioPactado) || input.precioPactado <= 0) {
      throw new Error('El precio pactado debe ser un número positivo.');
    }

    await this.repo.upsertPrecioEspecial({
      cliente_id: input.clienteId,
      variante_id: input.varianteId,
      precio_pactado: input.precioPactado
    });
  }

  async eliminarPrecioEspecial(id: string): Promise<void> {
    if (!id) throw new Error('ID de tarifa especial no válido.');
    await this.repo.eliminarPrecioEspecial(id);
  }

  async guardarElementoCatalogo(type: CatalogType, nombre: string, id?: string): Promise<void> {
    const nombreLimpio = nombre?.trim();
    if (!nombreLimpio) {
      throw new Error('El nombre del catálogo no puede estar vacío.');
    }
    await this.repo.upsertCatalogItem(type, nombreLimpio, id);
  }

  async eliminarElementoCatalogo(type: CatalogType, id: string): Promise<void> {
    if (!id) throw new Error('ID no válido.');
    await this.repo.eliminarCatalogItem(type, id);
  }
}
