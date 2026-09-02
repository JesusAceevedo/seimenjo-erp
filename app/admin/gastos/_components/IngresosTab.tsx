'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/IngresosTab.tsx
// Tab de Ingresos (Ventas) — con paginación, búsqueda, columnas enriquecidas.

import React, { useState, useMemo, useEffect } from 'react';
import { UploadCloud, Plus, FileCode, FileText, CreditCard, Mail, Search, ChevronLeft, ChevronRight, CheckCircle, Clock, Eye, Edit3, Trash2, Activity, Link as LinkIcon, SlidersHorizontal, Globe, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import { getMetodoPagoLabel } from '../../../../lib/constants/sat';
import CargaXmlMasivaModal from './CargaXmlMasivaModal';
import CargaManualModal from './CargaManualModal';
import TrayectoriaPedidoModal from './TrayectoriaPedidoModal';
import VincularXmlPedidoModal from './VincularXmlPedidoModal';
import AsignacionXmlModal from './AsignacionXmlModal';
import { vincularFacturaAPedido } from '../actions';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { supabase } from '../../../../lib/supabase';
import type { VentaFacturada } from '../../types';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';

// ── Props ─────────────────────────────────────────────────────────────────────

interface IngresosTabProps {
  ventasFacturadas: VentaFacturada[];
  empresaRfc?: string | null;
  onOpenFacturacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
  onSendEmail: (pedidoId: string) => void;
  onEditVenta: (venta: VentaFacturada) => void;
  onDeleteVenta: (pedidoId: string) => void;
  onDeleteFacturaSuelta?: (facturaId: string) => void;
  onRefresh?: () => void;
  selectedMonth?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getInvoiceForVenta(v: VentaFacturada, allVentas: VentaFacturada[]) {
  if (v.facturas_clientes && v.facturas_clientes.length > 0) {
    return v.facturas_clientes[0];
  }
  if (v.folio_factura) {
    const folioClean = v.folio_factura.trim().toLowerCase();
    for (const other of allVentas) {
      if (other.facturas_clientes && other.facturas_clientes.length > 0) {
        const found = other.facturas_clientes.find(f => 
          (f.serie_folio && f.serie_folio.trim().toLowerCase() === folioClean) ||
          (f.uuid_fiscal && f.uuid_fiscal.toLowerCase().includes(folioClean))
        );
        if (found) return found;
      }
    }
  }
  return null;
}

function EstatusFacturaBadge({ v, invoice }: { v: VentaFacturada; invoice?: any }) {
  const hasInvoice = !!invoice || (v.facturas_clientes && v.facturas_clientes.length > 0) || !!v.folio_factura;
  if (hasInvoice) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
        <CheckCircle size={9} /> Facturado
      </span>
    );
  }
  if (v.estatus_pago === 'Liquidado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        <Clock size={9} /> Pend. Facturar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
      No liquidado
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function IngresosTab({
  ventasFacturadas,
  empresaRfc,
  onOpenFacturacionAcumulada,
  onDownloadFile,
  onViewCfdi,
  onSendEmail,
  onEditVenta,
  onDeleteVenta,
  onDeleteFacturaSuelta,
  onRefresh,
  selectedMonth,
}: IngresosTabProps) {
  const { openCfdi } = useCfdiViewer();
  const handleViewCfdi = onViewCfdi || openCfdi;

  const [showXmlModal, setShowXmlModal] = useState(false);
  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});
  const [selectedTrayectoriaId, setSelectedTrayectoriaId] = useState<string | null>(null);
  const [vincularModalPedidoId, setVincularModalPedidoId] = useState<string | null>(null);
  const [vincularSueltaFactura, setVincularSueltaFactura] = useState<any | null>(null);
  const [showAsignacionModal, setShowAsignacionModal] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filtrosEstatus, setFiltrosEstatus] = useState({
    conciliado: true,
    sin_conciliar: true,
    facturado: true,
    pendiente_facturar: true,
    no_liquidado: true,
    con_xml: true,
    sin_xml: true,
    con_ticket: true,
    sin_ticket: true,
    solo_pg: false
  });

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return ventasFacturadas.filter((v) => {
      const invoice = getInvoiceForVenta(v, ventasFacturadas);
      const totalAmount = Number(v.precio_total || 0);

      const matchSearch = !q || (
        (invoice?.uuid_fiscal?.toLowerCase().includes(q)) ||
        (invoice?.serie_folio?.toLowerCase().includes(q)) ||
        (v.folio_factura?.toLowerCase().includes(q)) ||
        v.numero_pedido?.toString().includes(q) ||
        v.clientes?.nombre_local?.toLowerCase().includes(q) ||
        v.clientes?.rfc?.toLowerCase().includes(q) ||
        v.cliente_nombre?.toLowerCase().includes(q) ||
        totalAmount.toString().includes(q)
      );

      // Estatus Conciliación
      const esConciliado = !!v.movimiento_bancario_id;
      if (!filtrosEstatus.conciliado && esConciliado) return false;
      if (!filtrosEstatus.sin_conciliar && !esConciliado) return false;

      // Estatus Factura
      const hasInvoice = !!invoice || (v.facturas_clientes && v.facturas_clientes.length > 0) || !!v.folio_factura;
      const esPendienteFacturar = !hasInvoice && v.estatus_pago === 'Liquidado';
      const esNoLiquidado = !hasInvoice && v.estatus_pago !== 'Liquidado';

      if (!filtrosEstatus.facturado && hasInvoice) return false;
      if (!filtrosEstatus.pendiente_facturar && esPendienteFacturar) return false;
      if (!filtrosEstatus.no_liquidado && esNoLiquidado) return false;

      // Estatus Documentación
      const tieneXml = invoice && !!invoice.xml_url;
      const tieneTicket = invoice && !!invoice.ticket_url && invoice.ticket_url !== 'no_lleva';

      if (!filtrosEstatus.con_xml && tieneXml) return false;
      if (!filtrosEstatus.sin_xml && !tieneXml) return false;
      if (!filtrosEstatus.con_ticket && tieneTicket) return false;
      if (!filtrosEstatus.sin_ticket && !tieneTicket) return false;

      // Filtro Bolsa Público en General
      const isPublicoGeneral = !!v.clientes?.facturar_publico_general || !!v.clientes?.es_anonimo || !v.cliente_id || (v.cliente_nombre || '').toLowerCase().includes('ocasional') || (v.cliente_nombre || '').toLowerCase().includes('público');
      if (filtrosEstatus.solo_pg && !isPublicoGeneral) return false;

      return matchSearch;
    });
  }, [ventasFacturadas, search, filtrosEstatus]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const pagina = Math.min(page, totalPages - 1);
  const visible = filtrados.slice(pagina * pageSize, (pagina + 1) * pageSize);
  const resetPage = () => setPage(0);

  // Calcular KPIs acumulados (Ventas e IVA)
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

    const publicoGeneral = { total: 0, count: 0 };

    filtrados.forEach((v) => {
      const totalAmount = Number(v.precio_total || 0);
      const ivaAmount = totalAmount - (totalAmount / 1.16);

      totalMonto += totalAmount;
      totalIva += ivaAmount;

      const isPG = !!v.clientes?.facturar_publico_general || !!v.clientes?.es_anonimo || !v.cliente_id || (v.cliente_nombre || '').toLowerCase().includes('ocasional') || (v.cliente_nombre || '').toLowerCase().includes('público');
      if (isPG) {
        publicoGeneral.total += totalAmount;
        publicoGeneral.count++;
      }

      const metodo = ((v as any).metodo_pago || '').toLowerCase();
      if (metodo === '01' || metodo.includes('efectivo')) {
        metodoTotals.Efectivo += totalAmount;
      } else if (metodo === '03' || metodo.includes('transferencia')) {
        metodoTotals.Transferencia += totalAmount;
      } else if (metodo === '04' || metodo === '28' || metodo.includes('tarjeta')) {
        metodoTotals.Tarjeta += totalAmount;
      } else if (metodo === '02' || metodo.includes('cheque')) {
        metodoTotals.Cheque += totalAmount;
      } else {
        metodoTotals.Otros += totalAmount;
      }
    });

    return {
      totalMonto,
      totalIva,
      metodoTotals,
      publicoGeneral
    };
  }, [filtrados]);

  return (
    <div className="flex flex-col flex-1 font-sans min-h-0 overflow-hidden">

      {/* ── BARRA DE ACCIONES + FILTROS ────────────────────────────────────── */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ingresos y Ventas</span>
            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {filtrados.length} registros
            </span>
          </div>
          
          <div className="flex gap-2">
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
              onClick={onOpenFacturacionAcumulada}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus size={13} /> Facturación Acumulada
            </button>
            <button
              type="button"
              onClick={() => setShowAsignacionModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              title="Asignar facturas XML a pedidos por coincidencia de importe"
            >
              <LinkIcon size={13} /> Asignar XML a Pedidos
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por UUID, folio, cliente, RFC, pedido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="w-full pl-8 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => {
              setSearch('');
              setFiltrosEstatus({
                conciliado: true,
                sin_conciliar: true,
                facturado: true,
                pendiente_facturar: true,
                no_liquidado: true,
                con_xml: true,
                sin_xml: true,
                con_ticket: true,
                sin_ticket: true,
                solo_pg: false
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
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <SlidersHorizontal size={13} /> {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}
          </button>
        </div>

        {/* Grid de Checklists de Filtro */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-1 duration-200">
            
            {/* Estatus Conciliación */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Estatus Conciliación</span>
              <div className="space-y-1.5 flex-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.conciliado}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, conciliado: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Conciliados</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.sin_conciliar}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_conciliar: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Sin Conciliar</span>
                </label>
              </div>
            </div>

            {/* Estatus Factura */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Estatus Factura</span>
              <div className="space-y-1.5 flex-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.facturado}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, facturado: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Facturados</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.pendiente_facturar}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, pendiente_facturar: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Pendientes de Facturar</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.no_liquidado}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, no_liquidado: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Sin Liquidar</span>
                </label>
              </div>
            </div>

            {/* Documentación */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Documentos</span>
              <div className="space-y-1.5 flex-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.con_xml}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, con_xml: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Con XML</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.sin_xml}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_xml: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Sin XML</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.con_ticket}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, con_ticket: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Con Ticket</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.sin_ticket}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, sin_ticket: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Sin Ticket</span>
                </label>
              </div>
            </div>

            {/* Clasificación Especial */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Globe size={11} /> Factura Global
              </span>
              <div className="space-y-1.5 flex-1">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-950 dark:hover:text-white">
                  <input
                    type="checkbox"
                    checked={filtrosEstatus.solo_pg}
                    onChange={e => { setFiltrosEstatus(prev => ({...prev, solo_pg: e.target.checked})); resetPage(); }}
                    className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 cursor-pointer"
                  />
                  <span>Solo Público en General ({kpis.publicoGeneral.count})</span>
                </label>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── TARJETAS DE ACUMULADOS (KPIs) ─────────────────────────────────── */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-gray-50/50 dark:bg-gray-900/10 border-b border-gray-200 dark:border-gray-800 shrink-0">
        {/* Card 1: Total Ingresos */}
        <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">$</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Total Ingresos</span>
            <span className="text-lg font-black text-gray-900 dark:text-white block font-mono">
              {formatCurrency(kpis.totalMonto)}
            </span>
          </div>
        </div>

        {/* Card 2: IVA Trasladado */}
        <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <FileCode size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">IVA Trasladado</span>
            <span className="text-lg font-black text-blue-650 dark:text-blue-400 block font-mono">
              {formatCurrency(kpis.totalIva)}
            </span>
          </div>
        </div>

        {/* Card 3: Bolsa Público en General */}
        <div className="bg-purple-50/50 dark:bg-purple-955/20 border border-purple-200 dark:border-purple-900/40 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-xl flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">Bolsa Público en General</span>
            <span className="text-lg font-black text-purple-900 dark:text-purple-100 block font-mono">
              {formatCurrency(kpis.publicoGeneral.total)}
            </span>
            <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold block">
              {kpis.publicoGeneral.count} ventas para Factura Global
            </span>
          </div>
        </div>

        {/* Card 4: Desglose por Método de Pago */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-850 p-4 rounded-2xl shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CreditCard size={12} className="text-gray-450" />
            <span>Ingresos por Método</span>
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
              <th className="p-3">UUID / Folio</th>
              <th className="p-3">Cliente / RFC</th>
              <th className="p-3">Método de Pago</th>
              <th className="p-3 text-center">Estatus</th>
              <th className="p-3 text-right">Importe</th>
              <th className="p-3 text-center">Archivos</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {visible.map((v) => {
              const invoice = getInvoiceForVenta(v, ventasFacturadas);
              const esSuelta = !!(v as any)._esFacturaSuelta;
              const clientName = v.clientes?.nombre_local || v.cliente_nombre || 'Cliente Ocasional';
              const clientRfc = v.clientes?.rfc || 'S/N';
              const totalAmount = Number(v.precio_total || 0);
              const ivaAmount = totalAmount - (totalAmount / 1.16);
              const invoiceList = (v.facturas_clientes && v.facturas_clientes.length > 0)
                ? v.facturas_clientes
                : (invoice ? [invoice] : []);

              return (
                <tr key={v.id} className="hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-colors">

                  {/* Fecha */}
                  <td className="p-3 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {invoice?.fecha_emision
                      ? new Date(invoice.fecha_emision).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                      : v.fecha_pedido
                        ? new Date(v.fecha_pedido).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                  </td>

                  {/* UUID / Folio */}
                  <td className="p-3 font-mono">
                    {invoice ? (
                      <div>
                        <div className="text-gray-800 dark:text-gray-200 font-semibold" title={invoice.uuid_fiscal}>
                          {invoice.uuid_fiscal ? invoice.uuid_fiscal.substring(0, 20) + '…' : 'Sin UUID'}
                        </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {invoice.serie_folio ? `Folio: ${invoice.serie_folio} · ` : ''}
                        {esSuelta ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">XML sin pedido</span>
                        ) : (
                          <>Pedido #{v.numero_pedido}</>
                        )}
                      </div>
                      </div>
                    ) : v.folio_factura ? (
                      <div>
                        <div className="text-gray-800 dark:text-gray-200 font-semibold">
                          Folio: {v.folio_factura}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Pedido #{v.numero_pedido}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400">Pedido #{v.numero_pedido}</div>
                    )}
                  </td>

                  {/* Cliente */}
                  <td className="p-3">
                    <div className="font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">{clientName}</div>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      <span className="font-mono text-[10px] text-gray-400">{clientRfc}</span>
                      {(!!v.clientes?.facturar_publico_general || !!v.clientes?.es_anonimo || !v.cliente_id || (v.cliente_nombre || '').toLowerCase().includes('ocasional') || (v.cliente_nombre || '').toLowerCase().includes('público')) && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-purple-100 dark:bg-purple-955/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40">
                          🌐 Público General
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Método de pago */}
                  <td className="p-3">
                    {(v as any).metodo_pago ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <CreditCard size={9} /> {getMetodoPagoLabel((v as any).metodo_pago)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">—</span>
                    )}
                  </td>

                  {/* Estatus facturación */}
                  <td className="p-3 text-center">
                    {esSuelta ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <LinkIcon size={9} /> Sin vincular
                      </span>
                    ) : (
                      <EstatusFacturaBadge v={v} invoice={invoice} />
                    )}
                  </td>

                  {/* Importe */}
                  <td className="p-3 text-right font-mono whitespace-nowrap">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{formatCurrency(totalAmount)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">IVA: {formatCurrency(ivaAmount)}</div>
                    {invoice && invoice.total && Math.abs(Number(invoice.total) - totalAmount) > 0.01 && (
                      <div className="text-[9px] font-sans text-amber-600 dark:text-amber-400 mt-0.5" title={`Factura XML por un total acumulado de ${formatCurrency(invoice.total)}`}>
                        (XML total: {formatCurrency(invoice.total)})
                      </div>
                    )}
                  </td>

                  {/* Archivos */}
                  <td className="p-3">
                    {invoiceList.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {invoiceList.map((inv, idx) => (
                          <div key={idx} className="flex gap-1 items-center">
                            {invoiceList.length > 1 && (
                              <span className="text-[9px] font-bold text-gray-400">#{idx + 1}</span>
                            )}
                            {inv.xml_url && inv.xml_url.split(',').filter(Boolean).map((url, si) => (
                              <button key={si} onClick={() => onDownloadFile(url)} title="XML"
                                className="p-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500">
                                <FileCode size={13} />
                              </button>
                            ))}
                            {inv.pdf_url && inv.pdf_url.split(',').filter(Boolean).map((url, si) => (
                              <button key={si} onClick={() => onDownloadFile(url)} title="PDF"
                                className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded border border-red-200 dark:border-red-900/50 text-red-500">
                                <FileText size={13} />
                              </button>
                            ))}
                            {inv.xml_url && handleViewCfdi && (
                              <button onClick={() => handleViewCfdi(inv.xml_url!.split(',')[0])} title="Ver XML"
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 rounded border border-indigo-200 dark:border-indigo-900/50 text-indigo-500">
                                <Eye size={13} />
                              </button>
                            )}
                            {inv.ticket_url && inv.ticket_url.split(',').filter(Boolean).map((url, si) => (
                              <button key={si} onClick={() => onDownloadFile(url)} title="Ticket"
                                className="p-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 rounded border border-amber-200 dark:border-amber-900/50 text-amber-600">
                                <CreditCard size={13} />
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600 italic block text-center">—</span>
                    )}
                    <div className="flex justify-center gap-1 mt-1">
                      <button 
                        onClick={() => esSuelta ? setVincularSueltaFactura(v) : setVincularModalPedidoId(v.id)} 
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-1.5 rounded-lg transition-colors" 
                        title={esSuelta ? "Vincular esta factura XML a un pedido de venta" : "Vincular Factura XML de Carga Masiva"}
                      >
                        <LinkIcon size={14} />
                      </button>
                      {!esSuelta && (
                        <button 
                          onClick={() => setManualModal({isOpen: true, id: v.id})} 
                          className="text-gray-600 hover:text-gray-800 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors" 
                          title="Añadir Documentos Faltantes (Manual)"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col gap-1 items-center justify-center">
                      {invoice && !esSuelta ? (
                        <button
                          onClick={() => onSendEmail(v.id)}
                          className="inline-flex items-center justify-center gap-1 w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-colors"
                        >
                          <Mail size={11} /> Enviar
                        </button>
                      ) : null}
                      <div className="flex gap-1 justify-center w-full mt-1">
                        {!esSuelta && (
                          <button
                            onClick={() => setSelectedTrayectoriaId(v.id)}
                            title="Ver Trayectoria de Venta (Pedido ➔ XML ➔ Banco)"
                            className="flex-1 flex justify-center items-center py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded transition-colors"
                          >
                            <Activity size={12} />
                          </button>
                        )}
                        {!esSuelta && (
                          <button
                            onClick={() => onEditVenta(v)}
                            disabled={!!v.movimiento_bancario_id}
                            title={v.movimiento_bancario_id ? "No se puede editar porque está conciliado" : "Editar"}
                            className={`flex-1 flex justify-center items-center py-1 rounded transition-colors ${v.movimiento_bancario_id ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400'}`}
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => esSuelta ? onDeleteFacturaSuelta && onDeleteFacturaSuelta(v.id) : onDeleteVenta(v.id)}
                          disabled={!!v.movimiento_bancario_id}
                          title={v.movimiento_bancario_id ? "No se puede eliminar porque está conciliado" : esSuelta ? "Eliminar factura XML" : "Eliminar"}
                          className={`flex-1 flex justify-center items-center py-1 rounded transition-colors ${v.movimiento_bancario_id ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400'}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                  {filtrados.length === 0 && (search || Object.values(filtrosEstatus).some(val => !val))
                    ? 'No se encontraron registros con los filtros aplicados.'
                    : 'No hay ventas registradas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── PAGINACIÓN ─────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 outline-none text-gray-800 dark:text-gray-200"
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span>registros por página</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={pagina === 0}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-gray-500"
          >«</button>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-mono text-gray-700 dark:text-gray-300">
            Página {pagina + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={pagina >= totalPages - 1}
            className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={pagina >= totalPages - 1}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-gray-500"
          >»</button>
        </div>
      </div>

      {manualModal.isOpen && (
        <CargaManualModal
          tipo="venta"
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
          tipo="venta"
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
      {vincularModalPedidoId && (
        <VincularXmlPedidoModal
          pedidoId={vincularModalPedidoId}
          onClose={() => setVincularModalPedidoId(null)}
          onSuccess={() => {
            setVincularModalPedidoId(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
      {vincularSueltaFactura && (
        <VincularSueltaAPedidoModal
          factura={vincularSueltaFactura}
          onClose={() => setVincularSueltaFactura(null)}
          onSuccess={() => {
            setVincularSueltaFactura(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
      {selectedTrayectoriaId && (
        <TrayectoriaPedidoModal
          pedidoId={selectedTrayectoriaId}
          onClose={() => setSelectedTrayectoriaId(null)}
          onRefresh={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
      {showAsignacionModal && (
        <AsignacionXmlModal
          isOpen={showAsignacionModal}
          initialMonth={selectedMonth}
          onClose={() => setShowAsignacionModal(false)}
          onSuccess={() => {
            setShowAsignacionModal(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ── MODAL: VINCULAR FACTURA SUELTA A UN PEDIDO ──────────────────────────────
function VincularSueltaAPedidoModal({ factura, onClose, onSuccess }: {
  factura: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const getSessionToken = useSessionToken();
  const facturaData = factura.facturas_clientes?.[0] || factura;
  const clienteId = facturaData.cliente_id || factura.cliente_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadPedidos = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('pedidos')
        .select('id, numero_pedido, cliente_nombre, fecha_pedido, precio_total, estatus_pago, clientes(nombre_local, rfc)')
        .neq('estatus_pago', 'Cancelado')
        .is('folio_factura', null)
        .order('creado_en', { ascending: false });

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }
      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setPedidos(data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar pedidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPedidos();
  }, []);

  const handleVincular = async () => {
    if (!selectedPedidoId) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await vincularFacturaAPedido(facturaData.id || factura.id, selectedPedidoId, token);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Error al vincular la factura.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al vincular.');
    } finally {
      setSaving(false);
    }
  };

  const filtrados = pedidos.filter(p => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      p.numero_pedido?.toString().includes(q) ||
      p.cliente_nombre?.toLowerCase().includes(q) ||
      p.clientes?.nombre_local?.toLowerCase().includes(q) ||
      p.clientes?.rfc?.toLowerCase().includes(q) ||
      p.precio_total?.toString().includes(q)
    );
  });

  const clienteNombre = facturaData.clientes?.nombre_local || factura.clientes?.nombre_local || facturaData.nombreReceptor || 'Cliente Desconocido';
  const clienteRfc = facturaData.clientes?.rfc || factura.clientes?.rfc || 'S/N';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="text-blue-500" /> Vincular Factura XML a Pedido
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Selecciona el pedido de venta al que pertenece esta factura de ingreso.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            <div className="flex items-center gap-2">
              <FileCode size={14} className="text-blue-500" />
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                {facturaData.uuid_fiscal ? facturaData.uuid_fiscal.substring(0, 20) + '…' : facturaData.serie_folio || 'Sin UUID'}
              </span>
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold">{clienteNombre}</span>
              <span className="font-mono ml-1 text-gray-400">({clienteRfc})</span>
            </div>
            <div className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Number(facturaData.total || factura.precio_total || 0))}
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar pedido por número, cliente, RFC o monto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <RefreshCw className="animate-spin text-blue-500" size={24} />
              <span className="text-xs">Cargando pedidos...</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <FileCode size={36} className="mx-auto text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold">No se encontraron pedidos disponibles para vincular.</p>
              <p className="text-xs text-gray-400">El pedido debe estar activo y sin factura asignada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Pedidos candidatos ({filtrados.length})
              </span>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filtrados.map((p) => {
                  const isSelected = selectedPedidoId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPedidoId(p.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900 dark:text-white">
                            Pedido #{p.numero_pedido}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase">
                            {p.estatus_pago || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                          <span className="font-medium truncate max-w-[220px]">
                            {p.clientes?.nombre_local || p.cliente_nombre || 'Cliente Desconocido'}
                          </span>
                          {p.clientes?.rfc && <span className="font-mono text-[10px] text-gray-400">({p.clientes.rfc})</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-sm font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(Number(p.precio_total || 0))}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-MX') : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleVincular}
            disabled={!selectedPedidoId || saving}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Vinculando...</>
            ) : (
              <>Vincular al Pedido Seleccionado</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
