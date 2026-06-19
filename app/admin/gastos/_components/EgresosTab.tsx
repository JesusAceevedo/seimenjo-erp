'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/EgresosTab.tsx
// Tab de Egresos/Gastos facturados con comprobación acumulada.

import React from 'react';
import { Plus, FileCode, FileText, CreditCard } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import type { GastoFacturado } from '../../types';

interface EgresosTabProps {
  gastosFacturados: GastoFacturado[];
  onOpenComprobacionAcumulada: () => void;
  onDownloadFile: (url: string) => void;
}

export default function EgresosTab({ gastosFacturados, onOpenComprobacionAcumulada, onDownloadFile }: EgresosTabProps) {
  return (
    <div className="flex flex-col flex-1 font-sans">
      {/* BARRA DE ACCIONES */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 flex justify-between items-center gap-4 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Egresos y Comprobación de Gastos
        </span>
        <button
          onClick={onOpenComprobacionAcumulada}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
        >
          <Plus size={14} /> Comprobación Acumulada
        </button>
      </div>

      {/* TABLA */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-4">Fecha Timbrado</th>
              <th className="p-4">UUID Fiscal / Folio</th>
              <th className="p-4">Proveedor / Emisor</th>
              <th className="p-4 text-right">Monto</th>
              <th className="p-4 text-center">XML / PDF / Ticket</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
            {gastosFacturados.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                  {g.fecha_timbrado
                    ? new Date(g.fecha_timbrado).toLocaleDateString()
                    : new Date(g.fecha_gasto || '').toLocaleDateString()}
                </td>
                <td className="p-4 font-mono">
                  <div className="text-gray-800 dark:text-gray-200 font-bold" title={g.uuid_fiscal}>
                    {g.uuid_fiscal ? g.uuid_fiscal.substring(0, 18) + '...' : 'N/A'}
                  </div>
                  <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                    <span>{g.concepto}</span>
                    {g.gasto_padre_id && (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 uppercase tracking-wide"
                        title={g.padre?.concepto}
                      >
                        Comprobante
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="font-bold text-gray-800 dark:text-gray-200">{g.proveedores?.nombre_comercial || 'N/A'}</div>
                  <div className="font-mono text-[10px] text-gray-400">{g.proveedores?.rfc}</div>
                </td>
                <td className="p-4 text-right font-mono">
                  <div className="font-bold text-red-500">-{formatCurrency(g.monto)}</div>
                  <div className="text-[10px] text-gray-400">IVA: {formatCurrency(g.iva_acreditable || 0)}</div>
                </td>
                <td className="p-4 text-center">
                  <div className="flex gap-1 justify-center flex-wrap">
                    {g.xml_url && g.xml_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        className="p-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500 flex items-center gap-0.5"
                        title={`Descargar XML ${idx + 1}`}
                      >
                        <FileCode size={14} />
                        {arr.length > 1 && <span className="text-[9px] font-bold font-mono">{idx + 1}</span>}
                      </button>
                    ))}
                    {g.pdf_url && g.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                        title={`Descargar PDF ${idx + 1}`}
                      >
                        <FileText size={14} />
                        {arr.length > 1 && <span className="text-[9px] font-bold font-mono">{idx + 1}</span>}
                      </button>
                    ))}
                    {g.ticket_url && g.ticket_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        className="p-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-900/50 text-amber-500 flex items-center gap-0.5"
                        title={`Descargar Ticket ${idx + 1}`}
                      >
                        <CreditCard size={14} />
                        {arr.length > 1 && <span className="text-[9px] font-bold font-mono">{idx + 1}</span>}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {gastosFacturados.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                  No hay gastos facturados registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
