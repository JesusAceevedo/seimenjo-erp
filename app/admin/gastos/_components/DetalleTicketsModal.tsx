'use client';

import React, { useState, useMemo } from 'react';
import { X, Receipt, Search, Download, DollarSign, CreditCard, Sparkles, Filter } from 'lucide-react';

interface TicketItem {
  numero_pedido?: string;
  usuario?: string;
  marca?: string;
  canal?: string;
  tipo_pago?: string;
  propina?: number;
  total_sin_propina?: number;
  total?: number;
}

interface DetalleTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  comprobante: any | null;
}

const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(num);
};

export default function DetalleTicketsModal({
  isOpen,
  onClose,
  comprobante,
}: DetalleTicketsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'efectivo' | 'terminal' | 'parrotpay'>('todos');

  const tickets: TicketItem[] = useMemo(() => {
    if (!comprobante?.desglose_tickets) return [];
    if (Array.isArray(comprobante.desglose_tickets)) {
      return comprobante.desglose_tickets;
    }
    try {
      if (typeof comprobante.desglose_tickets === 'string') {
        return JSON.parse(comprobante.desglose_tickets);
      }
    } catch {
      return [];
    }
    return [];
  }, [comprobante]);

  // Cálculos de resumen
  const stats = useMemo(() => {
    let totEfec = 0;
    let countEfec = 0;
    let totTerm = 0;
    let countTerm = 0;
    let totParrot = 0;
    let countParrot = 0;
    let totPropina = 0;
    let granTotal = 0;

    tickets.forEach((t) => {
      const tp = (t.tipo_pago || '').toLowerCase();
      const monto = Number(t.total || 0);
      const prop = Number(t.propina || 0);

      totPropina += prop;
      granTotal += monto;

      if (tp.includes('efectivo')) {
        totEfec += monto;
        countEfec++;
      } else if (
        tp.includes('terminal') ||
        tp.includes('tarjeta') ||
        tp.includes('débito') ||
        tp.includes('debito') ||
        tp.includes('crédito') ||
        tp.includes('credito') ||
        tp.includes('amex')
      ) {
        totTerm += monto;
        countTerm++;
      } else if (tp.includes('parrot') || tp.includes('qr') || tp.includes('transferencia')) {
        totParrot += monto;
        countParrot++;
      } else {
        totTerm += monto;
        countTerm++;
      }
    });

    return {
      totEfec,
      countEfec,
      totTerm,
      countTerm,
      totParrot,
      countParrot,
      totPropina,
      granTotal,
      totalTickets: tickets.length,
    };
  }, [tickets]);

  // Filtrado de tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const tp = (t.tipo_pago || '').toLowerCase();

      // Filtro de método de pago
      if (tipoFilter === 'efectivo' && !tp.includes('efectivo')) return false;
      if (
        tipoFilter === 'terminal' &&
        !(
          tp.includes('terminal') ||
          tp.includes('tarjeta') ||
          tp.includes('débito') ||
          tp.includes('debito') ||
          tp.includes('crédito') ||
          tp.includes('credito') ||
          tp.includes('amex')
        )
      ) {
        return false;
      }
      if (tipoFilter === 'parrotpay' && !tp.includes('parrot') && !tp.includes('qr') && !tp.includes('transferencia')) {
        return false;
      }

      // Filtro de texto / búsqueda
      if (!searchTerm.trim()) return true;
      const s = searchTerm.toLowerCase().trim();
      const numPed = (t.numero_pedido || '').toLowerCase();
      const user = (t.usuario || '').toLowerCase();
      const canal = (t.canal || '').toLowerCase();
      const marca = (t.marca || '').toLowerCase();
      const totStr = String(t.total || '');

      return numPed.includes(s) || user.includes(s) || canal.includes(s) || marca.includes(s) || totStr.includes(s) || tp.includes(s);
    });
  }, [tickets, tipoFilter, searchTerm]);

  // Totales de la selección filtrada
  const filteredTotals = useMemo(() => {
    return filteredTickets.reduce<{ subtotal: number; propina: number; total: number }>(
      (acc, t) => ({
        subtotal: acc.subtotal + Number(t.total_sin_propina || 0),
        propina: acc.propina + Number(t.propina || 0),
        total: acc.total + Number(t.total || 0),
      }),
      { subtotal: 0, propina: 0, total: 0 }
    );
  }, [filteredTickets]);

  const handleExportCsv = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['# Pedido / Folio', 'Usuario / Mesero', 'Marca', 'Canal', 'Tipo de Pago', 'Subtotal', 'Propina', 'Total'];
    const rows = filteredTickets.map((t) => [
      `"${t.numero_pedido || ''}"`,
      `"${t.usuario || ''}"`,
      `"${t.marca || ''}"`,
      `"${t.canal || ''}"`,
      `"${t.tipo_pago || ''}"`,
      Number(t.total_sin_propina || 0).toFixed(2),
      Number(t.propina || 0).toFixed(2),
      Number(t.total || 0).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ventas_parrot_${comprobante?.fecha || 'dia'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !comprobante) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <Receipt size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                Desglose de Ventas del Día
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-xs font-black">
                  {comprobante.fecha}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {comprobante.tipo === 'corte_parrot' ? 'Corte Parrot POS' : 'Corte Registrado'} — {stats.totalTickets} ventas registradas en el archivo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen KPI Cards */}
        <div className="p-4 bg-gray-50/70 dark:bg-gray-950/50 border-b border-gray-200 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Efectivo */}
          <div
            onClick={() => setTipoFilter(tipoFilter === 'efectivo' ? 'todos' : 'efectivo')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              tipoFilter === 'efectivo'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/30'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
              <span>💵 Efectivo</span>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                {stats.countEfec} ventas
              </span>
            </div>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              {formatCurrency(stats.totEfec)}
            </div>
          </div>

          {/* Terminal / Tarjeta */}
          <div
            onClick={() => setTipoFilter(tipoFilter === 'terminal' ? 'todos' : 'terminal')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              tipoFilter === 'terminal'
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 ring-2 ring-sky-400/30'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-sky-400'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
              <span>💳 Terminal POS</span>
              <span className="text-[10px] font-mono bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400 px-1.5 py-0.2 rounded font-bold">
                {stats.countTerm} ventas
              </span>
            </div>
            <div className="text-base font-black text-sky-600 dark:text-sky-400 font-mono mt-1">
              {formatCurrency(stats.totTerm)}
            </div>
          </div>

          {/* ParrotPay */}
          <div
            onClick={() => setTipoFilter(tipoFilter === 'parrotpay' ? 'todos' : 'parrotpay')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              tipoFilter === 'parrotpay'
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 ring-2 ring-purple-400/30'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
              <span>🦜 ParrotPay</span>
              <span className="text-[10px] font-mono bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 px-1.5 py-0.2 rounded font-bold">
                {stats.countParrot} ventas
              </span>
            </div>
            <div className="text-base font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
              {formatCurrency(stats.totParrot)}
            </div>
          </div>

          {/* Propinas */}
          <div className="p-3 rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              💰 Total Propinas
            </div>
            <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
              {formatCurrency(stats.totPropina)}
            </div>
          </div>

          {/* Total del Día */}
          <div className="p-3 rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
              <span>🏆 Total del Día</span>
              <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.2 rounded font-bold">
                {stats.totalTickets} ventas
              </span>
            </div>
            <div className="text-base font-black text-gray-900 dark:text-white font-mono mt-1">
              {formatCurrency(stats.granTotal)}
            </div>
          </div>
        </div>

        {/* Controles de Búsqueda y Filtros Rápidos */}
        <div className="p-3 md:px-5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTipoFilter('todos')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                tipoFilter === 'todos'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Todos ({stats.totalTickets})
            </button>
            <button
              type="button"
              onClick={() => setTipoFilter('efectivo')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                tipoFilter === 'efectivo'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              💵 Solo Efectivo ({stats.countEfec})
            </button>
            <button
              type="button"
              onClick={() => setTipoFilter('terminal')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                tipoFilter === 'terminal'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100'
              }`}
            >
              💳 Solo Terminal ({stats.countTerm})
            </button>
            <button
              type="button"
              onClick={() => setTipoFilter('parrotpay')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                tipoFilter === 'parrotpay'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100'
              }`}
            >
              🦜 Solo ParrotPay ({stats.countParrot})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar # orden, mesero..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 text-gray-900 dark:text-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              title="Descargar estas ventas en CSV"
              className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              <Download size={15} />
            </button>
          </div>
        </div>

        {/* Tabla de Tickets */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800 text-[10px] font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 backdrop-blur-xs">
                <th className="p-3"># Orden / Pedido</th>
                <th className="p-3">Mesero / Usuario</th>
                <th className="p-3">Canal</th>
                <th className="p-3">Tipo de Pago</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">Propina</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {filteredTickets.map((t, idx) => {
                const tp = (t.tipo_pago || '').toLowerCase();
                const isEfec = tp.includes('efectivo');
                const isTerm =
                  tp.includes('terminal') ||
                  tp.includes('tarjeta') ||
                  tp.includes('débito') ||
                  tp.includes('debito') ||
                  tp.includes('crédito') ||
                  tp.includes('credito') ||
                  tp.includes('amex');
                const isParrot = tp.includes('parrot') || tp.includes('qr') || tp.includes('transferencia');

                return (
                  <tr
                    key={idx}
                    className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors font-sans"
                  >
                    <td className="p-3 font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Receipt size={13} className="text-amber-500 shrink-0" />
                      <span>{t.numero_pedido || `Venta #${idx + 1}`}</span>
                    </td>
                    <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">
                      {t.usuario || '-'}
                    </td>
                    <td className="p-3 text-gray-500 dark:text-gray-400 text-[11px]">
                      {t.canal || t.marca || 'Sucursal'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                          isEfec
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isTerm
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
                            : isParrot
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {t.tipo_pago || 'Pago'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                      {formatCurrency(t.total_sin_propina)}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {Number(t.propina || 0) > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          +{formatCurrency(t.propina)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                      {formatCurrency(t.total)}
                    </td>
                  </tr>
                );
              })}

              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                    {searchTerm || tipoFilter !== 'todos'
                      ? 'No se encontraron ventas con los filtros aplicados.'
                      : 'No hay tickets individuales registrados en este comprobante.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 md:px-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-gray-500 dark:text-gray-400 flex items-center gap-3 font-mono text-[11px]">
            <span>
              Mostrando <strong className="text-gray-900 dark:text-white font-bold">{filteredTickets.length}</strong> de {stats.totalTickets} ventas
            </span>
            <span>•</span>
            <span>Subtotal: <strong className="text-gray-700 dark:text-gray-300">{formatCurrency(filteredTotals.subtotal)}</strong></span>
            <span>•</span>
            <span>Propinas: <strong className="text-amber-600 dark:text-amber-400">{formatCurrency(filteredTotals.propina)}</strong></span>
            <span>•</span>
            <span>Total: <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(filteredTotals.total)}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
