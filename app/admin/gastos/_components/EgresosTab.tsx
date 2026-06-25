'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/EgresosTab.tsx
// Tab de Egresos/Gastos facturados — con paginación, búsqueda, columnas enriquecidas y clasificación inline.

import React, { useState, useMemo } from 'react';
import { UploadCloud, Plus, FileCode, FileText, CreditCard, Search, ChevronLeft, ChevronRight, Tag, Filter, Eye, Trash2, Edit3 } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import CargaXmlMasivaModal from './CargaXmlMasivaModal';
import CargaManualModal from './CargaManualModal';
import type { GastoFacturado, CategoriaGasto } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EgresosTabProps {
  gastosFacturados: GastoFacturado[];
  categorias: CategoriaGasto[];
  formasPago?: any[];
  onOpenComprobacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
  onUpdateCategoria: (gastoId: string, categoriaId: string | null) => void;
  onUpdateMetodoPago?: (gastoId: string, metodo: string | null) => void;
  onSincronizarPagos?: () => Promise<void>;
  onEditGasto: (gasto: GastoFacturado) => void;
  onDeleteGasto: (gastoId: string) => void;
  onRefresh?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const METODO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  '01': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: '01 - Efectivo' },
  '02': { bg: 'bg-amber-100 dark:bg-amber-900/30',     text: 'text-amber-700 dark:text-amber-400',     label: '02 - Cheque' },
  '03': { bg: 'bg-blue-100 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-400',       label: '03 - Transferencia' },
  '04': { bg: 'bg-violet-100 dark:bg-violet-900/30',   text: 'text-violet-700 dark:text-violet-400',   label: '04 - T. Crédito' },
  '28': { bg: 'bg-purple-100 dark:bg-purple-900/30',   text: 'text-purple-700 dark:text-purple-400',   label: '28 - T. Débito' },
  '99': { bg: 'bg-gray-200 dark:bg-gray-800',          text: 'text-gray-700 dark:text-gray-300',       label: '99 - Por definir' },
};

const SAT_FORMAS_PAGO = [
  { codigo: '01', nombre: 'Efectivo' },
  { codigo: '02', nombre: 'Cheque nominativo' },
  { codigo: '03', nombre: 'Transferencia electrónica' },
  { codigo: '04', nombre: 'Tarjeta de crédito' },
  { codigo: '05', nombre: 'Monedero electrónico' },
  { codigo: '06', nombre: 'Dinero electrónico' },
  { codigo: '08', nombre: 'Vales de despensa' },
  { codigo: '12', nombre: 'Dación en pago' },
  { codigo: '13', nombre: 'Pago por subrogación' },
  { codigo: '14', nombre: 'Pago por consignación' },
  { codigo: '15', nombre: 'Condonación' },
  { codigo: '17', nombre: 'Compensación' },
  { codigo: '23', nombre: 'Novación' },
  { codigo: '24', nombre: 'Confusión' },
  { codigo: '25', nombre: 'Remisión de deuda' },
  { codigo: '26', nombre: 'Prescripción o caducidad' },
  { codigo: '27', nombre: 'A satisfacción del acreedor' },
  { codigo: '28', nombre: 'Tarjeta de débito' },
  { codigo: '29', nombre: 'Tarjeta de servicios' },
  { codigo: '30', nombre: 'Aplicación de anticipos' },
  { codigo: '31', nombre: 'Intermediario pagos' },
  { codigo: '99', nombre: 'Por definir' }
];

function getMetodoPagoLabel(codigo?: string): string {
  if (!codigo) return 'Desconocido';
  const cleanCode = codigo.trim().padStart(2, '0');
  const found = SAT_FORMAS_PAGO.find(fp => fp.codigo === cleanCode);
  return found ? `${found.codigo} - ${found.nombre}` : `${cleanCode} - Otro`;
}

