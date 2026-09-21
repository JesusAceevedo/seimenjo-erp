import { supabase } from '../../../supabase';
import {
  Empresa,
  Perfil,
  Sucursal,
  UsuarioStaff,
  PermisosModulo,
  CrearUsuarioStaffInput,
  ActualizarUsuarioStaffInput
} from '../types/staff.types';
import {
  crearUsuarioStaffAdmin,
  actualizarUsuarioStaffAdmin
} from '../../../../app/admin/actions/adminAuth';

export class StaffRepository {
  async listarEmpresas(): Promise<Empresa[]> {
    const { data, error } = await supabase.from('empresas').select('*').order('nombre');
    if (error) throw error;
    return (data || []) as Empresa[];
  }

  async listarEmpresasDeUsuario(authUserId: string, currentEmpresaId?: string | null): Promise<Empresa[]> {
    const { data: staffUser } = await supabase
      .from('usuarios_staff')
      .select('id')
      .eq('supabase_auth_id', authUserId)
      .maybeSingle();

    if (!staffUser) return [];

    const { data: pivotEmps } = await supabase
      .from('empresas_usuario_pivot')
      .select('empresa_id, empresas(id, nombre)')
      .eq('usuario_id', staffUser.id);

    const empsList = (pivotEmps?.map(p => p.empresas).filter(Boolean) as unknown as Empresa[]) || [];

    if (currentEmpresaId && !empsList.some(e => e.id === currentEmpresaId)) {
      const { data: curEmp } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', currentEmpresaId)
        .maybeSingle();
      if (curEmp) empsList.push(curEmp as unknown as Empresa);
    }

    return empsList;
  }

  async listarPerfiles(empresaId: string): Promise<Perfil[]> {
    const { data, error } = await supabase
      .from('perfiles_seguridad')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nombre');

    if (error) throw error;
    return (data || []) as Perfil[];
  }

  async listarSucursales(empresaId: string): Promise<Sucursal[]> {
    const { data, error } = await supabase
      .from('sucursales')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nombre');

    if (error) throw error;
    return (data || []) as Sucursal[];
  }

  async listarUsuariosStaff(empresaId: string): Promise<UsuarioStaff[]> {
    const { data, error } = await supabase
      .from('usuarios_staff')
      .select('*, perfiles_seguridad(nombre)')
      .eq('empresa_id', empresaId)
      .order('correo');

    if (error) throw error;
    return (data || []) as UsuarioStaff[];
  }

  async crearPerfil(empresaId: string, nombre: string, permisos: Record<string, PermisosModulo>): Promise<void> {
    const { error } = await supabase
      .from('perfiles_seguridad')
      .insert([{ empresa_id: empresaId, nombre, permisos }]);

    if (error) throw error;
  }

  async eliminarPerfil(id: string): Promise<void> {
    const { error } = await supabase
      .from('perfiles_seguridad')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async crearUsuarioStaff(input: CrearUsuarioStaffInput, token: string) {
    return await crearUsuarioStaffAdmin(input, token);
  }

  async actualizarUsuarioStaff(input: ActualizarUsuarioStaffInput, token: string) {
    return await actualizarUsuarioStaffAdmin({
      userId: input.id,
      perfilId: input.perfilId,
      sucursalesPermitidas: input.sucursalesPermitidas,
      empresasPermitidas: input.empresasPermitidas || []
    }, token);
  }

  async cambiarEstatusActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await supabase
      .from('usuarios_staff')
      .update({ activo })
      .eq('id', id);

    if (error) throw error;
  }
}
