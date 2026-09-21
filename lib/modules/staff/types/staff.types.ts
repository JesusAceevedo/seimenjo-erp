export interface Empresa {
  id: string;
  nombre: string;
  logo_url?: string | null;
  [key: string]: unknown;
}

export interface PermisosModulo {
  read: boolean;
  write: boolean;
}

export interface Perfil {
  id: string;
  empresa_id?: string;
  nombre: string;
  permisos: Record<string, PermisosModulo>;
  created_at?: string;
  [key: string]: unknown;
}

export interface Sucursal {
  id: string;
  empresa_id?: string;
  nombre: string;
  [key: string]: unknown;
}

export interface UsuarioStaff {
  id: string;
  correo: string;
  activo: boolean;
  empresa_id?: string;
  es_superusuario?: boolean;
  perfiles_seguridad?: {
    nombre: string;
  } | null;
  [key: string]: unknown;
}

export interface CrearUsuarioStaffInput {
  email: string;
  passwordTemporal: string;
  nombre: string;
  empresaId: string;
  perfilId: string;
  sucursalesPermitidas: string[];
  empresasPermitidas?: string[];
}

export interface ActualizarUsuarioStaffInput {
  id: string;
  perfilId: string;
  sucursalesPermitidas: string[];
  empresasPermitidas?: string[];
}
