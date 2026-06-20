'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/IngresosTab.tsx
// Tab de Ingresos (Ventas) — con paginación, búsqueda, columnas enriquecidas.

import React, { useState, useMemo } from 'react';
import { UploadCloud, Plus, FileCode, FileText, CreditCard, Mail, Search, ChevronLeft, ChevronRight, CheckCircle, Clock, Eye } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import CargaXmlMasivaModal from './CargaXmlMasivaModal';
import type { VentaFacturada } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface IngresosTabProps {
  ventasFacturadas: VentaFacturada[];
  onOpenFacturacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
  onSendEmail: (pedidoId: string) => void;
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
}: IngresosTabProps) {

  const [showXmlModal, setShowXmlModal] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [search, setSearch] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');

  const filtrados = useMemo(() => {
    const q = search.toLowerCase();
    return ventasFacturadas.filter((v) => {
      const invoice = v.facturas_clientes?.[0];
      const matchSearch = !q || (
        (invoice?.uuid_fiscal?.toLowerCase().includes(q)) ||
        (invoice?.serie_folio?.toLowerCase().includes(q)) ||
        v.numero_pedido?.toString().includes(q) ||
        v.clientes?.nombre_local?.toLowerCase().includes(q) ||
        v.clientes?.rfc?.toLowerCase().includes(q) ||
        v.cliente_nombre?.toLowerCase().includes(q)
      );
      const hasInvoice = !!(v.facturas_clientes && v.facturas_clientes.length > 0);
      const matchEstatus = !filtroEstatus ||
        (filtroEstatus === 'facturado' && hasInvoice) ||
        (filtroEstatus === 'pendiente' && !hasInvoice && v.estatus_pago === 'Liquidado') ||
        (filtroEstatus === 'sin_liquidar' && v.estatus_pago !== 'Liquidado' && !hasInvoice);
      return matchSearch && matchEstatus;
    });
  }, [ventasFacturadas, search, filtroEstatus]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const pagina = Math.min(page, totalPages - 1);
  const visible = filtrados.slice(pagina * pageSize, (pagina + 1) * pageSize);
  const resetPage = () => setPage(0);

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
          <button
            onClick={onOpenFacturacionAcumulada}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus size={13} /> Facturación Acumulada
          </button>
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
          <select
            value={filtroEstatus}
            onChange={(e) => { setFiltroEstatus(e.target.value); resetPage(); }}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs px-2.5 py-2 outline-none focus:ring-1 focus:ring-emerald-500 text-gray-700 dark:text-gray-200"
          >
            <option value="">Todos los estatus</option>
            <option value="facturado">Facturados</option>
            <option value="pendiente">Pendientes de Facturar</option>
            <option value="sin_liquidar">Sin Liquidar</option>
          </select>
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
                ? v.facturas_clientes.reduce((acc, f) => acc + (f.iva_trasladado || 0), 0)
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
                        <CreditCard size={9} /> {(v as any).metodo_pago}
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
                            {!inv.pdf_url && inv.xml_url && onViewCfdi && (
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
                  </td>

                  {/* Acciones */}
                  <td className="p-3 text-center">
                    {invoice ? (
                      <button
                        onClick={() => onSendEmail(v.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-colors"
                      >
                        <Mail size={11} /> Enviar
                      </button>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                  {filtrados.length === 0 && (search || filtroEstatus)
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
      
      {showXmlModal && (
        <CargaXmlMasivaModal
          tipo="venta"
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
