export type { Proveedor } from '@/lib/types/common';
import type { Proveedor } from '@/lib/types/common';

export interface FacturaProveedor {
  id: string;
  fecha_gasto?: string;
  concepto: string;
  monto: number;
  uuid_fiscal?: string;
  gasto_padre_id?: string | null;
  xml_url?: string;
  pdf_url?: string;
}

export interface MovimientoSaldoFavor {
  id: string;
  proveedor_id: string;
  empresa_id: string;
  monto: number;
  tipo: string;
  concepto: string;
  origen_detalle?: string;
  gasto_id?: string | null;
  movimiento_bancario_id?: string | null;
  creado_en: string;
  gastos?: {
    concepto: string;
    uuid_fiscal?: string;
  } | null;
  movimientos_bancarios?: {
    concepto: string;
    fecha: string;
  } | null;
}

export interface ProveedorModalState {
  open: boolean;
  proveedor: Partial<Proveedor> | null;
  loading: boolean;
  error: string;
}

export interface GuardarProveedorInput {
  id?: string | null;
  rfc: string;
  nombre_comercial: string;
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
  banco?: string | null;
  banco_nombre?: string | null;
  cuenta_bancaria?: string | null;
  cuenta_numero?: string | null;
  clabe?: string | null;
  cuenta_clabe?: string | null;
  titular_cuenta?: string | null;
  convenio_numero?: string | null;
  referencia_bancaria?: string | null;
  empresa_id?: string | null;
}
