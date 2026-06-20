'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/EgresosTab.tsx
// Tab de Egresos/Gastos facturados — con paginación, búsqueda, columnas enriquecidas y clasificación inline.

import React, { useState, useMemo } from 'react';
import { UploadCloud, Plus, FileCode, FileText, CreditCard, Search, ChevronLeft, ChevronRight, Tag, Filter, Eye } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import CargaXmlMasivaModal from './CargaXmlMasivaModal';
import CargaManualModal from './CargaManualModal';
import type { GastoFacturado, CategoriaGasto } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EgresosTabProps {
  gastosFacturados: GastoFacturado[];
  categorias: CategoriaGasto[];
  onOpenComprobacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
  onUpdateCategoria: (gastoId: string, categoriaId: string | null) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const METODO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  Efectivo:      { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Efectivo' },
  Transferencia: { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     label: 'Transferencia' },
  Tarjeta:       { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', label: 'Tarjeta' },
  Cheque:        { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   label: 'Cheque' },
};

function MetodoBadge({ metodo }: { metodo?: string }) {
  if (!metodo) return <span className="text-gray-400 text-[10px] italic">—</span>;
  const style = METODO_BADGE[metodo] ?? { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300', label: metodo };
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
  onOpenComprobacionAcumulada,
  onDownloadFile,
  onViewCfdi,
  onUpdateCategoria,
}: EgresosTabProps) {

  // Paginación
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Búsqueda y filtros
  const [search, setSearch] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Filtrado
  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return gastosFacturados.filter((g) => {
      const matchSearch = !q || (
        g.uuid_fiscal?.toLowerCase().includes(q) ||
        g.concepto?.toLowerCase().includes(q) ||
        g.proveedores?.nombre_comercial?.toLowerCase().includes(q) ||
        g.proveedores?.rfc?.toLowerCase().includes(q)
      );
      const matchMetodo = !filtroMetodo || g.metodo_pago === filtroMetodo;
      const matchCat = !filtroCategoria || g.categoria_id === filtroCategoria || (!g.categoria_id && filtroCategoria === '__sin__');
      return matchSearch && matchMetodo && matchCat;
    });
  }, [gastosFacturados, search, filtroMetodo, filtroCategoria]);

  // Paginado
  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const pagina = Math.min(page, totalPages - 1);
  const visible = filtrados.slice(pagina * pageSize, (pagina + 1) * pageSize);

  const resetPage = () => setPage(0);

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
              onClick={() => setShowXmlModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <UploadCloud size={13} /> Subir Facturas (XML)
            </button>
          </div>
            <button
              onClick={onOpenComprobacionAcumulada}

            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus size={13} /> Comprobación Acumulada
          </button>
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
              onChange={(e) => { setFiltroMetodo(e.target.value); resetPage(); }}
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs px-2.5 py-2 outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todos los pagos</option>
              {Object.keys(METODO_BADGE).map(m => <option key={m} value={m}>{m}</option>)}
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
                  <div className="text-gray-800 dark:text-gray-200 font-semibold tracking-tight" title={g.uuid_fiscal}>
                    {g.uuid_fiscal ? g.uuid_fiscal.substring(0, 20) + '…' : <span className="text-gray-400 italic">N/A</span>}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                    <span className="truncate max-w-[200px]">{g.concepto}</span>
                    {g.gasto_padre_id && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 uppercase">
                        Comprobante
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

                {/* Método de pago */}
                <td className="p-3">
                  <MetodoBadge metodo={g.metodo_pago} />
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
                  {g.iva_acreditable ? (
                    <div className="text-[10px] text-gray-400 mt-0.5">IVA: {formatCurrency(g.iva_acreditable)}</div>
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
                    {!g.pdf_url && g.xml_url && onViewCfdi && (
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
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-400 italic">
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
            window.location.reload();
          }}
        />
      )}
      {showXmlModal && (
        <CargaXmlMasivaModal
          tipo="gasto"
          onClose={() => setShowXmlModal(false)}
          onSuccess={() => {
            setShowXmlModal(false);
            window.location.reload();
          }}
        />
      )}
</div>
    </div>
  );
}
