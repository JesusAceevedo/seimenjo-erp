import { ClienteRepository } from '../repositories/cliente.repository';
import { Cliente, ClienteFormData } from '../types/cliente.types';

export class ClienteService {
  constructor(private repo: ClienteRepository = new ClienteRepository()) {}

  async obtenerClientes(empresaId?: string): Promise<Cliente[]> {
    return await this.repo.listarClientes(empresaId);
  }

  async guardarCliente(data: ClienteFormData, id?: string): Promise<Cliente> {
    const nombreLocal = data.nombre_local?.trim();
    if (!nombreLocal) {
      throw new Error('El nombre comercial o local del cliente es obligatorio.');
    }

    let rfc = data.rfc?.trim().toUpperCase() || '';
    if (data.facturar_publico_general && !rfc) {
      rfc = 'XAXX010101000';
    }

    if (!rfc) {
      throw new Error('El RFC del cliente es obligatorio.');
    }

    const payload: ClienteFormData = {
      nombre_local: nombreLocal,
      rfc,
      razon_social: data.razon_social?.trim() || '',
      regimen_fiscal: data.regimen_fiscal?.trim() || '',
      codigo_postal: data.codigo_postal?.trim() || '',
      uso_cfdi: data.uso_cfdi?.trim() || '',
      email_facturacion: data.email_facturacion?.trim() || '',
      telefono: data.telefono?.trim() || '',
      facturar_publico_general: Boolean(data.facturar_publico_general),
      empresa_id: data.empresa_id || null
    };

    if (id) {
      return await this.repo.actualizarCliente(id, payload);
    } else {
      return await this.repo.crearCliente(payload);
    }
  }

  async eliminarCliente(id: string): Promise<void> {
    if (!id) throw new Error('ID de cliente inválido.');
    await this.repo.eliminarCliente(id);
  }

  async habilitarAccesoPortal(
    clienteId: string,
    nombreCliente: string,
    email: string,
    pass: string,
    token: string
  ) {
    if (!clienteId) throw new Error('ID de cliente requerido.');
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresa un correo electrónico válido para el acceso al portal.');
    }
    if (!pass || pass.length < 6) {
      throw new Error('La contraseña debe contener al menos 6 caracteres.');
    }

    return await this.repo.habilitarAccesoPortal(clienteId, nombreCliente, cleanEmail, pass, token);
  }
}
