'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/ProveedoresTab.tsx
// Tab de gestión de proveedores: listado, detalle y modal de alta/edición.

import React from 'react';
import { Plus, Search, RefreshCw, Users, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import type { Proveedor } from '../types';

interface ProveedorModalState {
  open: boolean;
  proveedor: Partial<Proveedor> & { id?: string } | null;
  loading: boolean;
  error: string;
}

interface FacturaProveedor {
  id: string;
  fecha_gasto?: string;
  concepto: string;
  monto: number;
  uuid_fiscal?: string;
  gasto_padre_id?: string | null;
  xml_url?: string;
  pdf_url?: string;
}

export interface ProveedoresTabProps {
  proveedores: any[];
  busquedaProveedor: string;
  setBusquedaProveedor: (v: string) => void;
  selectedProveedor: any | null;
  proveedorFacturas: FacturaProveedor[];
  cargandoFacturasProveedor: boolean;
  proveedorModal: ProveedorModalState;
  setProveedorModal: React.Dispatch<React.SetStateAction<ProveedorModalState>>;
  cargarDetallesProveedor: (p: any) => void;
  handleSaveProveedor: (e: React.FormEvent) => void;
  handleDeleteProveedor: (id: string) => void;
  onDownloadFile: (url: string) => void;
}

// ── Campos del formulario de proveedores ─────────────────────────────────────

const CAMPOS_SAT = [
  { key: 'rfc', label: 'RFC', required: true, placeholder: 'XAXX010101000', span: 1, uppercase: true },
  { key: 'alias', label: 'Alias Comercial', required: false, placeholder: 'Nombre corto, Ej: Soriana', span: 1 },
  { key: 'nombre_comercial', label: 'Nombre Comercial', required: true, placeholder: 'Ej. Distribuidora de Alimentos S.A. de C.V.', span: 2 },
  { key: 'razon_social', label: 'Razón Social', required: false, placeholder: 'Nombre legal si difiere', span: 2 },
];

const CAMPOS_CONTACTO = [
  { key: 'telefono', label: 'Teléfono', placeholder: '10 dígitos', type: 'text', span: 1 },
  { key: 'email', label: 'Correo de Facturación', placeholder: 'proveedor@empresa.com', type: 'email', span: 1 },
  { key: 'portal_facturacion', label: 'Portal de Facturación (URL)', placeholder: 'https://portal.factura.com', type: 'text', span: 1 },
  { key: 'sitio_web', label: 'Sitio Web', placeholder: 'www.proveedor.com', type: 'text', span: 1 },
  { key: 'direccion', label: 'Dirección Física', placeholder: 'Calle, No, Colonia, CP, Ciudad', type: 'text', span: 2 },
];

const CAMPOS_BANCO = [
  { key: 'banco_nombre', label: 'Nombre del Banco', placeholder: 'Ej. BBVA, Santander', span: 1 },
  { key: 'cuenta_numero', label: 'Número de Cuenta / Tarjeta', placeholder: '10 o 16 dígitos', span: 1 },
  { key: 'cuenta_clabe', label: 'Cuenta CLABE (18 dígitos)', placeholder: '012345678901234567', span: 2, mono: true, maxLength: 18 },
  { key: 'convenio_numero', label: 'Número de Convenio (CIE)', placeholder: 'Ej. 14598', span: 1 },
  { key: 'referencia_bancaria', label: 'Referencia Bancaria', placeholder: 'Referencia para SPEI', span: 1 },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function ProveedoresTab({
  proveedores,
  busquedaProveedor,
  setBusquedaProveedor,
  selectedProveedor,
  proveedorFacturas,
  cargandoFacturasProveedor,
  proveedorModal,
  setProveedorModal,
  cargarDetallesProveedor,
  handleSaveProveedor,
  handleDeleteProveedor,
  onDownloadFile,
}: ProveedoresTabProps) {

  const nuevoProveedorVacio: Partial<Proveedor> = {
    nombre_comercial: '', razon_social: '', rfc: '', telefono: '', email: '',
    alias: '', portal_facturacion: '', sitio_web: '', direccion: '', comentarios: '',
    banco_nombre: '', cuenta_clabe: '', cuenta_numero: '', convenio_numero: '', referencia_bancaria: ''
  };

  const proveedoresFiltrados = proveedores.filter((p) => {
    const search = busquedaProveedor.toLowerCase();
    return (
      p.nombre_comercial?.toLowerCase().includes(search) ||
      p.razon_social?.toLowerCase().includes(search) ||
      p.rfc?.toLowerCase().includes(search) ||
      p.alias?.toLowerCase().includes(search)
    );
  });

  const updateField = (key: string, value: string) =>
    setProveedorModal((prev) => ({ ...prev, proveedor: { ...prev.proveedor, [key]: value } }));

  return (
    <div className="flex flex-col flex-1 font-sans overflow-hidden min-h-0">

      {/* BARRA DE ACCIONES */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 flex flex-wrap gap-4 items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gestión de Proveedores</span>
          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {proveedores.length} en total
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, alias o RFC..."
              value={busquedaProveedor}
              onChange={(e) => setBusquedaProveedor(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setProveedorModal({ open: true, proveedor: nuevoProveedorVacio, loading: false, error: '' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            <Plus size={14} /> Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* CONTENIDO: LISTADO + DETALLE */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        {/* Listado (lado izquierdo) */}
        <div className="w-full lg:w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col min-h-0 overflow-y-auto">
          <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {proveedoresFiltrados.map((p) => {
              const isSelected = selectedProveedor?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => cargarDetallesProveedor(p)}
                  className={`p-4 cursor-pointer transition-all hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10 flex flex-col gap-1 border-l-4 ${
                    isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-gray-900 dark:text-white truncate max-w-[180px]">
                      {p.alias ? (
                        <>{p.alias} <span className="text-[10px] text-gray-400 font-normal">({p.nombre_comercial})</span></>
                      ) : p.nombre_comercial}
                    </span>
                    <span className="font-mono text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded uppercase">{p.rfc}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 truncate">{p.razon_social || p.nombre_comercial}</span>
                  <div className="flex gap-4 text-[10px] text-gray-400 mt-1">
                    {p.telefono && <span>📞 {p.telefono}</span>}
                    {p.email && <span className="truncate max-w-[150px]">✉️ {p.email}</span>}
                  </div>
                </div>
              );
            })}
            {proveedores.length === 0 && (
              <div className="p-8 text-center text-gray-400 italic text-xs">No hay proveedores registrados.</div>
            )}
          </div>
        </div>

        {/* Detalle (lado derecho) */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-white dark:bg-gray-950 p-6">
          {selectedProveedor ? (
            <div className="space-y-6">
              {/* Cabecera */}
              <div className="flex justify-between items-start gap-4 flex-wrap border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    {selectedProveedor.alias || selectedProveedor.nombre_comercial}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Razón Social: {selectedProveedor.razon_social || selectedProveedor.nombre_comercial} | RFC: <span className="font-mono">{selectedProveedor.rfc}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProveedorModal({ open: true, proveedor: { ...selectedProveedor }, loading: false, error: '' })}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition-all"
                  >
                    Editar Info
                  </button>
                  <button
                    onClick={() => handleDeleteProveedor(selectedProveedor.id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold transition-all"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Fichas de datos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contacto */}
                <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/30 dark:bg-gray-900/10 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Contacto y Administración</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Teléfono', value: selectedProveedor.telefono },
                      { label: 'Correo Facturación', value: selectedProveedor.email, title: selectedProveedor.email, truncate: true },
                    ].map(({ label, value, title, truncate }) => (
                      <div key={label}>
                        <span className="text-[10px] text-gray-400 block">{label}</span>
                        <span className={`font-medium text-gray-900 dark:text-white${truncate ? ' truncate block' : ''}`} title={title}>{value || '-'}</span>
                      </div>
                    ))}
                    <div>
                      <span className="text-[10px] text-gray-400 block">Portal Facturación</span>
                      {selectedProveedor.portal_facturacion ? (
                        <a href={selectedProveedor.portal_facturacion} target="_blank" rel="noreferrer" className="font-medium text-indigo-500 hover:underline flex items-center gap-1">
                          Visitar <ExternalLink size={10} />
                        </a>
                      ) : <span className="text-gray-400">-</span>}
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Sitio Web</span>
                      {selectedProveedor.sitio_web ? (
                        <a href={selectedProveedor.sitio_web.startsWith('http') ? selectedProveedor.sitio_web : `https://${selectedProveedor.sitio_web}`}
                          target="_blank" rel="noreferrer" className="font-medium text-indigo-500 hover:underline flex items-center gap-1">
                          Sitio <ExternalLink size={10} />
                        </a>
                      ) : <span className="text-gray-400">-</span>}
                    </div>
                  </div>
                  <div className="text-xs pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-[10px] text-gray-400 block">Dirección</span>
                    <span className="text-gray-800 dark:text-gray-200 block mt-0.5">{selectedProveedor.direccion || '-'}</span>
                  </div>
                  <div className="text-xs pt-1">
                    <span className="text-[10px] text-gray-400 block">Comentarios / Notas</span>
                    <span className="text-gray-600 dark:text-gray-300 block mt-0.5 italic">{selectedProveedor.comentarios || '-'}</span>
                  </div>
                </div>

                {/* Datos Bancarios */}
                <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 bg-gray-50/30 dark:bg-gray-900/10 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Datos Bancarios para Transferencias</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Banco', value: selectedProveedor.banco_nombre, cls: '' },
                      { label: 'Núm. Cuenta / Tarjeta', value: selectedProveedor.cuenta_numero, cls: 'font-mono' },
                      { label: 'Cuenta CLABE (18 dígitos)', value: selectedProveedor.cuenta_clabe, cls: 'font-mono tracking-wider font-semibold', span: true },
                      { label: 'Número de Convenio', value: selectedProveedor.convenio_numero, cls: 'font-mono font-medium' },
                      { label: 'Referencia Bancaria', value: selectedProveedor.referencia_bancaria, cls: 'font-mono font-medium' },
                    ].map(({ label, value, cls, span }) => (
                      <div key={label} className={span ? 'col-span-2' : ''}>
                        <span className="text-[10px] text-gray-400 block">{label}</span>
                        <span className={`text-gray-900 dark:text-white ${cls}`}>{value || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Facturado', value: formatCurrency(proveedorFacturas.reduce((s, f) => s + Number(f.monto || 0), 0)) },
                  { label: 'Facturas Cargadas', value: `${proveedorFacturas.length} comprobantes` },
                  { label: 'Promedio por Comprobante', value: formatCurrency(proveedorFacturas.length > 0 ? proveedorFacturas.reduce((s, f) => s + Number(f.monto || 0), 0) / proveedorFacturas.length : 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 text-center">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">{label}</span>
                    <span className="block text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">{value}</span>
                  </div>
                ))}
              </div>

              {/* Historial de facturas */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">Historial de Facturas Emitidas</h3>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                  {cargandoFacturasProveedor ? (
                    <div className="p-8 text-center text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" /> Cargando facturas...
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-400 uppercase">
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Folio / Concepto</th>
                          <th className="p-3 text-right">Monto</th>
                          <th className="p-3 text-center">Documentos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                        {proveedorFacturas.map((f) => (
                          <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/10 transition-colors">
                            <td className="p-3 text-gray-500 dark:text-gray-400 font-mono text-[10px]">{f.fecha_gasto || 'S/F'}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900 dark:text-white">{f.concepto}</span>
                                {f.gasto_padre_id !== null && (
                                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[8px] font-black px-1 py-0.5 rounded uppercase">
                                    REP / Complemento
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400 font-mono">{f.uuid_fiscal || 'Sin UUID'}</span>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(f.monto)}</td>
                            <td className="p-3">
                              <div className="flex justify-center gap-1.5">
                                {f.xml_url ? (
                                  <button onClick={() => onDownloadFile(f.xml_url!)}
                                    className="p-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500 font-bold text-[9px]">
                                    XML
                                  </button>
                                ) : <span className="text-[9px] text-gray-400 italic">No XML</span>}
                                {f.pdf_url ? (
                                  <button onClick={() => onDownloadFile(f.pdf_url!)}
                                    className="p-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 font-bold text-[9px]">
                                    PDF
                                  </button>
                                ) : <span className="text-[9px] text-gray-400 italic">No PDF</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {proveedorFacturas.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay facturas cargadas para este proveedor.</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-full text-indigo-500"><Users size={32} /></div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Selecciona un Proveedor</h3>
                <p className="text-xs text-gray-400 max-w-sm">
                  Elige un proveedor del listado para consultar sus datos administrativos, portal de facturación, cuenta bancaria e historial de compras.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL REGISTRAR / EDITAR PROVEEDOR */}
      {proveedorModal.open && proveedorModal.proveedor && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setProveedorModal({ open: false, proveedor: null, loading: false, error: '' }); }}>
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col font-sans">

            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-extrabold flex items-center gap-2 text-indigo-500">
                <Users size={18} /> {(proveedorModal.proveedor as any).id ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
              </h3>
              <button onClick={() => setProveedorModal({ open: false, proveedor: null, loading: false, error: '' })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
            </div>

            {proveedorModal.error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" /> <span>{proveedorModal.error}</span>
              </div>
            )}

            <form onSubmit={handleSaveProveedor} className="space-y-4 text-xs">
              {/* Sección SAT */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Identificación (SAT)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CAMPOS_SAT.map(({ key, label, required, placeholder, span, uppercase }) => (
                    <div key={key} className={span === 2 ? 'sm:col-span-2' : ''}>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}{required && ' *'}</label>
                      <input type="text" required={required} placeholder={placeholder}
                        value={(proveedorModal.proveedor as any)[key] || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        className={`w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 ${uppercase ? 'uppercase' : ''}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección Contacto */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Contacto y Canales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CAMPOS_CONTACTO.map(({ key, label, placeholder, type, span }) => (
                    <div key={key} className={span === 2 ? 'sm:col-span-2' : ''}>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</label>
                      <input type={type} placeholder={placeholder}
                        value={(proveedorModal.proveedor as any)[key] || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sección Banco */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Información de Pago (Banco)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CAMPOS_BANCO.map(({ key, label, placeholder, span, mono, maxLength }) => (
                    <div key={key} className={span === 2 ? 'sm:col-span-2' : ''}>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</label>
                      <input type="text" placeholder={placeholder} maxLength={maxLength}
                        value={(proveedorModal.proveedor as any)[key] || ''}
                        onChange={(e) => updateField(key, e.target.value)}
                        className={`w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 ${mono ? 'font-mono tracking-wider' : ''}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Comentarios */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Comentarios / Notas Internas</label>
                <textarea rows={2} placeholder="Notas sobre el proveedor..."
                  value={(proveedorModal.proveedor as any).comentarios || ''}
                  onChange={(e) => updateField('comentarios', e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setProveedorModal({ open: false, proveedor: null, loading: false, error: '' })}
                  disabled={proveedorModal.loading}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={proveedorModal.loading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md">
                  {proveedorModal.loading ? 'Guardando...' : (proveedorModal.proveedor as any).id ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
