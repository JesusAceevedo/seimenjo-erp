import { supabase } from '../../../supabase';
import {
  Proveedor,
  FacturaProveedor,
  GuardarProveedorInput
} from '../types/proveedor.types';
import {
  obtenerHistorialSaldoFavor,
  registrarAbonoSaldoFavor,
  aplicarSaldoFavorAGasto
} from '../../../../app/admin/proveedores/proveedoresActions';
import { obtenerSignedUrl } from '../../../../app/admin/gastos/actions';

export class ProveedorRepository {
  async listarProveedores(): Promise<Proveedor[]> {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre_comercial', { ascending: true });

    if (error) throw error;
    return (data || []) as Proveedor[];
  }

  async obtenerProveedorPorId(id: string): Promise<Proveedor | null> {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Proveedor;
  }

  async listarFacturasPorProveedor(proveedorId: string): Promise<FacturaProveedor[]> {
    const { data, error } = await supabase
      .from('gastos')
      .select('id, fecha_gasto, concepto, monto, uuid_fiscal, gasto_padre_id, xml_url, pdf_url')
      .eq('proveedor_id', proveedorId)
      .order('fecha_gasto', { ascending: false });

    if (error) throw error;
    return (data || []) as FacturaProveedor[];
  }

  async crearProveedor(payload: Omit<GuardarProveedorInput, 'id'>): Promise<Proveedor> {
    const { data, error } = await supabase
      .from('proveedores')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Proveedor;
  }

  async actualizarProveedor(id: string, payload: Partial<GuardarProveedorInput>): Promise<Proveedor> {
    const { data, error } = await supabase
      .from('proveedores')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Proveedor;
  }

  async eliminarProveedor(id: string): Promise<void> {
    const { error } = await supabase
      .from('proveedores')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async obtenerArchivoFirmado(path: string, token: string): Promise<{ success: boolean; url?: string; error?: string }> {
    return await obtenerSignedUrl(path, token);
  }

  async obtenerHistorialSaldo(proveedorId: string, token: string) {
    return await obtenerHistorialSaldoFavor(proveedorId, token);
  }

  async registrarAbono(proveedorId: string, monto: number, concepto: string, token: string) {
    return await registrarAbonoSaldoFavor(proveedorId, monto, concepto, token);
  }

  async aplicarSaldo(proveedorId: string, gastoId: string, monto: number, token: string) {
    return await aplicarSaldoFavorAGasto(proveedorId, gastoId, monto, token);
  }
}
