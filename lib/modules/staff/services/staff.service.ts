import { StaffRepository } from '../repositories/staff.repository';
import {
  Empresa,
  Perfil,
  Sucursal,
  UsuarioStaff,
  PermisosModulo,
  CrearUsuarioStaffInput,
  ActualizarUsuarioStaffInput
} from '../types/staff.types';

export class StaffService {
  constructor(private repo: StaffRepository = new StaffRepository()) {}

  async obtenerEmpresas(isSuperusuario: boolean, authUserId?: string, currentEmpresaId?: string): Promise<Empresa[]> {
    if (isSuperusuario) {
      return await this.repo.listarEmpresas();
    } else if (authUserId) {
      return await this.repo.listarEmpresasDeUsuario(authUserId, currentEmpresaId);
    }
    return [];
  }

  async obtenerDatosEmpresa(targetEmpresaId: string): Promise<{
    perfiles: Perfil[];
    sucursales: Sucursal[];
    usuariosStaff: UsuarioStaff[];
  }> {
    if (!targetEmpresaId) {
      return { perfiles: [], sucursales: [], usuariosStaff: [] };
    }

    const [perfiles, sucursales, usuariosStaff] = await Promise.all([
      this.repo.listarPerfiles(targetEmpresaId),
      this.repo.listarSucursales(targetEmpresaId),
      this.repo.listarUsuariosStaff(targetEmpresaId)
    ]);

    return { perfiles, sucursales, usuariosStaff };
  }

  async crearPerfil(
    targetEmpresaId: string,
    nombre: string,
    permisos: Record<string, PermisosModulo>
  ): Promise<void> {
    const nombreLimpio = nombre?.trim();
    if (!nombreLimpio) {
      throw new Error('El nombre del perfil es obligatorio.');
    }
    if (!targetEmpresaId) {
      throw new Error('Empresa no identificada.');
    }

    await this.repo.crearPerfil(targetEmpresaId, nombreLimpio, permisos);
  }

  async eliminarPerfil(id: string): Promise<void> {
    if (!id) throw new Error('ID de perfil inválido.');
    await this.repo.eliminarPerfil(id);
  }

  async crearUsuarioStaff(input: CrearUsuarioStaffInput, token: string) {
    if (!token) throw new Error('Sesión no autorizada.');
    if (!input.nombre?.trim()) throw new Error('El nombre completo es obligatorio.');
    if (!input.email?.trim() || !input.email.includes('@')) throw new Error('El correo electrónico es inválido.');
    if (!input.passwordTemporal || input.passwordTemporal.length < 6) {
      throw new Error('La contraseña temporal debe tener al menos 6 caracteres.');
    }
    if (!input.perfilId) throw new Error('Debes seleccionar un perfil de seguridad.');

    return await this.repo.crearUsuarioStaff(input, token);
  }

  async actualizarUsuarioStaff(input: ActualizarUsuarioStaffInput, token: string) {
    if (!token) throw new Error('Sesión no autorizada.');
    if (!input.id) throw new Error('ID de usuario staff no válido.');
    if (!input.perfilId) throw new Error('Debes seleccionar un perfil de seguridad.');

    return await this.repo.actualizarUsuarioStaff(input, token);
  }

  async cambiarEstatusActivo(id: string, activo: boolean): Promise<void> {
    if (!id) throw new Error('ID de usuario staff requerido.');
    await this.repo.cambiarEstatusActivo(id, activo);
  }
}
