/**
 * lib/types/common.ts
 * Interfaces y entidades canónicas compartidas en todo el sistema.
 */

export interface Cliente {
  id: string;
  nombre_local?: string;
  razon_social?: string;
  telefono?: string;
  rfc?: string;
  codigo_postal?: string;
  regimen_fiscal?: string;
  uso_cfdi?: string;
  email_facturacion?: string;
  es_anonimo?: boolean;
  facturar_publico_general?: boolean;
}

export interface Proveedor {
  id: string;
  empresa_id?: string | null;
  rfc?: string;
  nombre_comercial?: string;
  razon_social?: string | null;
  alias?: string | null;
  telefono?: string | null;
  email?: string | null;
  contacto?: string | null;
  portal_facturacion?: string | null;
  sitio_web?: string | null;
  direccion?: string | null;
  comentarios?: string | null;
  dias_credito?: number | null;
  limite_credito?: number | null;
  // Campos bancarios (incluye alias de compatibilidad con módulos previos)
  banco?: string | null;
  banco_nombre?: string | null;
  cuenta_bancaria?: string | null;
  cuenta_numero?: string | null;
  clabe?: string | null;
  cuenta_clabe?: string | null;
  titular_cuenta?: string | null;
  convenio_numero?: string | null;
  referencia_bancaria?: string | null;
  // Saldos y auditoría
  saldo_favor?: number | null;
  created_at?: string;
  creado_en?: string;
}

export interface FormaPago {
  id: string;
  nombre: string;
  codigo?: string | null;
}
