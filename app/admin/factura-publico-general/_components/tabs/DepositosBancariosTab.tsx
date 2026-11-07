'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { formatDate, extractReferenciaBancaria } from '@/lib/formatters';

interface DepositosBancariosTabProps {
  depositosMes: any[];
  totalMontoDepositosMes: number;
  totalDepositosConTicketMes: number;
  montoDepositosConTicketMes: number;
  totalDepositosFacturadosMes: number;
  montoDepositosFacturadosMes: number;
  totalMontoExcluidoOtroMes: number;
  totalMontoDepositosNoEsVenta?: number;
  toggleExcludeMovement: (id: string) => void;
  toggleNoEsVentaMovement?: (movId: string, razon?: string) => void;
  formatCurrency: (val: number | string | null | undefined) => string;
  handleDownloadFile?: (filePath: string, fileName?: string) => void;
  formatTicketIdentificador?: (ticket: any) => string;
  loading: boolean;
}

export const DepositosBancariosTab: React.FC<DepositosBancariosTabProps> = ({
  depositosMes,
  totalMontoDepositosMes,
  totalDepositosConTicketMes,
  montoDepositosConTicketMes,
  totalDepositosFacturadosMes,
  montoDepositosFacturadosMes,
  totalMontoExcluidoOtroMes,
  totalMontoDepositosNoEsVenta = 0,
  toggleExcludeMovement,
  toggleNoEsVentaMovement,
  formatCurrency,
  handleDownloadFile,
  formatTicketIdentificador,
  loading,
}) => {
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(depositosMes.length / pageSize));
  const paginatedDepositos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return depositosMes.slice(start, start + pageSize);
  }, [depositosMes, currentPage, pageSize]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
      
      {/* HEADER DE RESUMEN DE DEPÓSITOS */}
      <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
        <div>
          <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Building2 size={16} className="text-blue-500" /> Depósitos Bancarios del Estado de Cuenta ({depositosMes.length})
          </h4>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Movimientos ingresados vía Cargas de Estados de Cuenta emitidas por el usuario. Muestra tickets y facturas vinculadas, estatus de conciliación y control de inclusión en factura global.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
          <span className="text-gray-600 dark:text-gray-400">
            Total Depósitos: <strong className="text-blue-600 dark:text-blue-400">{formatCurrency(totalMontoDepositosMes)}</strong>
          </span>
          <span className="text-indigo-600 dark:text-indigo-400">
            Conciliados con Tickets: <strong>{totalDepositosConTicketMes} ({formatCurrency(montoDepositosConTicketMes)})</strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400">
            Facturados: <strong>{totalDepositosFacturadosMes} ({formatCurrency(montoDepositosFacturadosMes)})</strong>
          </span>
          {totalMontoExcluidoOtroMes > 0 && (
            <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
              Excluidos Otro Mes: <strong>{formatCurrency(totalMontoExcluidoOtroMes)}</strong>
            </span>
          )}
          {Boolean(totalMontoDepositosNoEsVenta && totalMontoDepositosNoEsVenta > 0) && (
            <span className="text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
              No es Venta: <strong>{formatCurrency(totalMontoDepositosNoEsVenta)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* TABLA DE DEPÓSITOS */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-900 z-10">
              <th className="p-3">Fecha</th>
              <th className="p-3">Concepto / Referencia Banco</th>
              <th className="p-3">Cuenta Bancaria</th>
              <th className="p-3 text-right">Monto Depósito</th>
              <th className="p-3 text-center">Estatus Conciliación</th>
              <th className="p-3 text-center">Facturas / Tickets Vinculados</th>
              <th className="p-3 text-center">Factura Global</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {paginatedDepositos.map(d => {
              const cuentaNombre = d.cuentas_bancarias?.nombre || 'Cuenta Principal';
              const concs = d._concs || [];
              const cdms = d._cdms || [];
              return (
                <tr key={d.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors">
                  <td className="p-3 font-mono font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(d.fecha)}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={d.concepto}>
                      {d.concepto || 'Depósito bancario'}
                    </div>
                    {(() => {
                      const refStr = extractReferenciaBancaria(d.referencia, d.concepto);
                      if (!refStr) return null;
                      return (
                        <div className="font-mono text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Ref: {refStr}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 font-medium text-gray-500 dark:text-gray-400 text-[11px]">
                    {cuentaNombre}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(d._monto)}
                  </td>
                  <td className="p-3 text-center">
                    {(() => {
                      const hasTicketsCombined = d._hasTickets || (d._ticketsAsociados && d._ticketsAsociados.length > 0) || cdms.length > 0 || !!d.pdf_ticket_url;
                      if (d._hasInvoice) {
                        return (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955/50 dark:text-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 size={12} /> Facturado
                          </span>
                        );
                      }
                      if (hasTicketsCombined) {
                        return (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-955/50 dark:text-indigo-300 inline-flex items-center gap-1">
                            <CheckCircle2 size={12} /> Conciliado con Ticket
                          </span>
                        );
                      }
                      if (d._isNoVenta) {
                        return (
                          <span
                            className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-955/50 dark:text-purple-300 inline-flex items-center gap-1"
                            title={d._noVentaRazon ? `No es Venta: ${d._noVentaRazon}` : 'Movimiento no deducible / No es venta'}
                          >
                            🚫 No es Venta ({d._noVentaRazon || 'Excluido'})
                          </span>
                        );
                      }
                      if (d._isOtherMonth) {
                        return (
                          <span
                            className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955/50 dark:text-amber-300 inline-flex items-center gap-1"
                            title={d._otherMonthRazon}
                          >
                            ⚠️ Desfase ({d._mesDetectado || 'Otro Mes'})
                          </span>
                        );
                      }
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955/50 dark:text-amber-300 inline-flex items-center gap-1">
                            <AlertCircle size={12} /> Sin Conciliar
                          </span>
                          <span
                            className="text-[10px] text-gray-500 dark:text-gray-400 font-medium max-w-[150px] truncate block mt-0.5"
                            title={d.comentarios || d.concepto || 'Sin asignar'}
                          >
                            {d.comentarios || d.concepto || 'Sin asignar'}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-center font-sans">
                    <div className="flex flex-col items-center gap-1">
                      {concs.map((c: any, idx: number) => {
                        const p = c.pedidos;
                        const title = p?.numero_pedido ? `Pedido #${p.numero_pedido}` : (p?.folio_factura ? `Factura ${p.folio_factura}` : 'Factura Vinculada');
                        return (
                          <span key={`f-${idx}`} className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-[10px]">
                            📄 {title}
                          </span>
                        );
                      })}

                      {(() => {
                        const associatedMap = new Map<string, { comp: any; montoAsociado: number }>();
                        (d._ticketsAsociados || []).forEach((item: any) => {
                          if (item?.ticket?.id) {
                            associatedMap.set(item.ticket.id, { comp: item.ticket, montoAsociado: item.montoAsociado || 0 });
                          }
                        });
                        cdms.forEach((c: any) => {
                          const comp = c.comprobantes_deposito;
                          if (comp?.id && !associatedMap.has(comp.id)) {
                            associatedMap.set(comp.id, { comp, montoAsociado: Number(c.monto_asociado || comp.monto || 0) });
                          }
                        });
                        if (associatedMap.size === 0 && d.pdf_ticket_url) {
                          associatedMap.set(`mov_ticket_${d.id}`, {
                            comp: {
                              id: `mov_ticket_${d.id}`,
                              fecha: d.fecha,
                              descripcion: d.fecha ? `Cierre del día ${parseInt(d.fecha.split('-')[2], 10)}` : 'Ticket adjunto',
                              archivo_url: d.pdf_ticket_url
                            },
                            montoAsociado: d._monto
                          });
                        }
                        const ticketsList = Array.from(associatedMap.values());

                        if (concs.length === 0 && ticketsList.length === 0) {
                          if (d._isNoVenta) {
                            return (
                              <div className="text-[10px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 text-left max-w-[260px]">
                                <span className="font-bold">🚫 No es Venta:</span> {d._noVentaRazon || 'Excluido del cálculo'}
                                {d.concepto && (
                                  <div className="text-[9px] text-purple-600/80 dark:text-purple-400/80 truncate mt-0.5 font-mono" title={d.concepto}>
                                    {d.concepto}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          if (d._isOtherMonth) {
                            return (
                              <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 text-left max-w-[260px]">
                                <span className="font-bold">⚠️ Desfase:</span> {d._otherMonthRazon || 'Movimiento de otro mes'}
                                {d.concepto && (
                                  <div className="text-[9px] text-amber-600/80 dark:text-amber-400/80 truncate mt-0.5 font-mono" title={d.concepto}>
                                    {d.concepto}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-left max-w-[260px]">
                              <span className="font-bold text-amber-700 dark:text-amber-400">Sin ticket vinculado</span>
                              <div className="text-[9px] text-gray-600 dark:text-gray-300 truncate mt-0.5 font-mono" title={d.concepto || 'Sin asignar'}>
                                {d.concepto || 'Sin descripción'}
                              </div>
                              {d.comentarios && (
                                <div className="text-[9px] text-gray-400 italic truncate mt-0.5" title={d.comentarios}>
                                  Nota: {d.comentarios}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return ticketsList.map(({ comp, montoAsociado }, idx: number) => {
                          const title = formatTicketIdentificador ? formatTicketIdentificador(comp) : (comp?.descripcion || `Ticket ${comp?.fecha || ''}`);
                          const fechaComp = formatDate(comp?.fecha);
                          return (
                            <div key={`t-${idx}`} className="inline-flex items-center gap-1 max-w-[240px]">
                              {comp?.archivo_url && handleDownloadFile ? (
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFile(comp.archivo_url, `${title}.pdf`)}
                                  className="font-bold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-[10px] inline-flex items-center gap-1 cursor-pointer transition truncate"
                                  title={`Ver ticket: ${title} (${fechaComp}) - Monto Asociado: ${formatCurrency(montoAsociado || comp?.monto || 0)}`}
                                >
                                  🎫 {title} {fechaComp ? `(${fechaComp})` : ''} <ExternalLink size={10} className="shrink-0 text-indigo-500" />
                                </button>
                              ) : (
                                <span
                                  className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-[10px] inline-flex items-center gap-1 truncate"
                                  title={`${title} (${fechaComp}) - Monto Asociado: ${formatCurrency(montoAsociado || comp?.monto || 0)}`}
                                >
                                  🎫 {title} {fechaComp ? `(${fechaComp})` : ''}
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {d._isOtherMonth && (
                        <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-955 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1" title={d._otherMonthRazon}>
                          ⚠️ {d._mesDetectado ? `Mes ${d._mesDetectado}` : 'Otro Mes'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExcludeMovement(d.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-black transition cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                        d._isExcluded
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-955/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : 'bg-emerald-50 hover:bg-amber-50 text-emerald-700 hover:text-amber-700 dark:bg-emerald-955/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                      title={d._isExcluded ? 'Excluido: no se contabiliza en la Factura Global' : 'Incluido: se contabiliza en la Factura Global'}
                    >
                      {d._isExcluded ? '🚫 Excluido' : '✅ Incluido'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {depositosMes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                  {loading ? 'Cargando depósitos bancarios...' : 'No se encontraron depósitos bancarios de cargas de usuario para el período seleccionado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER DE PAGINACIÓN */}
      {depositosMes.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-[11px]">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
            <span className="text-gray-400 text-[11px] ml-2">
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, depositosMes.length)} a {Math.min(currentPage * pageSize, depositosMes.length)} de {depositosMes.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className={`p-1.5 rounded-lg border transition ${
                currentPage <= 1
                  ? 'text-gray-300 border-gray-200 dark:border-gray-800 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
              }`}
              title="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-mono font-bold px-2 text-gray-700 dark:text-gray-300">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className={`p-1.5 rounded-lg border transition ${
                currentPage >= totalPages
                  ? 'text-gray-300 border-gray-200 dark:border-gray-800 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
              }`}
              title="Página siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
