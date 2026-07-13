'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/IngresosTab.tsx
// Tab de Ingresos (Ventas) — con paginación, búsqueda, columnas enriquecidas.

import React, { useState, useMemo } from 'react';
import { UploadCloud, Plus, FileCode, FileText, CreditCard, Mail, Search, ChevronLeft, ChevronRight, CheckCircle, Clock, Eye, Edit3, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import CargaXmlMasivaModal from './CargaXmlMasivaModal';
import CargaManualModal from './CargaManualModal';
import type { VentaFacturada } from '../../types';

const SAT_FORMAS_PAGO_DESC: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica',
  '04': 'Tarjeta de crédito',
  '05': 'Monedero electrónico',
  '06': 'Dinero electrónico',
  '08': 'Vales de despensa',
  '12': 'Dación en pago',
  '13': 'Pago por subrogación',
  '14': 'Pago por consignación',
  '15': 'Condonación',
  '17': 'Compensación',
  '23': 'Novación',
  '24': 'Confusión',
  '25': 'Remisión de deuda',
  '26': 'Prescripción o caducidad',
  '27': 'A satisfacción del acreedor',
  '28': 'Tarjeta de débito',
  '29': 'Tarjeta de servicios',
  '30': 'Aplicación de anticipos',
  '31': 'Intermediario pagos',
  '99': 'Por definir'
};

