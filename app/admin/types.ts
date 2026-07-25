// app/admin/types.ts
// Definiciones de tipos compartidas en el panel de administración.

// ---------------------------------------------------------------------------
// Entidades base
// ---------------------------------------------------------------------------

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
}

export interface Proveedor {
  id: string;
  nombre_comercial?: string;
  rfc?: string;
  razon_social?: string;
  telefono?: string;
  email?: string;
  alias?: string | null;
  portal_facturacion?: string | null;
  sitio_web?: string | null;
  direccion?: string | null;
  comentarios?: string | null;
  banco_nombre?: string | null;
  cuenta_clabe?: string | null;
  cuenta_numero?: string | null;
  convenio_numero?: string | null;
  referencia_bancaria?: string | null;
}

export interface ProductoVariante {
  id: string;
  gramaje?: string;
  precio_base?: number;
  productos: any;
}

export interface DetallePedido {
  id: string;
  cantidad: number;
  comentarios?: string;
  subtotal?: number;
  producto_variantes?: ProductoVariante;
}

export interface Pedido {
  id: string;
  numero_pedido?: number;
  cliente_id?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  clientes?: Cliente;
  fecha_pedido?: string;
  fecha_produccion?: string;
  fecha_entrega?: string;
  entregado_por?: string;
  costo_envio?: number;
  precio_total?: number;
  estatus_pedido?: string;
  estatus_pago?: string;
  metodo_pago?: string;
  pedido_detalles?: DetallePedido[];
  creado_en?: string;
  comentarios?: string;
  comentarios_generales?: string;
  folio_factura?: string;
  movimiento_bancario_id?: string | null;
}

export interface Repartidor {
  id: string;
  nombre: string;
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

/** Única declaración de FormaPago — elimina el duplicado anterior. */
export interface FormaPago {
  id: string;
  nombre: string;
  codigo?: string | null;
}

export interface EstatusFactura {
  id: string;
  nombre: string;
}

export interface CategoriaGasto {
  id: string;
  nombre: string;
  tipo?: string;
  descripcion?: string;
}

export interface RegimenFiscal {
  id: string;
  nombre?: string;
  clave?: string;
  descripcion?: string;
}

export interface UsoCfdi {
  id: string;
  nombre?: string;
  clave?: string;
  descripcion?: string;
}

// ---------------------------------------------------------------------------
// Organización
// ---------------------------------------------------------------------------

export interface Empresa {
  id: string;
  nombre: string;
  rfc?: string;
  razon_social?: string;
}

export interface Sucursal {
  id: string;
  nombre: string;
}

export interface Modulo {
  id: string;
  nombre: string;
}

// ---------------------------------------------------------------------------
// Módulo de precios especiales
// ---------------------------------------------------------------------------

export interface PrecioEspecialMap {
  [varianteId: string]: number;
}

// ---------------------------------------------------------------------------
// Módulo de Gastos / Facturación
// ---------------------------------------------------------------------------

export interface GastoFacturado {
  id: string;
  fecha_timbrado?: string;
  fecha_gasto?: string;
  uuid_fiscal?: string;
  concepto: string;
  monto: number;
  subtotal?: number;
  iva_acreditable?: number;
  metodo_pago?: string;
  es_deducible?: boolean;
  categoria_id?: string | null;
  proveedores?: { nombre_comercial: string; rfc: string };
  categorias_gasto?: { id: string; nombre: string } | null;
  xml_url?: string;
  pdf_url?: string;
  ticket_url?: string;
  gasto_padre_id?: string | null;
  padre?: { concepto: string } | null;
  movimiento_bancario_id?: string | null;
}

export interface VentaFacturada {
  id: string;
  numero_pedido: string;
  folio_factura?: string | null;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
  estatus_pago?: string;
  clientes?: { nombre_local: string; rfc: string; email_facturacion?: string };
  facturas_clientes?: {
    uuid_fiscal?: string;
    xml_url?: string;
    pdf_url?: string;
    ticket_url?: string;
    total?: number;
    subtotal?: number;
    iva_trasladado?: number;
    fecha_emision?: string;
    serie_folio?: string;
  }[];
  movimiento_bancario_id?: string | null;
}

export interface GastoPendiente {
  id: string;
  concepto: string;
  monto: number;
  fecha_gasto?: string;
}

export interface GastoReconciliable {
  id: string;
  proveedor_id?: string | null;
  concepto: string;
  monto: number;
  fecha_gasto?: string;
  xml_url?: string;
  pdf_url?: string;
  ticket_url?: string;
  metodo_pago?: string;
  proveedores?: {
    nombre_comercial: string;
    rfc: string;
  } | {
    nombre_comercial: string;
    rfc: string;
  }[] | null;
}

// ---------------------------------------------------------------------------
// Módulo de Conciliación Bancaria
// ---------------------------------------------------------------------------

export interface CuentaBancaria {
  id: string;
  nombre: string;
  numero_cuenta?: string;
  saldo_inicial?: number;
  moneda?: string;
}

export interface MovimientoBancario {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  retiro?: number;
  deposito?: number;
  tipo_movimiento: 'Retiro' | 'Deposito';
  referencia?: string | null;
  rfc_proveedor?: string | null;
  visible_egresos?: boolean;
  visible_ingresos?: boolean;
  estatus_conciliacion_id?: string | null;
  estatus_conciliacion_bancaria?: EstatusConciliacion | null;
  xml_url?: string | null;
  pdf_factura_url?: string | null;
  pdf_ticket_url?: string | null;
  storage_provider?: 'Supabase' | 'GoogleDrive';
  empresa_id?: string;
  cuenta_bancaria_id?: string | null;
  cuentas_bancarias?: CuentaBancaria | null;
  categoria_movimiento_id?: string | null;
  categorias_movimiento_bancario?: CategoriaMovimientoBancario | null;
  conciliaciones_bancarias?: any[] | null;
  mes_conciliacion?: string | null;
  comprobantes_deposito_movimientos?: any[] | null;
  comentarios?: string | null;
  soporte_reembolso_url?: string | null;
  movimiento_reembolso_id?: string | null;
}

export interface CategoriaMovimientoBancario {
  id: string;
  clave: string;
  nombre: string;
  descripcion?: string;
  requiere_comprobante: boolean;
}

export interface EstatusConciliacion {
  id: string;
  clave: string;
  nombre: string;
  color?: string;
  descripcion?: string;
}

export interface ComprobanteDeposito {
  id: string;
  tipo: 'deposito_ventanilla' | 'corte_tarjeta';
  fecha: string;
  monto: number;
  descripcion?: string | null;
  archivo_url?: string | null;
  ticket_url?: string | null;
  storage_provider?: 'Supabase' | 'GoogleDrive';
  cuenta_bancaria_id?: string | null;
  empresa_id?: string;
  creado_en?: string;
  cuentas_bancarias?: CuentaBancaria | null;
  comprobantes_deposito_movimientos?: any[] | null;
  monto_debito?: number;
  monto_credito?: number;
  propina_debito?: number;
  propina_credito?: number;
  monto_amex?: number;
  propina_amex?: number;
}
