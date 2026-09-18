'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { List, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface TicketsPosTabProps {
  displayedTickets: any[];
  ticketsMes: any[];
  cuentasBancarias: any[];
  selectedCuentaId: string;
  setSelectedCuentaId: (id: string) => void;
  filtroTipo: 'todos' | 'publico' | 'terceros';
  setFiltroTipo: (tipo: 'todos' | 'publico' | 'terceros') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  facturadosTerceros: Record<string, boolean>;
  toggleFacturadoTercero: (id: string) => void;
  formatCurrency: (val: number | string | null | undefined) => string;
  loading: boolean;
}

export const TicketsPosTab: React.FC<TicketsPosTabProps> = ({
  displayedTickets,
  ticketsMes,
  cuentasBancarias,
  selectedCuentaId,
  setSelectedCuentaId,
  filtroTipo,
  setFiltroTipo,
  searchQuery,
  setSearchQuery,
  facturadosTerceros,
  toggleFacturadoTercero,
  formatCurrency,
  loading,
}) => {
  // Paginación y búsqueda con debounce
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [localQuery, setSearchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroTipo, selectedCuentaId]);

  const totalPages = Math.max(1, Math.ceil(displayedTickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedTickets.slice(start, start + pageSize);
  }, [displayedTickets, currentPage, pageSize]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
      
      {/* BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
        <div>
          <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <List size={16} className="text-emerald-500" /> Control de Facturación por Ticket ({displayedTickets.length} de {ticketsMes.length})
          </h4>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Marca la casilla "Factura de Terceros" en los tickets facturados a clientes particulares para restarlos de la base pública.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={selectedCuentaId}
            onChange={(e) => setSelectedCuentaId(e.target.value)}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-900 dark:text-white font-sans font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Todas las Cuentas</option>
            {cuentasBancarias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFiltroTipo('todos')}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                filtroTipo === 'todos'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Todos ({ticketsMes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('publico')}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                filtroTipo === 'publico'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Público General
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('terceros')}
              className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                filtroTipo === 'terceros'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Facturados a Terceros
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Buscar ticket..."
              className="pl-8 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* TABLA DE TICKETS */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-900 z-10">
              <th className="p-3">Fecha</th>
              <th className="p-3">Descripción / Folio</th>
              <th className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-black">💵 Efectivo (Facturable)</th>
              <th className="p-3 text-right text-purple-600 dark:text-purple-400 font-black">🦜 ParrotPay (Facturable)</th>
              <th className="p-3 text-right text-blue-600 dark:text-blue-400">💳 Tarjetas BBVA (Informativo)</th>
              <th className="p-3 text-right text-gray-400">Propinas (Excluidas)</th>
              <th className="p-3 text-center">Factura de Terceros</th>
              <th className="p-3 text-center">Destino Factura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {paginatedTickets.map(c => {
              const efec = Number(c.monto_efectivo || 0);
              const parrot = Number(c.monto_parrotpay || 0);
              const bbva = Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0);
              const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                                   Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0);
              const isTercero = !!facturadosTerceros[c.id];

              return (
                <tr key={c.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors ${isTercero ? 'bg-purple-50/30 dark:bg-purple-955/10' : ''}`}>
                  <td className="p-3 font-mono font-medium text-gray-600 dark:text-gray-400">
                    {c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                  </td>
                  <td className="p-3 font-bold text-gray-800 dark:text-gray-200">
                    {c.descripcion || `Corte POS ${c.fecha}`}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(efec)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                    {parrot > 0 ? formatCurrency(parrot) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                    {bbva > 0 ? formatCurrency(bbva) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-400 line-through">
                    {formatCurrency(propinaTotal)}
                  </td>
                  <td className="p-3 text-center">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isTercero}
                        onChange={() => toggleFacturadoTercero(c.id)}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded cursor-pointer"
                      />
                      <span className={`text-[10px] font-extrabold ${isTercero ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                        Facturado a Tercero
                      </span>
                    </label>
                  </td>
                  <td className="p-3 text-center">
                    {isTercero ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-955/50 dark:text-purple-300">
                        👤 Factura Tercero
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955/50 dark:text-emerald-300">
                        🧾 Público General
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {displayedTickets.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                  {loading ? 'Cargando tickets...' : 'No se encontraron tickets para el período o filtros seleccionados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER DE PAGINACIÓN */}
      {displayedTickets.length > 0 && (
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
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, displayedTickets.length)} a {Math.min(currentPage * pageSize, displayedTickets.length)} de {displayedTickets.length}
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
