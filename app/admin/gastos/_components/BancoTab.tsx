'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/BancoTab.tsx
// Tab de Conciliación Bancaria con sub-tabs:
//   1. Movimientos de cuenta (tabla + filtros + paginación)
//   2. Facturación global (depósitos vs. pedidos)
//   3. Catálogo de estatus
//   4. Métodos de pago

import React from 'react';
import {
  FileCode, FileText, CreditCard, List, Scale, Settings,
  ArrowRightLeft, Play, RefreshCw, FileSpreadsheet, Plus, Trash2,
  Layers, Check, X
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import type { MovimientoBancario, EstatusConciliacion, GastoReconciliable, FormaPago } from '../../types';

// ── Tipos de estado que se pasan como props ──────────────────────────────────

interface ReconcileModalState {
  open: boolean;
  movimiento: any | null;
  xmlUrl: string;
  pdfFacturaUrl: string;
  pdfTicketUrl: string;
  storageProvider: 'Supabase' | 'GoogleDrive';
  gastosSeleccionados: string[];
  pedidosSeleccionados: string[];
  estatusClave: string;
  loading: boolean;
  error: string;
}

interface CatalogEditModalState {
  open: boolean;
  id?: string;
  clave: string;
  nombre: string;
  descripcion: string;
  color: string;
  loading: boolean;
}

interface FormasPagoModalState {
  open: boolean;
  id?: string;
  nombre: string;
  loading: boolean;
}

interface PedidoPendiente {
  id: string;
  numero_pedido: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
}

export interface BancoTabProps {
  // Sub-tab activo
  bancoSubTab: 'movimientos' | 'global';
  setBancoSubTab: (sub: 'movimientos' | 'global') => void;

  cuentasBancarias?: any[];
  gastosFacturados?: any[];
  ventasFacturadas?: any[];
  handleDeleteMovimiento?: (id: string) => void;

  // Datos
  movimientos: MovimientoBancario[];
  estatusCatalog: EstatusConciliacion[];
  formasPago: FormaPago[];
  categoriasMovimiento?: any[];
  pedidosPendientes: PedidoPendiente[];
  gastosReconciliables: GastoReconciliable[];

  // Filtros y búsqueda
  busquedaBanco: string;
  setBusquedaBanco: (v: string) => void;
  filtroBancoTipo: string;
  setFiltroBancoTipo: (v: string) => void;
  filtroBancoEstatus: string;
  setFiltroBancoEstatus: (v: string) => void;
  filtroBancoVisibilidad: string;
  setFiltroBancoVisibilidad: (v: string) => void;

  // Paginación
  bancoPage: number;
  setBancoPage: (p: number) => void;
  bancoPageSize: number;

  // Excel / importación
  excelFile: File | null;
  isUploading: boolean;
  handleExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutoReconcile: () => void;

  // Conciliación manual
  reconcileModal: ReconcileModalState;
  setReconcileModal: React.Dispatch<React.SetStateAction<ReconcileModalState>>;
  manualMatchSearch: string;
  setManualMatchSearch: (v: string) => void;
  handleOpenReconcileModal?: (m: MovimientoBancario) => void;
  handleSaveReconciliation?: () => void;
  handleToggleVisibility: (id: string, modulo: 'egresos'|'ingresos', visible: boolean) => void;
  handleUpdateCategoria?: (movimientoId: string, categoriaId: string) => void;

  // Globalcturación global
  selectedGlobalDepositId: string | null;
  setSelectedGlobalDepositId: (id: string | null) => void;
  selectedGlobalPedidosIds: string[];
  setSelectedGlobalPedidosIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleGlobalLink: () => void;

  // Catálogo de estatus
  catalogEditModal: CatalogEditModalState;
  setCatalogEditModal: React.Dispatch<React.SetStateAction<CatalogEditModalState>>;
  handleSaveCatalogItem: () => void;
  handleDeleteCatalogItem: (id: string) => void;

  // Métodos de pago
  formasPagoModal: FormasPagoModalState;
  setFormasPagoModal: React.Dispatch<React.SetStateAction<FormasPagoModalState>>;
  handleSaveFormaPago: () => void;
  handleDeleteFormaPago: (id: string) => void;

  // Archivos
  onDownloadFile: (url: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function filterMovimientos(
  movimientos: MovimientoBancario[],
  busqueda: string,
  tipo: string,
  estatus: string,
  visibilidad: string,
  cuentaId: string
): MovimientoBancario[] {
  return movimientos.filter((m) => {
    if (cuentaId && m.cuenta_bancaria_id !== cuentaId) return false;
    if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      if (
        !m.concepto?.toLowerCase().includes(b) &&
        !m.referencia?.toLowerCase().includes(b) &&
        !String(m.monto).includes(b) &&
        !m.rfc_proveedor?.toLowerCase().includes(b)
      ) return false;
    }
    if (tipo && m.tipo_movimiento !== tipo) return false;
    if (estatus && m.estatus_conciliacion_bancaria?.clave !== estatus) return false;
    if (visibilidad === 'visibles_egresos' && !m.visible_egresos) return false;
    if (visibilidad === 'visibles_ingresos' && !m.visible_ingresos) return false;
    if (visibilidad === 'ocultos' && (m.visible_egresos || m.visible_ingresos)) return false;
    return true;
  });
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function BancoTab({
  bancoSubTab, setBancoSubTab,
  cuentasBancarias = [],
  movimientos, estatusCatalog, formasPago, categoriasMovimiento = [], pedidosPendientes, gastosReconciliables,
  busquedaBanco, setBusquedaBanco,
  filtroBancoTipo, setFiltroBancoTipo,
  filtroBancoEstatus, setFiltroBancoEstatus,
  filtroBancoVisibilidad, setFiltroBancoVisibilidad,
  bancoPage, setBancoPage, bancoPageSize,
  excelFile, isUploading,
  handleExcelUpload, handleAutoReconcile,
  reconcileModal, setReconcileModal,
  manualMatchSearch, setManualMatchSearch,
  handleOpenReconcileModal, handleSaveReconciliation,
  handleToggleVisibility, handleUpdateCategoria,
  selectedGlobalDepositId, setSelectedGlobalDepositId,
  selectedGlobalPedidosIds, setSelectedGlobalPedidosIds,
  handleGlobalLink,
  catalogEditModal, setCatalogEditModal,
  handleSaveCatalogItem, handleDeleteCatalogItem,
  formasPagoModal, setFormasPagoModal,
  handleSaveFormaPago, handleDeleteFormaPago,
  handleDeleteMovimiento,
  gastosFacturados = [],
  ventasFacturadas = [],
  onDownloadFile,
}: BancoTabProps) {

  const [selectedCuentaId, setSelectedCuentaId] = React.useState<string>('');

  const filtered = filterMovimientos(movimientos, busquedaBanco, filtroBancoTipo, filtroBancoEstatus, filtroBancoVisibilidad, selectedCuentaId);
  const paginated = filtered.slice(bancoPage * bancoPageSize, (bancoPage + 1) * bancoPageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / bancoPageSize));

  return (
    <div className="flex flex-col flex-1 font-sans overflow-hidden">
      {/* SUB-PESTAÑAS */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-900/10 p-2 gap-2 shrink-0">
        {([
          { key: 'movimientos', label: 'Movimientos de Cuenta', icon: <List size={14} /> },
          { key: 'global', label: 'Facturación Global (Ingresos)', icon: <Scale size={14} /> },
          ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => {
              setBancoSubTab(key);
              if (key === 'global') {
                setSelectedGlobalDepositId(null);
                setSelectedGlobalPedidosIds([]);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${bancoSubTab === key
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {/* ── SUB-TAB 1: MOVIMIENTOS ───────────────────────────────────────── */}
        {bancoSubTab === 'movimientos' && (
          <div className="flex-1 flex flex-col md:flex-row gap-6 p-4 overflow-hidden min-h-0">
            {/* Panel izquierdo: carga e ingesta */}
            <div className="w-full md:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto pr-1">
              
              {/* Selector de Cuenta y Cuadre */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Cuenta Bancaria</h4>
                <select
                  value={selectedCuentaId}
                  onChange={(e) => setSelectedCuentaId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Seleccionar Cuenta --</option>
                  {cuentasBancarias?.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                  ))}
                </select>

                {selectedCuentaId && (() => {
                  const cuenta = cuentasBancarias?.find(c => c.id === selectedCuentaId);
                  const depositos = filtered.filter(m => m.tipo_movimiento === 'Deposito').reduce((acc, m) => acc + Number(m.monto), 0);
                  const retiros = filtered.filter(m => m.tipo_movimiento === 'Retiro').reduce((acc, m) => acc + Number(m.monto), 0);
                  const saldoInicial = Number(cuenta?.saldo_inicial || 0);
                  const saldoCalculado = saldoInicial + depositos - retiros;

                  return (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-gray-500 mb-2">Cuadre de Saldos</h4>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Saldo Inicial:</span>
                        <span className="font-mono font-medium">{formatCurrency(saldoInicial)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-600 dark:text-emerald-500">+ Depósitos:</span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-500">{formatCurrency(depositos)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-red-600 dark:text-red-500">- Retiros:</span>
                        <span className="font-mono font-medium text-red-600 dark:text-red-500">{formatCurrency(retiros)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Saldo ERP:</span>
                        <span className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{formatCurrency(saldoCalculado)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Cargar Estado de Cuenta</h4>
                <div className="relative border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-900/60 transition-all cursor-pointer">
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                  <p className="text-xs font-semibold">{excelFile ? excelFile.name : 'Subir Excel / CSV'}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Formatos .xlsx, .xls o .csv</p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Acciones Inteligentes</h4>
                <button
                  onClick={handleAutoReconcile}
                  disabled={isUploading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  Conciliación Inteligente
                </button>
                <p className="text-[10px] text-gray-400 italic">
                  Cruza automáticamente por Monto, RFC y proximidad de fecha.
                </p>
              </div>
            </div>

            {/* Tabla de movimientos */}
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Filtros */}
              <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex flex-wrap gap-2.5 items-center shrink-0">
                <input
                  type="text"
                  placeholder="Buscar concepto, ref, rfc..."
                  value={busquedaBanco}
                  onChange={(e) => { setBusquedaBanco(e.target.value); setBancoPage(0); }}
                  className="flex-1 min-w-[150px] bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
                <select value={filtroBancoTipo} onChange={(e) => { setFiltroBancoTipo(e.target.value); setBancoPage(0); }}
                  className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-2 py-1.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all">
                  <option value="">Todos los tipos</option>
                  <option value="Deposito">Depósitos (+)</option>
                  <option value="Retiro">Retiros (-)</option>
                </select>
                <select value={filtroBancoEstatus} onChange={(e) => { setFiltroBancoEstatus(e.target.value); setBancoPage(0); }}
                  className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-2 py-1.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all">
                  <option value="">Todos los estatus</option>
                  {estatusCatalog.map((e) => <option key={e.id} value={e.clave}>{e.nombre}</option>)}
                </select>
                <select value={filtroBancoVisibilidad} onChange={(e) => { setFiltroBancoVisibilidad(e.target.value); setBancoPage(0); }}
                  className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-2 py-1.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all">
                  <option value="todos">Toda visibilidad</option>
                  <option value="visibles_egresos">Ver en Egresos</option>
                  <option value="visibles_ingresos">Ver en Ingresos</option>
                  <option value="ocultos">Ocultos en ERP</option>
                </select>
              </div>

              {/* Tabla */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="p-3 w-24">Fecha</th>
                      <th className="p-3">Detalle / Concepto</th>
                      <th className="p-3 w-36">Categoría</th>
                      <th className="p-3 text-right w-28">Monto</th>
                      <th className="p-3 text-center w-36">Estatus</th>
                      <th className="p-3 text-center w-28">ERP Egreso/Ingreso</th>
                      <th className="p-3 text-center w-24">Archivos</th>
                      <th className="p-3 text-center w-20">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                    {paginated.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">No se encontraron movimientos bancarios</td></tr>
                    ) : paginated.map((m) => {
                      const color = m.estatus_conciliacion_bancaria?.color || '#9CA3AF';
                      const dateStr = new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' });
                      const isRetiro = m.tipo_movimiento === 'Retiro';
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10 transition-colors">
                          <td className="p-3 font-mono text-gray-500">{dateStr}</td>
                          <td className="p-3">
                            <div className="font-bold text-gray-800 dark:text-gray-200">{m.concepto}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1">
                              {m.referencia && <span>Ref: {m.referencia}</span>}
                              {m.rfc_proveedor && (
                                <span className="font-mono text-[9px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-500">
                                  RFC: {m.rfc_proveedor}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              className="w-full bg-transparent border-gray-200 dark:border-gray-700 rounded text-[10px] p-1.5 focus:ring-blue-500 dark:text-gray-300"
                              value={m.categoria_movimiento_id || ''}
                              onChange={(e) => handleUpdateCategoria?.(m.id, e.target.value)}
                            >
                              <option value="">- Sin Categoría -</option>
                              {categoriasMovimiento?.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {isRetiro
                              ? <span className="text-red-500">-{formatCurrency(m.retiro)}</span>
                              : <span className="text-emerald-500">+{formatCurrency(m.deposito)}</span>}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border"
                              style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}>
                              {m.estatus_conciliacion_bancaria?.nombre || 'Pendiente'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {isRetiro ? (
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={m.visible_egresos}
                                  onChange={() => handleToggleVisibility(m.id, 'egresos', !m.visible_egresos)}
                                  className="w-3.5 h-3.5 rounded text-amber-500 border-gray-300 focus:ring-amber-500" />
                                <span className="text-[10px] text-gray-500">En Egresos</span>
                              </label>
                            ) : (
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={m.visible_ingresos}
                                  onChange={() => handleToggleVisibility(m.id, 'ingresos', !m.visible_ingresos)}
                                  className="w-3.5 h-3.5 rounded text-amber-500 border-gray-300 focus:ring-amber-500" />
                                <span className="text-[10px] text-gray-500">En Ingresos</span>
                              </label>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center flex-wrap max-w-[150px] mx-auto">
                              {/* XML */}
                              {m.xml_url ? m.xml_url.split(',').filter(Boolean).map((url, i, a) => (
                                <button key={i} onClick={() => onDownloadFile(url)}
                                  className="p-1 rounded text-[10px] text-blue-500 hover:bg-blue-500/10 flex items-center gap-0.5" title={`XML ${i + 1}`}>
                                  <FileCode size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                </button>
                              )) : <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><FileCode size={13} /></button>}
                              {/* PDF Factura */}
                              {m.pdf_factura_url ? m.pdf_factura_url.split(',').filter(Boolean).map((url, i, a) => (
                                <button key={i} onClick={() => onDownloadFile(url)}
                                  className="p-1 rounded text-[10px] text-red-500 hover:bg-red-500/10 flex items-center gap-0.5" title={`PDF ${i + 1}`}>
                                  <FileText size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                </button>
                              )) : <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><FileText size={13} /></button>}
                              {/* Ticket */}
                              {m.pdf_ticket_url ? m.pdf_ticket_url.split(',').filter(Boolean).map((url, i, a) => (
                                <button key={i} onClick={() => onDownloadFile(url)}
                                  className="p-1 rounded text-[10px] text-amber-500 hover:bg-amber-500/10 flex items-center gap-0.5" title={`Ticket ${i + 1}`}>
                                  <CreditCard size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                </button>
                              )) : <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><CreditCard size={13} /></button>}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button onClick={() => handleOpenReconcileModal?.(m)}
                              className="p-1 rounded text-amber-500 hover:bg-amber-500/15" title="Conciliación Manual">
                              <ArrowRightLeft size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs shrink-0 select-none">
                <span className="text-gray-500">
                  Mostrando {bancoPage * bancoPageSize + 1}–{Math.min((bancoPage + 1) * bancoPageSize, filtered.length)} de {filtered.length} movimientos
                </span>
                <div className="flex gap-1">
                  <button disabled={bancoPage === 0} onClick={() => setBancoPage(bancoPage - 1)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-all font-semibold">
                    Anterior
                  </button>
                  <button disabled={bancoPage >= totalPages - 1} onClick={() => setBancoPage(bancoPage + 1)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-all font-semibold">
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-TAB 2: FACTURACIÓN GLOBAL ───────────────────────────────── */}
        {bancoSubTab === 'global' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
              {/* Depósitos bancarios */}
              <div className="flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0">
                  <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5">
                    <CreditCard size={14} /> 1. Selecciona un Depósito Bancario
                  </h4>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <th className="p-3 w-12 text-center" />
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Concepto</th>
                        <th className="p-3 text-right">Depósito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                      {movimientos
                        .filter((m) => m.tipo_movimiento === 'Deposito' && m.estatus_conciliacion_bancaria?.clave !== 'comprobado')
                        .map((m) => (
                          <tr key={m.id}
                            onClick={() => { setSelectedGlobalDepositId(m.id); setSelectedGlobalPedidosIds([]); }}
                            className={`cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all ${selectedGlobalDepositId === m.id ? 'bg-amber-500/10 hover:bg-amber-500/15' : ''}`}>
                            <td className="p-3 text-center">
                              <input type="radio" name="global_deposit" checked={selectedGlobalDepositId === m.id}
                                onChange={() => { setSelectedGlobalDepositId(m.id); setSelectedGlobalPedidosIds([]); }}
                                className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-500" />
                            </td>
                            <td className="p-3 font-mono text-gray-500">{new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                            <td className="p-3">
                              <div className="font-bold text-gray-800 dark:text-gray-200">{m.concepto}</div>
                              {m.referencia && <span className="text-[10px] text-gray-400">Ref: {m.referencia}</span>}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-500">+{formatCurrency(m.deposito)}</td>
                          </tr>
                        ))}
                      {movimientos.filter((m) => m.tipo_movimiento === 'Deposito' && m.estatus_conciliacion_bancaria?.clave !== 'comprobado').length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay depósitos pendientes de conciliar</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pedidos pendientes */}
              <div className="flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0 flex justify-between items-center">
                  <h4 className="text-xs font-extrabold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Layers size={14} /> 2. Selecciona las Ventas a Asociar
                  </h4>
                  {selectedGlobalDepositId && (
                    <button
                      onClick={() => {
                        const allIds = pedidosPendientes.map((p) => p.id);
                        const allSelected = selectedGlobalPedidosIds.length === pedidosPendientes.length;
                        setSelectedGlobalPedidosIds(allSelected ? [] : allIds);
                      }}
                      className="text-[10px] font-bold text-blue-500 hover:underline">
                      {selectedGlobalPedidosIds.length === pedidosPendientes.length ? 'Desmarcar Todos' : 'Seleccionar Todos'}
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  {!selectedGlobalDepositId ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                      <CreditCard size={32} className="text-amber-500 mb-2.5 opacity-50" />
                      <p className="text-xs font-semibold text-gray-500">Ningún depósito seleccionado</p>
                      <p className="text-[10px] text-gray-400 mt-1 max-w-[250px]">Selecciona un depósito bancario para desplegar los pedidos.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          <th className="p-3 w-12 text-center" />
                          <th className="p-3">Pedido</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                        {pedidosPendientes.map((p) => (
                          <tr key={p.id}
                            onClick={() => {
                              const idx = selectedGlobalPedidosIds.indexOf(p.id);
                              const newIds = [...selectedGlobalPedidosIds];
                              idx > -1 ? newIds.splice(idx, 1) : newIds.push(p.id);
                              setSelectedGlobalPedidosIds(newIds);
                            }}
                            className="cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all">
                            <td className="p-3 text-center">
                              <input type="checkbox" checked={selectedGlobalPedidosIds.includes(p.id)}
                                onChange={() => {}} className="w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-500 rounded" />
                            </td>
                            <td className="p-3 font-mono font-bold">#{p.numero_pedido}</td>
                            <td className="p-3">
                              <div className="font-semibold text-gray-800 dark:text-gray-200">{p.cliente_nombre || 'Cliente General'}</div>
                              {p.fecha_pedido && <span className="text-[10px] text-gray-400">{new Date(p.fecha_pedido).toLocaleDateString()}</span>}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">{formatCurrency(p.precio_total)}</td>
                          </tr>
                        ))}
                        {pedidosPendientes.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay pedidos pendientes de asociar</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen y acción */}
            {selectedGlobalDepositId && (() => {
              const dep = movimientos.find((m) => m.id === selectedGlobalDepositId);
              const depMonto = dep ? Number(dep.deposito || dep.monto) : 0;
              const totalVentas = pedidosPendientes.filter((p) => selectedGlobalPedidosIds.includes(p.id)).reduce((s, p) => s + Number(p.precio_total || 0), 0);
              const dif = depMonto - totalVentas;
              const match = Math.abs(dif) < 0.05;
              return (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between items-center flex-wrap gap-4 shrink-0 font-sans">
                  <div className="flex gap-6 flex-wrap text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Depósito Bancario:</span>
                      <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">{formatCurrency(depMonto)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Ventas Seleccionadas ({selectedGlobalPedidosIds.length}):</span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalVentas)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Diferencia:</span>
                      <span className={`text-base font-mono font-extrabold ${match ? 'text-emerald-500' : 'text-amber-500'}`}>{formatCurrency(dif)}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleGlobalLink}
                    disabled={selectedGlobalPedidosIds.length === 0 || isUploading}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    Asociar y Conciliar
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        

        

      </div>

      {/* ── MODAL DE CONCILIACIÓN MANUAL (overlay global) ──────────────────── */}
      {reconcileModal.open && reconcileModal.movimiento && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setReconcileModal((p) => ({ ...p, open: false })); }}>
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Conciliación Manual</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Movimiento: <strong>{reconcileModal.movimiento.concepto}</strong> — {formatCurrency(reconcileModal.movimiento.monto)}
                </p>
              </div>
              <button onClick={() => setReconcileModal((p) => ({ ...p, open: false }))}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Búsqueda */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Buscar egreso o pedido</label>
              <input type="text" value={manualMatchSearch} placeholder="Concepto, monto, RFC..."
                onChange={(e) => setManualMatchSearch(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all" />
            </div>

            {/* Lista de gastos reconciliables */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-2">Egresos del Sistema</label>
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                {gastosReconciliables
                  .filter((g) => {
                    if (!manualMatchSearch.trim()) return true;
                    const s = manualMatchSearch.toLowerCase();
                    return g.concepto?.toLowerCase().includes(s) || String(g.monto).includes(s);
                  })
                  .map((g) => (
                    <label key={g.id} className="flex items-center gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer">
                      <input type="checkbox" checked={reconcileModal.gastosSeleccionados.includes(g.id)}
                        onChange={() => {
                          setReconcileModal((p) => {
                            const sel = [...p.gastosSeleccionados];
                            const idx = sel.indexOf(g.id);
                            idx > -1 ? sel.splice(idx, 1) : sel.push(g.id);
                            return { ...p, gastosSeleccionados: sel };
                          });
                        }}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{g.concepto}</div>
                        <div className="text-[10px] text-gray-400">{formatCurrency(g.monto)} — {g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString() : 'Sin fecha'}</div>
                      </div>
                    </label>
                  ))}
                {gastosReconciliables.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-400 italic">No hay egresos sin conciliar</div>
                )}
              </div>
            </div>

            {/* Estatus a asignar */}
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Estatus resultante</label>
              <select value={reconcileModal.estatusClave}
                onChange={(e) => setReconcileModal((p) => ({ ...p, estatusClave: e.target.value }))}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all">
                <option value="">— Selecciona un estatus —</option>
                {estatusCatalog.map((e) => <option key={e.id} value={e.clave}>{e.nombre}</option>)}
              </select>
            </div>

            {reconcileModal.error && (
              <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">{reconcileModal.error}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setReconcileModal((p) => ({ ...p, open: false }))} disabled={reconcileModal.loading}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSaveReconciliation} disabled={reconcileModal.loading || !reconcileModal.estatusClave}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2">
                {reconcileModal.loading ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar Conciliación</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
