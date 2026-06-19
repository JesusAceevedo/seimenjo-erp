'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/IngresosTab.tsx
// Tab de Ingresos (Ventas) con soporte de facturación acumulada.

import React from 'react';
import { Plus, FileCode, FileText, CreditCard, Mail } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import type { VentaFacturada } from '../../types';

interface IngresosTabProps {
  ventasFacturadas: VentaFacturada[];
  onOpenFacturacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
  onSendEmail: (pedidoId: string) => void;
}

export default function IngresosTab({
  ventasFacturadas,
  onOpenFacturacionAcumulada,
  onDownloadFile,
  onSendEmail,
}: IngresosTabProps) {
  return (
    <div className="flex flex-col flex-1 font-sans">
      {/* BARRA DE ACCIONES */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 flex justify-between items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Registro de Ventas y Facturación
        </span>
        <button
          onClick={onOpenFacturacionAcumulada}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
        >
          <Plus size={14} /> Facturación Acumulada
        </button>
      </div>

      {/* TABLA */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-4">Fecha Emisión</th>
              <th className="p-4">UUID / Folio</th>
              <th className="p-4">Cliente / Receptor</th>
              <th className="p-4 text-right">Monto</th>
              <th className="p-4 text-center">XML / PDF</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
            {ventasFacturadas.map((v) => {
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
                <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  {/* Fecha */}
                  <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                    {v.facturas_clientes && v.facturas_clientes.length > 0 ? (
                      <div className="space-y-1">
                        {v.facturas_clientes.map((inv, idx) => (
                          <div key={idx}>
                            {inv.fecha_emision ? new Date(inv.fecha_emision).toLocaleDateString() : 'N/A'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      v.fecha_pedido ? new Date(v.fecha_pedido).toLocaleDateString() : 'N/A'
                    )}
                  </td>

                  {/* UUID / Folio */}
                  <td className="p-4 font-mono">
                    {v.facturas_clientes && v.facturas_clientes.length > 0 ? (
                      <div className="space-y-2">
                        {v.facturas_clientes.map((inv, idx) => (
                          <div key={idx} className="border-b border-gray-100 dark:border-gray-800/40 last:border-0 pb-1 last:pb-0">
                            <div className="text-gray-800 dark:text-gray-200 font-bold" title={inv.uuid_fiscal}>
                              {(inv.uuid_fiscal || '').substring(0, 18)}...
                            </div>
                            <div className="text-[10px] text-gray-400">
                              Folio: {inv.serie_folio || 'S/N'} | Pedido #{v.numero_pedido}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div>
                          {v.estatus_pago === 'Liquidado' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20 font-sans font-bold">
                              Pendiente de Facturar
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 font-sans font-bold">
                              No Liquidado
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">Pedido #{v.numero_pedido}</div>
                      </div>
                    )}
                  </td>

                  {/* Cliente */}
                  <td className="p-4">
                    <div className="font-bold text-gray-800 dark:text-gray-200">{clientName}</div>
                    <div className="font-mono text-[10px] text-gray-400">{clientRfc}</div>
                  </td>

                  {/* Monto */}
                  <td className="p-4 text-right font-mono">
                    <div className="font-bold text-emerald-500">+{formatCurrency(totalAmount)}</div>
                    <div className="text-[10px] text-gray-400">IVA: {formatCurrency(ivaAmount)}</div>
                  </td>

                  {/* Archivos */}
                  <td className="p-4 text-center">
                    {v.facturas_clientes && v.facturas_clientes.length > 0 ? (
                      <div className="space-y-2">
                        {v.facturas_clientes.map((inv, idx) => (
                          <div key={idx} className="flex gap-1 justify-center items-center flex-wrap">
                            {v.facturas_clientes!.length > 1 && (
                              <span className="text-[9px] font-extrabold text-gray-400 mr-1">Doc #{idx + 1}:</span>
                            )}
                            {inv.xml_url && inv.xml_url.split(',').filter(Boolean).map((url, si, sa) => (
                              <button key={si} onClick={() => onDownloadFile(url)}
                                className="p-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500 flex items-center gap-0.5"
                                title={`XML ${si + 1}`}>
                                <FileCode size={14} />
                                {sa.length > 1 && <span className="text-[8px] font-bold font-mono">{si + 1}</span>}
                              </button>
                            ))}
                            {inv.pdf_url && inv.pdf_url.split(',').filter(Boolean).map((url, si, sa) => (
                              <button key={si} onClick={() => onDownloadFile(url)}
                                className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                                title={`PDF ${si + 1}`}>
                                <FileText size={14} />
                                {sa.length > 1 && <span className="text-[8px] font-bold font-mono">{si + 1}</span>}
                              </button>
                            ))}
                            {inv.ticket_url && inv.ticket_url.split(',').filter(Boolean).map((url, si, sa) => (
                              <button key={si} onClick={() => onDownloadFile(url)}
                                className="p-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-900/50 text-amber-500 flex items-center gap-0.5"
                                title={`Ticket ${si + 1}`}>
                                <CreditCard size={14} />
                                {sa.length > 1 && <span className="text-[8px] font-bold font-mono">{si + 1}</span>}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">No disponible</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="p-4 text-center">
                    {invoice ? (
                      <button
                        onClick={() => onSendEmail(v.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium shadow-sm transition-colors text-[10px] uppercase tracking-wider"
                      >
                        <Mail size={12} /> Enviar
                      </button>
                    ) : (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {ventasFacturadas.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                  No hay ventas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
