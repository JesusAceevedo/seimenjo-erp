import { supabase } from '../../../supabase';
import { Cliente, ClienteFormData } from '../types/cliente.types';
import { habilitarPortalClienteAdmin } from '../../../../app/admin/actions/adminAuth';

export class ClienteRepository {
  async listarClientes(empresaId?: string): Promise<Cliente[]> {
    let query = supabase
      .from('clientes')
      .select('*')
      .order('nombre_local', { ascending: true });

    if (empresaId) {
      query = query.eq('empresa_id', empresaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Cliente[];
  }

  async obtenerCliente(id: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Cliente;
  }

  async crearCliente(payload: ClienteFormData): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data as Cliente;
  }

  async actualizarCliente(id: string, payload: Partial<ClienteFormData>): Promise<Cliente> {
    const { data, error } = await supabase
      .from('clientes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Cliente;
  }

  async eliminarCliente(id: string): Promise<void> {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async habilitarAccesoPortal(
    clienteId: string,
    nombreCliente: string,
    email: string,
    pass: string,
    token: string
  ) {
    return await habilitarPortalClienteAdmin(
      {
        clienteId,
        nombreCliente,
        email,
        passwordTemporal: pass
      },
      token
    );
  }
}
