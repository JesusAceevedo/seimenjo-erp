import { ProveedorRepository } from '../repositories/proveedor.repository';
import {
  Proveedor,
  FacturaProveedor,
  GuardarProveedorInput
} from '../types/proveedor.types';

export class ProveedorService {
  constructor(private repo: ProveedorRepository = new ProveedorRepository()) {}

  async obtenerProveedores(): Promise<Proveedor[]> {
    return await this.repo.listarProveedores();
  }

  async obtenerFacturas(proveedorId: string): Promise<FacturaProveedor[]> {
    if (!proveedorId) return [];
    return await this.repo.listarFacturasPorProveedor(proveedorId);
  }

  async guardarProveedor(input: GuardarProveedorInput): Promise<Proveedor> {
    const nombreComercial = input.nombre_comercial?.trim();
    if (!nombreComercial) {
      throw new Error('El nombre comercial del proveedor es obligatorio.');
    }

    const rfc = input.rfc?.trim().toUpperCase();
    if (!rfc) {
      throw new Error('El RFC del proveedor es obligatorio.');
    }

    const payload = {
      rfc,
      nombre_comercial: nombreComercial,
      razon_social: input.razon_social?.trim() || null,
      alias: input.alias?.trim() || null,
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      contacto: input.contacto?.trim() || null,
      dias_credito: input.dias_credito !== undefined && input.dias_credito !== null ? Number(input.dias_credito) : 0,
      limite_credito: input.limite_credito !== undefined && input.limite_credito !== null ? Number(input.limite_credito) : 0,
      banco: input.banco?.trim() || null,
      cuenta_bancaria: input.cuenta_bancaria?.trim() || null,
      clabe: input.clabe?.trim() || null,
      titular_cuenta: input.titular_cuenta?.trim() || null,
      empresa_id: input.empresa_id || null
    };

    if (input.id) {
      return await this.repo.actualizarProveedor(input.id, payload);
    } else {
      return await this.repo.crearProveedor(payload);
    }
  }

  async eliminarProveedor(id: string): Promise<void> {
    if (!id) throw new Error('ID de proveedor no especificado.');
    await this.repo.eliminarProveedor(id);
  }

  async obtenerUrlDescarga(path: string, token: string): Promise<string> {
    if (!path) throw new Error('Ruta de archivo inválida.');
    const res = await this.repo.obtenerArchivoFirmado(path, token);
    if (!res.success || !res.url) {
      throw new Error(res.error || 'No se pudo generar la URL de descarga.');
    }
    return res.url;
  }

  async obtenerHistorialSaldo(proveedorId: string, token: string) {
    if (!proveedorId) throw new Error('ID de proveedor requerido.');
    return await this.repo.obtenerHistorialSaldo(proveedorId, token);
  }

  async abonarSaldoFavor(proveedorId: string, monto: number, concepto: string, token: string) {
    if (!proveedorId) throw new Error('ID de proveedor requerido.');
    if (!monto || monto <= 0) throw new Error('El monto a abonar debe ser mayor a 0.');
    return await this.repo.registrarAbono(proveedorId, monto, concepto, token);
  }

  async aplicarSaldoFavor(proveedorId: string, gastoId: string, monto: number, token: string) {
    if (!proveedorId || !gastoId) throw new Error('Proveedor y factura/gasto son obligatorios.');
    if (!monto || monto <= 0) throw new Error('El monto a aplicar debe ser mayor a 0.');
    return await this.repo.aplicarSaldo(proveedorId, gastoId, monto, token);
  }
}
