import { InventarioRepository } from '../repositories/inventario.repository';
import { Almacen, StockItem } from '../types/inventario.types';

export class InventarioService {
  constructor(private repo: InventarioRepository = new InventarioRepository()) {}

  async obtenerAlmacenes(empresaId?: string): Promise<Almacen[]> {
    return await this.repo.listarAlmacenes(empresaId);
  }

  async obtenerStock(almacenId?: string): Promise<StockItem[]> {
    return await this.repo.listarStock(almacenId);
  }

  calcularMetricas(stock: StockItem[]) {
    const totalVariantes = stock.length;
    const unidadesTotales = stock.reduce((sum, item) => sum + (Number(item.cantidad_actual) || 0), 0);
    const valorizacionTotal = stock.reduce(
      (sum, item) => sum + (Number(item.cantidad_actual) || 0) * (Number(item.costo_promedio) || 0),
      0
    );
    const articulosBajoStock = stock.filter(item => (Number(item.cantidad_actual) || 0) <= 10).length;

    return {
      totalVariantes,
      unidadesTotales,
      valorizacionTotal,
      articulosBajoStock
    };
  }
}
