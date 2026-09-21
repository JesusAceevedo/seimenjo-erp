export interface Cliente {
  id: string;
  empresa_id?: string | null;
  nombre_local: string;
  rfc: string;
  razon_social?: string | null;
  regimen_fiscal?: string | null;
  codigo_postal?: string | null;
  uso_cfdi?: string | null;
  email_facturacion?: string | null;
  telefono?: string | null;
  facturar_publico_general?: boolean;
  activo?: boolean;
  created_at?: string;
}

export interface ClienteFormData {
  nombre_local: string;
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  codigo_postal: string;
  uso_cfdi: string;
  email_facturacion: string;
  telefono: string;
  facturar_publico_general: boolean;
  empresa_id?: string | null;
}

export interface PortalModalState {
  open: boolean;
  cliente: Cliente | null;
  email: string;
  password: string;
}

export interface EditarClienteModalState {
  open: boolean;
  cliente: Cliente | null;
}
