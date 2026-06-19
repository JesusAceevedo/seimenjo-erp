// Shared type definitions for the admin panel

export interface Cliente {
  id: string;
  nombre_local?: string;
  telefono?: string;
  rfc?: string;
  // Add any other fields you use from the 'clientes' table
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
  created_at?: string;
  comentarios?: string;
  comentarios_generales?: string;
  folio_factura?: string;
  // any other fields you need
}

export interface Repartidor {
  id: string;
  nombre: string;
  // other fields
}

export interface FormaPago {
  id: string;
  nombre: string;
  // other fields
}

export interface PrecioEspecialMap {
  [varianteId: string]: number;
}
// Additional shared interfaces

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

export interface CategoriaGasto {
  id: string;
  nombre: string;
  tipo?: string;
  descripcion?: string;
}

export interface FormaPago {
  id: string;
  nombre: string;
}

export interface EstatusFactura {
  id: string;
  nombre: string;
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

export interface Empresa {
  id: string;
  nombre: string;
  rfc?: string;
  // other fields as needed
}

export interface Sucursal {
  id: string;
  nombre: string;
  // other fields as needed
}

export interface Modulo {
  id: string;
  nombre: string;
  // other fields as needed
}