function MetodoBadge({ metodo }: { metodo?: string }) {
  if (!metodo) return <span className="text-gray-400 text-[10px] italic">—</span>;
  const cleanCode = metodo.trim().padStart(2, '0');
  const style = METODO_BADGE[cleanCode] ?? { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300', label: getMetodoPagoLabel(cleanCode) };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text}`}>
      <CreditCard size={9} /> {style.label}
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EgresosTab({
  gastosFacturados,
  categorias,
  formasPago = [],
  onOpenComprobacionAcumulada,
  onDownloadFile,
  onViewCfdi,
  onUpdateCategoria,
  onUpdateMetodoPago,
  onSincronizarPagos,
  onEditGasto,
  onDeleteGasto,
  onRefresh,
}: EgresosTabProps) {

  // Paginación
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sincronizando, setSincronizando] = useState(false);

  const handleSincronizarPagos = async () => {
    if (!onSincronizarPagos) return;
    if (!confirm('¿Deseas leer los XML de los registros cargados para corregir automáticamente los métodos de pago (ej. 28 -> Tarjeta de Débito)?')) return;
    setSincronizando(true);
    try {
      await onSincronizarPagos();
    } catch (err) {
      console.error(err);
    } finally {
      setSincronizando(false);
    }
  };

  // Búsqueda y filtros
  const [search, setSearch] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [verTodosFiltro, setVerTodosFiltro] = useState(false);

  // Filtros Checkbox tipo Excel
  const [filtrosEstatus, setFiltrosEstatus] = useState({
    conciliado: true,
    sin_conciliar: true,
    con_ticket: true,
    sin_documento: true,
    deducible: true,
    no_deducible: true
  });

  // Filtrado
  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return gastosFacturados.filter((g) => {
      const matchSearch = !q || (
        g.uuid_fiscal?.toLowerCase().includes(q) ||
        g.concepto?.toLowerCase().includes(q) ||
        g.proveedores?.nombre_comercial?.toLowerCase().includes(q) ||
        g.proveedores?.rfc?.toLowerCase().includes(q) ||
        g.monto?.toString().includes(q) ||
        g.subtotal?.toString().includes(q)
      );
      const matchMetodo = !filtroMetodo || g.metodo_pago === filtroMetodo;
      const matchCat = !filtroCategoria || g.categoria_id === filtroCategoria || (!g.categoria_id && filtroCategoria === '__sin__');

      // Filtros Checkbox Estado
      const esConciliado = !!g.movimiento_bancario_id;
      if (!filtrosEstatus.conciliado && esConciliado) return false;
      if (!filtrosEstatus.sin_conciliar && !esConciliado) return false;
      
      // Con Documentos separados (XML vs Ticket vs Sin Doc)
      const tieneXml = !!g.xml_url || !!g.uuid_fiscal;
      const tieneTicket = !!g.ticket_url;
      const tienePdf = !!g.pdf_url;
      const sinDocumento = !tieneXml && !tieneTicket && !tienePdf;
      
      if (!filtrosEstatus.con_ticket && tieneTicket) return false;
      if (!filtrosEstatus.sin_documento && sinDocumento) return false;

      // Filtros de Deducibilidad
      const esDeducibleGasto = g.es_deducible !== false;
      if (!filtrosEstatus.deducible && esDeducibleGasto) return false;
      if (!filtrosEstatus.no_deducible && !esDeducibleGasto) return false;

      return matchSearch && matchMetodo && matchCat;
    });
  }, [gastosFacturados, search, filtroMetodo, filtroCategoria, filtrosEstatus]);

  // Paginado
  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const pagina = Math.min(page, totalPages - 1);
  const visible = filtrados.slice(pagina * pageSize, (pagina + 1) * pageSize);

  const resetPage = () => setPage(0);

  // Calcular KPIs acumulados (IVA y formas de pago)
  const kpis = useMemo(() => {
    let totalMonto = 0;
    let totalIva = 0;
    const metodoTotals: Record<string, number> = {
      Efectivo: 0,
      Transferencia: 0,
      Tarjeta: 0,
      Cheque: 0,
      Otros: 0,
    };

    filtrados.forEach((g) => {
      const monto = Number(g.monto || 0);
      totalMonto += monto;

      // Calcular IVA con fallbacks inteligentes
      let iva = 0;
      if (g.iva_acreditable !== undefined && g.iva_acreditable !== null) {
        iva = Number(g.iva_acreditable);
      } else if (g.subtotal && Number(g.monto) > Number(g.subtotal)) {
        iva = Number(g.monto) - Number(g.subtotal);
      } else if (g.uuid_fiscal) {
        iva = Number(g.monto) - (Number(g.monto) / 1.16);
      }
      totalIva += iva;

      // Clasificar por método de pago (soporta tanto código de 2 dígitos como descripción)
      const metodo = (g.metodo_pago || '').toLowerCase();
      if (metodo === '01' || metodo.includes('efectivo')) {
        metodoTotals.Efectivo += monto;
      } else if (metodo === '03' || metodo.includes('transferencia')) {
        metodoTotals.Transferencia += monto;
      } else if (metodo === '04' || metodo === '28' || metodo.includes('tarjeta')) {
        metodoTotals.Tarjeta += monto;
      } else if (metodo === '02' || metodo.includes('cheque')) {
        metodoTotals.Cheque += monto;
      } else {
        metodoTotals.Otros += monto;
      }
    });

    return {
      totalMonto,
      totalIva,
      metodoTotals,
    };
  }, [filtrados]);

  return (
    <div className="flex flex-col flex-1 font-sans min-h-0 overflow-hidden">

      {/* ── BARRA DE ACCIONES + FILTROS ────────────────────────────────────── */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 shrink-0 space-y-2">
        {/* Fila 1: Título + botón */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Egresos Facturados</span>
            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {filtrados.length} registros
            </span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleSincronizarPagos}
              disabled={sincronizando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <UploadCloud size={13} /> {sincronizando ? 'Verificando...' : 'Corregir Pagos XML'}
            </button>
            <button
              onClick={() => setShowXmlModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <UploadCloud size={13} /> Subir Masivo (XML)
            </button>
            <button
              onClick={() => setManualModal({isOpen: true})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <FileText size={13} /> Carga Manual
            </button>
            <button
              onClick={onOpenComprobacionAcumulada}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus size={13} /> Comprobación Acumulada
            </button>
          </div>
        </div>

        {/* Fila 2: Buscador + Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por UUID, concepto, proveedor..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-gray-400" />
            <select
              value={filtroMetodo}
              onChange={(e) => { 
                if (e.target.value === 'VER_TODOS') {
                  setVerTodosFiltro(true);
                  return;
                }
                setFiltroMetodo(e.target.value); 
                resetPage(); 
              }}
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs px-2.5 py-2 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todos los pagos</option>
              {formasPago.map(f => (
                <option key={f.codigo || f.id} value={f.codigo || ''}>
                  {f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre}
                </option>
              ))}
              {!verTodosFiltro && (
                <option value="VER_TODOS">🔍 Mostrar todos los códigos SAT...</option>
              )}
              {verTodosFiltro && (
                <>
                  <option disabled className="text-gray-400 font-bold border-t">--- Todos los Códigos SAT ---</option>
                  {SAT_FORMAS_PAGO.filter(sat => !formasPago.some(f => f.codigo === sat.codigo)).map(sat => (
                    <option key={sat.codigo} value={sat.codigo}>
                      {sat.codigo} - {sat.nombre}
                    </option>
                  ))}
                </>
              )}
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => { setFiltroCategoria(e.target.value); resetPage(); }}
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs px-2.5 py-2 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todas las categorías</option>
              <option value="__sin__">Sin clasificar</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Fila 3: Filtros de checkboxes tipo Excel */}
        <div className="flex flex-wrap gap-4 items-center text-xs font-semibold text-gray-600 dark:text-gray-400 mt-2">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            <input 
              type="checkbox" 
              checked={filtrosEstatus.conciliado} 
              onChange={e => { setFiltrosEstatus(prev => ({...prev, conciliado: e.target.checked})); resetPage(); }} 
              className="rounded text-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            Conciliados
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            <input 
              type="checkbox" 
              checked={filtrosEstatus.sin_conciliar} 
              onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_conciliar: e.target.checked})); resetPage(); }} 
              className="rounded text-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            Sin Conciliar
          </label>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            <input 
              type="checkbox" 
              checked={filtrosEstatus.con_ticket} 
              onChange={e => { setFiltrosEstatus(prev => ({...prev, con_ticket: e.target.checked})); resetPage(); }} 
              className="rounded text-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            Con Ticket
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            <input 
              type="checkbox" 
              checked={filtrosEstatus.sin_documento} 
              onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_documento: e.target.checked})); resetPage(); }} 
              className="rounded text-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            Sin Documento
          </label>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            <input 
              type="checkbox" 
              checked={filtrosEstatus.deducible} 
              onChange={e => { setFiltrosEstatus(prev => ({...prev, deducible: e.target.checked})); resetPage(); }} 
              className="rounded text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            Deducibles
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
            <input 
              type="checkbox" 
              checked={filtrosEstatus.no_deducible} 
              onChange={e => { setFiltrosEstatus(prev => ({...prev, no_deducible: e.target.checked})); resetPage(); }} 
              className="rounded text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            No Deducibles
          </label>
        </div>
      </div>

      {/* ── TARJETAS DE ACUMULADOS (KPIs) ─────────────────────────────────── */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50/50 dark:bg-gray-900/10 border-b border-gray-200 dark:border-gray-800 shrink-0">
        {/* Card 1: Total Egresos */}
        <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-650 dark:text-red-400 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-red-600 dark:text-red-400 font-extrabold text-sm">$</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Total Egresos</span>
            <span className="text-lg font-black text-gray-900 dark:text-white block font-mono">
              {formatCurrency(kpis.totalMonto)}
            </span>
          </div>
        </div>

        {/* Card 2: IVA Acreditable */}
        <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <FileCode size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">IVA Acreditable</span>
            <span className="text-lg font-black text-blue-650 dark:text-blue-400 block font-mono">
              {formatCurrency(kpis.totalIva)}
            </span>
          </div>
        </div>

        {/* Card 3 y 4: Desglose por Método de Pago */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CreditCard size={12} className="text-gray-450" />
            <span>Pagos por Método</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-mono">
            {Object.entries(kpis.metodoTotals).map(([metodo, subtotal]) => (
              <div key={metodo} className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 text-center">
                <span className="text-[9px] text-gray-500 block truncate">{metodo}</span>
                <span className="font-extrabold text-gray-800 dark:text-gray-200 block truncate">
                  {formatCurrency(subtotal)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABLA ──────────────────────────────────────────────────────────── */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[900px] text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="p-3">Fecha Emisión</th>
              <th className="p-3">UUID Fiscal</th>
              <th className="p-3">Proveedor / RFC</th>
              <th className="p-3">Método de Pago</th>
              <th className="p-3 min-w-[160px]">Clasificación</th>
              <th className="p-3 text-right">Importe</th>
              <th className="p-3 text-center">Archivos</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {visible.map((g) => (
              <tr key={g.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors group">

                {/* Fecha */}
                <td className="p-3 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {g.fecha_timbrado
                    ? new Date(g.fecha_timbrado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                    : new Date(g.fecha_gasto || '').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>

                {/* UUID */}
                <td className="p-3 font-mono">
                  <div className="text-gray-800 dark:text-gray-200 font-semibold tracking-tight">
                    {g.uuid_fiscal ? g.uuid_fiscal : <span className="text-gray-400 italic">N/A</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                    <span className="truncate max-w-[200px]">{g.concepto}</span>
                    {g.gasto_padre_id && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 uppercase">
                        Comprobante
                      </span>
                    )}
                    {g.es_deducible === false && !g.uuid_fiscal && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase">
                        Solo Ticket (No Deducible)
                      </span>
                    )}
                    {g.es_deducible === false && g.uuid_fiscal && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 uppercase" title="Inconsistencia detectada entre el pago del banco y la factura.">
                        ⚠️ Discrepancia Forma Pago
                      </span>
                    )}
                  </div>
                </td>

                {/* Proveedor */}
                <td className="p-3">
                  <div className="font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
                    {g.proveedores?.nombre_comercial || <span className="italic text-gray-400">Sin proveedor</span>}
                  </div>
                  {g.proveedores?.rfc && (
                    <div className="font-mono text-[10px] text-gray-400 mt-0.5">{g.proveedores.rfc}</div>
                  )}
                </td>

                {/* Método de pago — select inline */}
                <td className="p-3">
                  <div className="relative min-w-[120px]">
                    <CreditCard size={11} className="absolute left-2 top-2 text-gray-400 pointer-events-none" />
                    <select
                      value={g.metodo_pago || ''}
                      onChange={(e) => {
                        if (e.target.value === 'VER_TODOS') {
                          setVerTodos(true);
                          return;
                        }
                        onUpdateMetodoPago && onUpdateMetodoPago(g.id, e.target.value || null);
                      }}
                      className={`w-full pl-6 pr-2 py-1.5 rounded-lg border text-[11px] font-medium outline-none transition-all cursor-pointer
                        ${g.metodo_pago
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-400 italic'
                        }
                        focus:ring-1 focus:ring-emerald-500 hover:border-emerald-300 dark:hover:border-emerald-700`}
                    >
                      <option value="">Desconocido</option>
                      {formasPago.map(f => (
                        <option key={f.codigo || f.id} value={f.codigo || ''}>
                          {f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre}
                        </option>
                      ))}
                      {!verTodos && (
                        <option value="VER_TODOS">🔍 Mostrar todos los códigos SAT...</option>
                      )}
                      {verTodos && (
                        <>
                          <option disabled className="text-gray-400 font-bold border-t">--- Todos los Códigos SAT ---</option>
                          {SAT_FORMAS_PAGO.filter(sat => !formasPago.some(f => f.codigo === sat.codigo)).map(sat => (
                            <option key={sat.codigo} value={sat.codigo}>
                              {sat.codigo} - {sat.nombre}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </td>

                {/* Clasificación — select inline */}
                <td className="p-3">
                  <div className="relative">
                    <Tag size={11} className="absolute left-2 top-2 text-gray-400 pointer-events-none" />
                    <select
                      value={g.categoria_id || ''}
                      onChange={(e) => onUpdateCategoria(g.id, e.target.value || null)}
                      className={`w-full pl-6 pr-2 py-1.5 rounded-lg border text-[11px] font-medium outline-none transition-all cursor-pointer
                        ${g.categoria_id
                          ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-400 italic'
                        }
                        focus:ring-1 focus:ring-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-700`}
                    >
                      <option value="">Sin clasificar</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                </td>

                {/* Importe */}
                <td className="p-3 text-right font-mono whitespace-nowrap">
                  <div className="font-bold text-red-500 dark:text-red-400 text-sm">
                    -{formatCurrency(g.monto)}
                  </div>
                  {Number(g.iva_acreditable) > 0 ? (
                    <div className="text-[10px] text-gray-400 mt-0.5">IVA: {formatCurrency(g.iva_acreditable)}</div>
                  ) : g.subtotal && Number(g.monto) > Number(g.subtotal) ? (
                    <div className="text-[10px] text-gray-400 mt-0.5" title="IVA calculado (Monto - Subtotal)">
                      IVA: {formatCurrency(Number(g.monto) - Number(g.subtotal))}
                    </div>
                  ) : g.uuid_fiscal ? (
                    <div className="text-[10px] text-gray-400 mt-0.5" title="IVA estimado (16%)">
                      IVA: {formatCurrency(Number(g.monto) - (Number(g.monto) / 1.16))}
                    </div>
                  ) : null}
                </td>

                {/* Archivos */}
                <td className="p-3">
                  <div className="flex gap-1 justify-center flex-wrap">
                    {g.xml_url && g.xml_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={`Descargar XML${arr.length > 1 ? ` ${idx + 1}` : ''}`}
                        className="p-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500 flex items-center gap-0.5"
                      >
                        <FileCode size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}
                    {g.pdf_url && g.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={`Descargar PDF${arr.length > 1 ? ` ${idx + 1}` : ''}`}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                      >
                        <FileText size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}
                    {g.xml_url && onViewCfdi && (
                      <button
                        onClick={() => onViewCfdi(g.xml_url!.split(',')[0])}
                        title="Ver representación impresa del XML"
                        className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded border border-indigo-200 dark:border-indigo-900/50 text-indigo-600 flex items-center gap-0.5"
                      >
                        <Eye size={13} />
                      </button>
                    )}
                    {g.ticket_url && g.ticket_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={`Descargar Ticket${arr.length > 1 ? ` ${idx + 1}` : ''}`}
                        className="p-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-900/50 text-amber-600 flex items-center gap-0.5"
                      >
                        <CreditCard size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}
                    {!g.xml_url && !g.pdf_url && !g.ticket_url && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600 italic">Sin archivos</span>
                    )}
                    <button 
                      onClick={() => setManualModal({isOpen: true, id: g.id})} 
                      className="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-1.5 rounded-lg transition-colors" 
                      title="Añadir Documentos Faltantes"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </td>

                {/* Acciones */}
                <td className="p-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => onEditGasto(g)}
                      disabled={!!g.movimiento_bancario_id}
                      title={g.movimiento_bancario_id ? "No se puede editar porque está conciliado" : "Editar"}
                      className={`p-1.5 rounded transition-colors ${g.movimiento_bancario_id ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteGasto(g.id)}
                      disabled={!!g.movimiento_bancario_id}
                      title={g.movimiento_bancario_id ? "No se puede eliminar porque está conciliado" : "Eliminar"}
                      className={`p-1.5 rounded transition-colors ${g.movimiento_bancario_id ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                  {filtrados.length === 0 && (search || filtroMetodo || filtroCategoria)
                    ? 'No se encontraron registros con los filtros aplicados.'
                    : 'No hay gastos facturados registrados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── PAGINACIÓN ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Filas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>
            {filtrados.length > 0
              ? `${pagina * pageSize + 1}–${Math.min((pagina + 1) * pageSize, filtrados.length)} de ${filtrados.length}`
              : '0 registros'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={pagina === 0}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-gray-500"
          >
            «
          </button>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
            {pagina + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={pagina >= totalPages - 1}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={pagina >= totalPages - 1}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-bold text-gray-500"
          >
            »
          </button>
        </div>
      
      
      {manualModal.isOpen && (
        <CargaManualModal
          tipo="gasto"
          registroId={manualModal.id}
          onClose={() => setManualModal({isOpen: false})}
          onSuccess={() => {
            setManualModal({isOpen: false});
            if (onRefresh) onRefresh();
            else window.location.reload();
          }}
        />
      )}
      {showXmlModal && (
        <CargaXmlMasivaModal
          tipo="gasto"
          onClose={() => {
            setShowXmlModal(false);
            if (onRefresh) onRefresh();
            else window.location.reload();
          }}
          onSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
</div>
    </div>
  );
}
