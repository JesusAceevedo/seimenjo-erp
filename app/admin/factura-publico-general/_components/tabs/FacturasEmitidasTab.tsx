'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Globe,
  UserCheck,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FacturasEmitidasTabProps {
  displayedFacturas: any[];
  todasLasFacturasMes: any[];
  facturasTercerosMes: any[];
  facturasPgMes: any[];
  totalFacturadoMes: number;
  filtroFacturasTipo: 'todas' | 'terceros' | 'publico';
  setFiltroFacturasTipo: (tipo: 'todas' | 'terceros' | 'publico') => void;
  searchFacturasQuery: string;
  setSearchFacturasQuery: (q: string) => void;
  handleDownloadFile: (filePath: string, fileName: string) => void;
  formatCurrency: (val: number | string | null | undefined) => string;
  loading: boolean;
}

export const FacturasEmitidasTab: React.FC<FacturasEmitidasTabProps> = ({
  displayedFacturas,
  todasLasFacturasMes,
  facturasTercerosMes,
  facturasPgMes,
  totalFacturadoMes,
  filtroFacturasTipo,
  setFiltroFacturasTipo,
  searchFacturasQuery,
  setSearchFacturasQuery,
  handleDownloadFile,
  formatCurrency,
  loading,
}) => {
  // Paginación y búsqueda con debounce
  const [localQuery, setLocalQuery] = useState(searchFacturasQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchFacturasQuery(localQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [localQuery, setSearchFacturasQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroFacturasTipo]);

  const totalPages = Math.max(1, Math.ceil(displayedFacturas.length / pageSize));
  const paginatedFacturas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedFacturas.slice(start, start + pageSize);
  }, [displayedFacturas, currentPage, pageSize]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
      
      {/* HEADER DE FILTROS Y BÚSQUEDA */}
      <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
        <div>
          <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <FileText size={16} className="text-blue-500" /> Facturas Emitidas ({displayedFacturas.length} de {todasLasFacturasMes.length})
          </h4>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Listado unificado de facturas emitidas por la empresa en el período ({formatCurrency(totalFacturadoMes)} en total).
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFiltroFacturasTipo('todas')}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                filtroFacturasTipo === 'todas'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Todas ({todasLasFacturasMes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroFacturasTipo('terceros')}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                filtroFacturasTipo === 'terceros'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              👤 Clientes Terceros ({facturasTercerosMes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroFacturasTipo('publico')}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                filtroFacturasTipo === 'publico'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🌐 Público General ({facturasPgMes.length})
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Buscar folio, cliente, RFC, monto..."
              className="pl-8 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 w-56"
            />
          </div>
        </div>
      </div>

      {/* TABLA DE FACTURAS */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-900 z-10">
              <th className="p-3">Folio / Serie</th>
              <th className="p-3">Fecha Emisión</th>
              <th className="p-3">Cliente / Receptor</th>
              <th className="p-3">RFC Receptor</th>
              <th className="p-3 text-center">Clasificación</th>
              <th className="p-3">Origen / Pedido</th>
              <th className="p-3 text-right">Subtotal</th>
              <th className="p-3 text-right">IVA</th>
              <th className="p-3 text-right font-black">Total Factura</th>
              <th className="p-3 text-center">Archivos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {paginatedFacturas.map(f => (
              <tr key={f.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors ${f._isPG ? 'bg-emerald-50/20 dark:bg-emerald-955/10' : 'bg-purple-50/20 dark:bg-purple-955/10'}`}>
                <td className="p-3 font-mono font-black text-gray-900 dark:text-white">
                  {f.serie_folio || 'S/F'}
                </td>
                <td className="p-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin fecha'}
                </td>
                <td className="p-3 font-bold text-gray-800 dark:text-gray-100">
                  {f._clienteNombre}
                </td>
                <td className="p-3 font-mono text-gray-500 dark:text-gray-400">
                  {f._clienteRfc}
                </td>
                <td className="p-3 text-center">
                  {f._isPG ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-955/50 text-emerald-800 dark:text-emerald-300">
                      <Globe size={11} /> Público General
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-955/50 text-purple-800 dark:text-purple-300">
                      <UserCheck size={11} /> Cliente Tercero
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {f._isFromPedido ? (
                    <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-mono text-[11px]">
                      <Package size={11} /> Pedido #{f.pedidos?.numero_pedido || f.pedido_id?.substring(0, 6)}
                    </span>
                  ) : f.pedidos?.numero_pedido ? (
                    <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md font-mono text-[11px]">
                      <Package size={11} /> Pedido #{f.pedidos.numero_pedido}
                    </span>
                  ) : f.pedido_id ? (
                    <span className="text-[11px] text-gray-500 font-mono">Pedido ID: {f.pedido_id.substring(0, 8)}</span>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Factura directa</span>
                  )}
                </td>
                <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                  {formatCurrency(f.subtotal || f._subtotal)}
                </td>
                <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                  {formatCurrency(f.iva_trasladado || f._iva)}
                </td>
                <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                  {formatCurrency(f.total || f._total)}
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {f.xml_url && (
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(f.xml_url, `${f.serie_folio || 'factura'}.xml`)}
                        className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 transition-colors cursor-pointer"
                        title="Descargar XML"
                      >
                        XML
                      </button>
                    )}
                    {f.pdf_url && (
                      <button
                        type="button"
                        onClick={() => handleDownloadFile(f.pdf_url, `${f.serie_folio || 'factura'}.pdf`)}
                        className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold hover:bg-red-200 transition-colors cursor-pointer"
                        title="Descargar PDF"
                      >
                        PDF
                      </button>
                    )}
                    {!f.xml_url && !f.pdf_url && (
                      <span className="text-[10px] text-gray-400">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {displayedFacturas.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                  {loading ? 'Cargando facturas emitidas...' : 'No se encontraron facturas emitidas para este mes.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER DE PAGINACIÓN */}
      {displayedFacturas.length > 0 && (
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
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, displayedFacturas.length)} a {Math.min(currentPage * pageSize, displayedFacturas.length)} de {displayedFacturas.length}
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