function getMetodoPagoDisplay(codigo?: string): string {
  if (!codigo) return 'Desconocido';
  const cleanCode = codigo.trim().padStart(2, '0');
  const desc = SAT_FORMAS_PAGO_DESC[cleanCode];
  return desc ? `${cleanCode} - ${desc}` : `${cleanCode} - Otro`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface IngresosTabProps {
  ventasFacturadas: VentaFacturada[];
  onOpenFacturacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
  onSendEmail: (pedidoId: string) => void;
  onEditVenta: (venta: VentaFacturada) => void;
  onDeleteVenta: (pedidoId: string) => void;
  onRefresh?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function EstatusFacturaBadge({ v }: { v: VentaFacturada }) {
  const hasInvoice = v.facturas_clientes && v.facturas_clientes.length > 0;
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
  onOpenFacturacionAcumulada,
  onDownloadFile,
  onViewCfdi,
  onSendEmail,
  onEditVenta,
  onDeleteVenta,
  onRefresh,
}: IngresosTabProps) {

  const [showXmlModal, setShowXmlModal] = useState(false);
  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [filtrosEstatus, setFiltrosEstatus] = useState({
    conciliado: true,
    sin_conciliar: true,
    facturado: true,
    pendiente_facturar: true,
    no_liquidado: true,
    con_xml: true,
    sin_xml: true,
    con_ticket: true,
    sin_ticket: true
  });

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return ventasFacturadas.filter((v) => {
      const invoice = v.facturas_clientes?.[0];
      const totalAmount = v.facturas_clientes && v.facturas_clientes.length > 0
        ? v.facturas_clientes.reduce((acc, f) => acc + (f.total || 0), 0)
        : Number(v.precio_total || 0);

      const matchSearch = !q || (
        (invoice?.uuid_fiscal?.toLowerCase().includes(q)) ||
        (invoice?.serie_folio?.toLowerCase().includes(q)) ||
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
      const hasInvoice = !!(v.facturas_clientes && v.facturas_clientes.length > 0);
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

    filtrados.forEach((v) => {
      const totalAmount = v.facturas_clientes && v.facturas_clientes.length > 0
        ? v.facturas_clientes.reduce((acc, f) => acc + (f.total || 0), 0)
        : Number(v.precio_total || 0);

      const ivaAmount = v.facturas_clientes && v.facturas_clientes.length > 0
        ? v.facturas_clientes.reduce((acc, f) => {
            if (Number(f.iva_trasladado) > 0) return acc + Number(f.iva_trasladado);
            if (f.subtotal && Number(f.total) > Number(f.subtotal)) return acc + (Number(f.total) - Number(f.subtotal));
            return acc + (Number(f.total) - (Number(f.total) / 1.16));
          }, 0)
        : (Number(v.precio_total || 0) * 0.16);

      totalMonto += totalAmount;
      totalIva += ivaAmount;

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
                sin_ticket: true
              });
              resetPage();
            }}
            className="px-3.5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all shrink-0 shadow-sm"
          >
            Restablecer Filtros
          </button>
        </div>

        {/* Grid de Checklists de Filtro */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-sans mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          
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
                <span>Sin Liquidar (No facturados)</span>
              </label>
            </div>
          </div>

          {/* Estatus Documentación */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-xl flex flex-col shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Documentos</span>
            <div className="space-y-1.5 flex-1 max-h-24 overflow-y-auto pr-1">
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
        </div>
      </div>

      {/* ── TARJETAS DE ACUMULADOS (KPIs) ─────────────────────────────────── */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50/50 dark:bg-gray-900/10 border-b border-gray-200 dark:border-gray-800 shrink-0">
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

        {/* Card 3 y 4: Desglose por Método de Pago */}
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
              const invoice = v.facturas_clientes && v.facturas_clientes.length > 0 ? v.facturas_clientes[0] : null;
              const clientName = v.clientes?.nombre_local || v.cliente_nombre || 'Cliente Ocasional';
              const clientRfc = v.clientes?.rfc || 'S/N';
              const totalAmount = v.facturas_clientes && v.facturas_clientes.length > 0
                ? v.facturas_clientes.reduce((acc, f) => acc + (f.total || 0), 0)
                : v.precio_total;
              const ivaAmount = v.facturas_clientes && v.facturas_clientes.length > 0
                ? v.facturas_clientes.reduce((acc, f) => {
                    if (Number(f.iva_trasladado) > 0) return acc + Number(f.iva_trasladado);
                    if (f.subtotal && Number(f.total) > Number(f.subtotal)) return acc + (Number(f.total) - Number(f.subtotal));
                    return acc + (Number(f.total) - (Number(f.total) / 1.16));
                  }, 0)
                : (Number(v.precio_total) * 0.16);

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
                          {invoice.serie_folio ? `Folio: ${invoice.serie_folio} · ` : ''}Pedido #{v.numero_pedido}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400">Pedido #{v.numero_pedido}</div>
                    )}
                  </td>

                  {/* Cliente */}
                  <td className="p-3">
                    <div className="font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">{clientName}</div>
                    <div className="font-mono text-[10px] text-gray-400 mt-0.5">{clientRfc}</div>
                  </td>

                  {/* Método de pago */}
                  <td className="p-3">
                    {(v as any).metodo_pago ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <CreditCard size={9} /> {getMetodoPagoDisplay((v as any).metodo_pago)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">—</span>
                    )}
                  </td>

                  {/* Estatus facturación */}
                  <td className="p-3 text-center">
                    <EstatusFacturaBadge v={v} />
                  </td>

                  {/* Importe */}
                  <td className="p-3 text-right font-mono whitespace-nowrap">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">+{formatCurrency(totalAmount)}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">IVA: {formatCurrency(ivaAmount)}</div>
                  </td>

                  {/* Archivos */}
                  <td className="p-3">
                    {v.facturas_clientes && v.facturas_clientes.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {v.facturas_clientes.map((inv, idx) => (
                          <div key={idx} className="flex gap-1 items-center">
                            {v.facturas_clientes!.length > 1 && (
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
                            {inv.xml_url && onViewCfdi && (
                              <button onClick={() => onViewCfdi(inv.xml_url!.split(',')[0])} title="Ver XML"
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
                    <div className="flex justify-center mt-1">
                      <button 
                        onClick={() => setManualModal({isOpen: true, id: v.id})} 
                        className="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-1.5 rounded-lg transition-colors" 
                        title="Añadir Documentos Faltantes"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="p-3 text-center">
                    <div className="flex flex-col gap-1 items-center justify-center">
                      {invoice ? (
                        <button
                          onClick={() => onSendEmail(v.id)}
                          className="inline-flex items-center justify-center gap-1 w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-colors"
                        >
                          <Mail size={11} /> Enviar
                        </button>
                      ) : null}
                      <div className="flex gap-1 justify-center w-full mt-1">
                        <button
                          onClick={() => onEditVenta(v)}
                          disabled={!!v.movimiento_bancario_id}
                          title={v.movimiento_bancario_id ? "No se puede editar porque está conciliado" : "Editar"}
                          className={`flex-1 flex justify-center items-center py-1 rounded transition-colors ${v.movimiento_bancario_id ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400'}`}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => onDeleteVenta(v.id)}
                          disabled={!!v.movimiento_bancario_id}
                          title={v.movimiento_bancario_id ? "No se puede eliminar porque está conciliado" : "Eliminar"}
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
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Filas:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs outline-none"
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
          <button onClick={() => setPage(0)} disabled={pagina === 0}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-gray-500">«</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pagina === 0}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ChevronLeft size={14} />
          </button>
          <span className="px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">{pagina + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pagina >= totalPages - 1}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={pagina >= totalPages - 1}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-gray-500">»</button>
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
</div>
    </div>
  );
}
