'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/EgresosTab.tsx
// Tab de Egresos/Gastos facturados — con paginación, búsqueda, columnas enriquecidas y clasificación inline.

import React, { useState, useMemo } from 'react';
import { UploadCloud, Plus, FileCode, FileText, CreditCard, Search, ChevronLeft, ChevronRight, Tag, Filter, Eye, Trash2, Edit3, Link as LinkIcon, SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import CargaXmlMasivaModal from './CargaXmlMasivaModal';
import CargaManualModal from './CargaManualModal';
import type { GastoFacturado, CategoriaGasto } from '../../types';
import { SAT_FORMAS_PAGO, getMetodoPagoLabel } from '../../../../lib/constants/sat';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import { supabase } from '../../../../lib/supabase';

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
  onViewConciliacion?: (gasto: GastoFacturado) => void;
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
  onViewConciliacion,
}: EgresosTabProps) {
  const { openCfdi } = useCfdiViewer();
  const handleViewCfdi = onViewCfdi || openCfdi;

  // Paginación
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sincronizando, setSincronizando] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Expansión de parcialidades (hijos)
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const toggleParentExpand = (id: string) => {
    setExpandedParents(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Modal para asociar a gasto principal
  const [associationModal, setAssociationModal] = useState<{
    isOpen: boolean;
    childGasto: GastoFacturado | null;
    searchParent: string;
    parentGastoId: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    childGasto: null,
    searchParent: '',
    parentGastoId: null,
    loading: false
  });

  const handleSaveAssociation = async () => {
    if (!associationModal.childGasto || !associationModal.parentGastoId) return;
    setAssociationModal(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase
        .from('gastos')
        .update({ gasto_padre_id: associationModal.parentGastoId })
        .eq('id', associationModal.childGasto.id);

      if (error) throw error;

      alert('Asociación realizada con éxito.');
      setAssociationModal({
        isOpen: false,
        childGasto: null,
        searchParent: '',
        parentGastoId: null,
        loading: false
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch (err: any) {
      alert(`Error al asociar gasto: ${err.message}`);
    } finally {
      setAssociationModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRemoveAssociation = async () => {
    if (!associationModal.childGasto) return;
    if (!confirm('¿Estás seguro de desvincular esta parcialidad/complemento de su gasto principal?')) return;
    setAssociationModal(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase
        .from('gastos')
        .update({ gasto_padre_id: null })
        .eq('id', associationModal.childGasto.id);

      if (error) throw error;

      alert('Desvinculación realizada con éxito.');
      setAssociationModal({
        isOpen: false,
        childGasto: null,
        searchParent: '',
        parentGastoId: null,
        loading: false
      });
      if (onRefresh) onRefresh();
      else window.location.reload();
    } catch (err: any) {
      alert(`Error al desasociar gasto: ${err.message}`);
    } finally {
      setAssociationModal(prev => ({ ...prev, loading: false }));
    }
  };

  const parentCandidates = useMemo(() => {
    if (!associationModal.childGasto) return [];
    const child = associationModal.childGasto;
    return gastosFacturados.filter(g => {
      // Excluir el mismo gasto
      if (g.id === child.id) return false;
      // Excluir si ya es hijo de otro
      if (g.gasto_padre_id) return false;
      
      // Aplicar filtro de búsqueda
      if (associationModal.searchParent) {
        const s = associationModal.searchParent.toLowerCase();
        const conceptoMatch = g.concepto?.toLowerCase().includes(s);
        const uuidMatch = g.uuid_fiscal?.toLowerCase().includes(s);
        const rfcMatch = g.proveedores?.rfc?.toLowerCase().includes(s);
        const provMatch = g.proveedores?.nombre_comercial?.toLowerCase().includes(s);
        const montoMatch = g.monto?.toString().includes(s);
        return conceptoMatch || uuidMatch || rfcMatch || provMatch || montoMatch;
      }
      return true;
    }).slice(0, 15);
  }, [gastosFacturados, associationModal.childGasto, associationModal.searchParent]);

  // Mapa de hijos por id de padre
  const hijosMap = useMemo(() => {
    const map = new Map<string, GastoFacturado[]>();
    gastosFacturados.forEach(g => {
      if (g.gasto_padre_id) {
        const list = map.get(g.gasto_padre_id) || [];
        list.push(g);
        map.set(g.gasto_padre_id, list);
      }
    });
    return map;
  }, [gastosFacturados]);

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
  const [categoriasSelected, setCategoriasSelected] = useState<string[]>([]);
  const [verTodos, setVerTodos] = useState(false);
  const [verTodosFiltro, setVerTodosFiltro] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filtros Checkbox tipo Excel
  const [filtrosEstatus, setFiltrosEstatus] = useState({
    conciliado: true,
    sin_conciliar: true,
    con_ticket: true,
    sin_documento: true,
    no_lleva_ticket: true,
    deducible: true,
    no_deducible: true
  });

  // Filtrado
  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    const result = gastosFacturados.filter((g) => {
      // Ocultar de la lista principal si es un gasto hijo (parcialidad)
      if (g.gasto_padre_id) return false;

      // Generar string de fecha legible para buscar por fecha
      const dateVal = g.fecha_timbrado || g.fecha_gasto || '';
      const dateStr = dateVal ? new Date(dateVal).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
      const dateStrLtr = dateVal ? new Date(dateVal).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase() : '';

      const matchSearch = !q || (
        g.uuid_fiscal?.toLowerCase().includes(q) ||
        g.concepto?.toLowerCase().includes(q) ||
        g.proveedores?.nombre_comercial?.toLowerCase().includes(q) ||
        g.proveedores?.rfc?.toLowerCase().includes(q) ||
        g.monto?.toString().includes(q) ||
        g.subtotal?.toString().includes(q) ||
        dateStr.includes(q) ||
        dateStrLtr.includes(q)
      );
      const matchMetodo = !filtroMetodo || g.metodo_pago === filtroMetodo;
      const matchCat = categoriasSelected.length === 0 || 
        (categoriasSelected.includes('sin_categoria') && !g.categoria_id) || 
        (g.categoria_id && categoriasSelected.includes(g.categoria_id));

      // Filtros Checkbox Estado
      const esConciliado = !!g.movimiento_bancario_id;
      if (!filtrosEstatus.conciliado && esConciliado) return false;
      if (!filtrosEstatus.sin_conciliar && !esConciliado) return false;
      
      // Con Documentos separados (XML vs Ticket vs Sin Doc)
      const tieneXml = !!g.xml_url || !!g.uuid_fiscal;
      const tieneTicket = !!g.ticket_url && g.ticket_url !== 'no_lleva';
      const noLlevaTicket = g.ticket_url === 'no_lleva';
      const tienePdf = !!g.pdf_url;
      const sinDocumento = !tieneXml && !tieneTicket && !tienePdf && !noLlevaTicket;
      
      if (!filtrosEstatus.con_ticket && tieneTicket) return false;
      if (!filtrosEstatus.sin_documento && sinDocumento) return false;
      if (!filtrosEstatus.no_lleva_ticket && noLlevaTicket) return false;

      // Filtros de Deducibilidad
      const esDeducibleGasto = g.es_deducible !== false;
      if (!filtrosEstatus.deducible && esDeducibleGasto) return false;
      if (!filtrosEstatus.no_deducible && !esDeducibleGasto) return false;

      return matchSearch && matchMetodo && matchCat;
    });

    // Ordenar por fecha
    result.sort((a, b) => {
      const dateA = new Date(a.fecha_timbrado || a.fecha_gasto || 0).getTime();
      const dateB = new Date(b.fecha_timbrado || b.fecha_gasto || 0).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [gastosFacturados, search, filtroMetodo, categoriasSelected, filtrosEstatus, sortDirection]);

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
          </div>
          <button
            onClick={() => {
              setSearch('');
              setFiltroMetodo('');
              setCategoriasSelected([]);
              setFiltrosEstatus({
                conciliado: true,
                sin_conciliar: true,
                con_ticket: true,
                sin_documento: true,
                no_lleva_ticket: true,
                deducible: true,
                no_deducible: true
              });
              resetPage();
            }}
            className="px-3.5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all shrink-0 shadow-sm"
          >
            Restablecer Filtros
          </button>
          <button
            onClick={() => setShowAdvancedFilters(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm flex items-center gap-1.5 ${
              showAdvancedFilters 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal size={13} /> {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}
          </button>
        </div>

        {/* Fila 3: Grid de Checklists de Filtro (Estilo Conciliación) */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-1 duration-200">
            
            {/* Estatus Conciliación */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Estatus Conciliación</span>
              <div className="space-y-1.5 flex-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.conciliado}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, conciliado: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Conciliados</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.sin_conciliar}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_conciliar: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Sin Conciliar</span>
                </label>
              </div>
            </div>

            {/* Deducibilidad */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Deducibilidad</span>
              <div className="space-y-1.5 flex-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.deducible}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, deducible: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Deducibles</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.no_deducible}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, no_deducible: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-650 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>No Deducibles</span>
                </label>
              </div>
            </div>

            {/* Documentos */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Documentos</span>
              <div className="space-y-1.5 flex-1 max-h-24 overflow-y-auto pr-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.con_ticket}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, con_ticket: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Con Ticket</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.sin_documento}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_documento: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-indigo-650 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Sin Documento</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.no_lleva_ticket}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, no_lleva_ticket: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-indigo-650 focus:ring-indigo-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>No Lleva Ticket</span>
                </label>
              </div>
            </div>

            {/* Categoría */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Categoría de Gasto</span>
              <div className="space-y-1.5 flex-1 max-h-24 overflow-y-auto pr-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={categoriasSelected.includes('sin_categoria')}
                    onChange={(chk) => {
                      const newCats = chk.target.checked ? [...categoriasSelected, 'sin_categoria'] : categoriasSelected.filter(c => c !== 'sin_categoria');
                      setCategoriasSelected(newCats);
                      resetPage();
                    }}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span className="italic text-gray-400 dark:text-gray-550">Sin Categoría</span>
                </label>
                {categorias.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={categoriasSelected.includes(c.id)}
                      onChange={(chk) => {
                        const newCats = chk.target.checked ? [...categoriasSelected, c.id] : categoriasSelected.filter(cs => cs !== c.id);
                        setCategoriasSelected(newCats);
                        resetPage();
                      }}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                    />
                    <span>{c.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>



      {/* ── TABLA ──────────────────────────────────────────────────────────── */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[900px] text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th 
                className="p-3 cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                Fecha Emisión {sortDirection === 'asc' ? '▲' : '▼'}
              </th>
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
            {visible.map((g) => {
              const hijos = hijosMap.get(g.id) || [];
              const hasHijos = hijos.length > 0;
              const isExpanded = !!expandedParents[g.id];

              return (
                <React.Fragment key={g.id}>
                  <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors group">

                    {/* Fecha */}
                    <td className="p-3 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {hasHijos && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleParentExpand(g.id);
                            }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-all text-gray-500 hover:text-indigo-600"
                            title={isExpanded ? "Contraer parcialidades" : "Mostrar parcialidades"}
                          >
                            <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90 text-indigo-500 font-bold' : 'text-gray-400'}`} />
                          </button>
                        )}
                        <span>
                          {g.fecha_timbrado
                            ? new Date(g.fecha_timbrado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                            : new Date(g.fecha_gasto || '').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    </td>

                    {/* UUID */}
                    <td className="p-3 font-mono">
                      <div className="text-gray-800 dark:text-gray-200 font-semibold tracking-tight">
                        {g.uuid_fiscal ? g.uuid_fiscal : <span className="text-gray-400 italic">N/A</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                        <span className="truncate max-w-[200px]">{g.concepto}</span>
                        {g.gasto_padre_id && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 uppercase"
                            title={g.padre?.concepto ? `Gasto Principal: ${g.padre.concepto}` : 'Parcialidad / Complemento'}
                          >
                            Parcialidad {g.padre?.concepto ? `de: ${g.padre.concepto.substring(0, 15)}...` : ''}
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
                        {hasHijos && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 uppercase">
                            {hijos.length} {hijos.length === 1 ? 'Parcialidad' : 'Parcialidades'}
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
                        {g.xml_url && handleViewCfdi && (
                          <button
                            onClick={() => handleViewCfdi(g.xml_url!.split(',')[0])}
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
                        {onViewConciliacion && (
                          <button
                            onClick={() => onViewConciliacion(g)}
                            title="Ver Conciliación"
                            className="p-1.5 rounded text-blue-500 hover:text-blue-650 hover:bg-blue-55/50 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setAssociationModal({
                            isOpen: true,
                            childGasto: g,
                            searchParent: '',
                            parentGastoId: g.gasto_padre_id || null,
                            loading: false
                          })}
                          title="Vincular a Gasto Principal / Parcialidad"
                          className="p-1.5 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                          <LinkIcon size={14} />
                        </button>
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

                  {/* Renderizar parcialidades/hijos anidados */}
                  {hasHijos && isExpanded && hijos.map(h => (
                    <tr key={h.id} className="bg-indigo-50/10 dark:bg-indigo-950/5 border-l-4 border-indigo-400 dark:border-indigo-600 transition-colors">
                      {/* Fecha */}
                      <td className="p-3 pl-8 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {h.fecha_timbrado
                          ? new Date(h.fecha_timbrado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                          : new Date(h.fecha_gasto || '').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>

                      {/* UUID / Detalle */}
                      <td className="p-3 font-mono">
                        <div className="text-gray-600 dark:text-gray-400 font-semibold tracking-tight">
                          {h.uuid_fiscal ? h.uuid_fiscal : <span className="text-gray-400 italic">N/A</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap">
                          <span className="truncate max-w-[200px]">{h.concepto}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-100/60 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 uppercase">
                            Parcialidad / REP
                          </span>
                        </div>
                      </td>

                      {/* Proveedor */}
                      <td className="p-3 text-gray-500 dark:text-gray-450">
                        <div className="truncate max-w-[180px]">
                          {h.proveedores?.nombre_comercial || <span className="italic text-gray-400">—</span>}
                        </div>
                      </td>

                      {/* Método de pago */}
                      <td className="p-3">
                        <MetodoBadge metodo={h.metodo_pago} />
                      </td>

                      {/* Clasificación */}
                      <td className="p-3 text-gray-500 dark:text-gray-450 italic">
                        {categorias.find(c => c.id === h.categoria_id)?.nombre || 'Sin clasificar'}
                      </td>

                      {/* Importe */}
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-gray-600 dark:text-gray-400 text-xs">
                          -{formatCurrency(h.monto)}
                        </div>
                      </td>

                      {/* Archivos */}
                      <td className="p-3">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {h.xml_url && h.xml_url.split(',').filter(Boolean).map((url, idx, arr) => (
                            <button
                              key={idx}
                              onClick={() => onDownloadFile(url)}
                              title={`Descargar XML${arr.length > 1 ? ` ${idx + 1}` : ''}`}
                              className="p-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500 flex items-center gap-0.5"
                            >
                              <FileCode size={12} />
                              {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                            </button>
                          ))}
                          {h.pdf_url && h.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                            <button
                              key={idx}
                              onClick={() => onDownloadFile(url)}
                              title={`Descargar PDF${arr.length > 1 ? ` ${idx + 1}` : ''}`}
                              className="p-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                            >
                              <FileText size={12} />
                              {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                            </button>
                          ))}
                          {h.ticket_url && h.ticket_url.split(',').filter(Boolean).map((url, idx, arr) => (
                            <button
                              key={idx}
                              onClick={() => onDownloadFile(url)}
                              title={`Descargar Ticket${arr.length > 1 ? ` ${idx + 1}` : ''}`}
                              className="p-1 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-900/50 text-amber-600 flex items-center gap-0.5"
                            >
                              <CreditCard size={12} />
                              {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                            </button>
                          ))}
                          <button 
                            onClick={() => setManualModal({isOpen: true, id: h.id})} 
                            className="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-1 rounded-lg transition-colors" 
                            title="Añadir Documentos Faltantes"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          {onViewConciliacion && (
                            <button
                              onClick={() => onViewConciliacion(h)}
                              title="Ver Conciliación"
                              className="p-1 rounded text-blue-500 hover:text-blue-650 hover:bg-blue-55/50 dark:hover:bg-blue-900/30 transition-colors"
                            >
                              <Eye size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setAssociationModal({
                              isOpen: true,
                              childGasto: h,
                              searchParent: '',
                              parentGastoId: h.gasto_padre_id || null,
                              loading: false
                            })}
                            title="Vincular a Gasto Principal / Parcialidad"
                            className="p-1 rounded text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                          >
                            <LinkIcon size={12} />
                          </button>
                          <button
                            onClick={() => onEditGasto(h)}
                            disabled={!!h.movimiento_bancario_id}
                            title={h.movimiento_bancario_id ? "No se puede editar porque está conciliado" : "Editar"}
                            className={`p-1 rounded transition-colors ${h.movimiento_bancario_id ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => onDeleteGasto(h.id)}
                            disabled={!!h.movimiento_bancario_id}
                            title={h.movimiento_bancario_id ? "No se puede eliminar porque está conciliado" : "Eliminar"}
                            className={`p-1 rounded transition-colors ${h.movimiento_bancario_id ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                  {filtrados.length === 0 && (search || filtroMetodo || categoriasSelected.length > 0 || Object.values(filtrosEstatus).some(val => !val))
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

      {associationModal.isOpen && associationModal.childGasto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-950 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-800">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-955 sticky top-0 z-10">
              <div>
                <h3 className="text-base font-extrabold text-gray-955 dark:text-white flex items-center gap-2">
                  <LinkIcon className="text-indigo-500" size={18} />
                  Asociar a Gasto Principal
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Establece este comprobante/REP como parcialidad de otra factura.
                </p>
              </div>
              <button 
                onClick={() => setAssociationModal({ isOpen: false, childGasto: null, searchParent: '', parentGastoId: null, loading: false })}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Plus className="rotate-45" size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              
              {/* Información del Gasto Seleccionado */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-850 rounded-xl space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-gray-400 dark:text-gray-500 tracking-wider block">Gasto Seleccionado (Hijo)</span>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">{associationModal.childGasto.concepto}</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">UUID: {associationModal.childGasto.uuid_fiscal || 'Sin UUID'}</p>
                    {associationModal.childGasto.proveedores && (
                      <p className="text-[10px] text-gray-500 mt-1 font-semibold">{associationModal.childGasto.proveedores.nombre_comercial} ({associationModal.childGasto.proveedores.rfc})</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-red-500 dark:text-red-400 block">-{formatCurrency(associationModal.childGasto.monto)}</span>
                    <span className="text-[10px] text-gray-400 font-mono block mt-0.5">{associationModal.childGasto.fecha_timbrado ? new Date(associationModal.childGasto.fecha_timbrado).toLocaleDateString() : new Date(associationModal.childGasto.fecha_gasto || '').toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Input de Búsqueda de Padre */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Buscar Factura Principal (Padre)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                  <input
                    type="text"
                    placeholder="Filtrar por concepto, monto, UUID o proveedor..."
                    value={associationModal.searchParent}
                    onChange={(e) => setAssociationModal(prev => ({ ...prev, searchParent: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Lista de Candidatos */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Seleccionar del Listado</label>
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-850">
                  {parentCandidates.map(p => {
                    const isSelected = associationModal.parentGastoId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setAssociationModal(prev => ({ ...prev, parentGastoId: p.id }))}
                        className={`p-3 text-xs flex justify-between items-center cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-2 border-indigo-500 font-bold' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
                        }`}
                      >
                        <div className="space-y-0.5 max-w-[70%]">
                          <p className="text-gray-800 dark:text-gray-200 truncate">{p.concepto}</p>
                          <p className="text-[10px] text-gray-400 truncate font-mono">UUID: {p.uuid_fiscal?.substring(0, 8)}...</p>
                          <p className="text-[10px] text-gray-500 font-semibold">{p.proveedores?.nombre_comercial}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-gray-955 dark:text-white">-{formatCurrency(p.monto)}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{p.fecha_timbrado ? new Date(p.fecha_timbrado).toLocaleDateString() : new Date(p.fecha_gasto || '').toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  {parentCandidates.length === 0 && (
                    <p className="p-4 text-center text-xs text-gray-400 italic bg-gray-50/50 dark:bg-gray-900/20">No se encontraron facturas candidatas</p>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 dark:border-gray-900 flex justify-between gap-3 bg-gray-50 dark:bg-gray-900/10">
              <div>
                {associationModal.childGasto.gasto_padre_id && (
                  <button
                    type="button"
                    onClick={handleRemoveAssociation}
                    disabled={associationModal.loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                  >
                    Desvincular
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssociationModal({ isOpen: false, childGasto: null, searchParent: '', parentGastoId: null, loading: false })}
                  disabled={associationModal.loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssociation}
                  disabled={associationModal.loading || !associationModal.parentGastoId}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
                >
                  {associationModal.loading ? 'Guardando...' : 'Confirmar Asociación'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
</div>
    </div>
  );
}
