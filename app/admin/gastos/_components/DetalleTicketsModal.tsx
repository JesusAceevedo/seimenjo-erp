'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Receipt,
  Search,
  Download,
  DollarSign,
  CreditCard,
  Sparkles,
  Filter,
  Landmark,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { formatDate } from '../../../../lib/formatters';

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
  cuentasBancarias?: any[];
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
  cuentasBancarias = [],
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
    let propinaEfec = 0;
    let countEfec = 0;
    let totTerm = 0;
    let propinaTerm = 0;
    let countTerm = 0;
    let totParrot = 0;
    let propinaParrot = 0;
    let countParrot = 0;
    let totPropina = 0;
    let granTotal = 0;
    let ventaNeta = 0;

    if (tickets.length > 0) {
      tickets.forEach((t) => {
        const tp = (t.tipo_pago || '').toLowerCase();
        const monto = Number(t.total || 0);
        const prop = Number(t.propina || 0);
        const base = Number(
          t.total_sin_propina !== undefined &&
            t.total_sin_propina !== null &&
            !isNaN(Number(t.total_sin_propina)) &&
            Number(t.total_sin_propina) > 0
            ? t.total_sin_propina
            : Math.max(0, monto - prop)
        );

        totPropina += prop;
        granTotal += monto;
        ventaNeta += base;

        if (tp.includes('efectivo')) {
          totEfec += base;
          propinaEfec += prop;
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
          totTerm += base;
          propinaTerm += prop;
          countTerm++;
        } else if (tp.includes('parrot') || tp.includes('qr') || tp.includes('transferencia')) {
          totParrot += base;
          propinaParrot += prop;
          countParrot++;
        } else {
          totTerm += base;
          propinaTerm += prop;
          countTerm++;
        }
      });
    } else if (comprobante) {
      // Fallback a campos del comprobante
      totEfec = Number(comprobante.monto_efectivo || 0);
      propinaEfec = Number(comprobante.propina_efectivo || 0);
      totTerm =
        Number(comprobante.monto_debito || 0) +
        Number(comprobante.monto_credito || 0) +
        Number(comprobante.monto_amex || 0);
      propinaTerm =
        Number(comprobante.propina_debito || 0) +
        Number(comprobante.propina_credito || 0) +
        Number(comprobante.propina_amex || 0);
      totParrot = Number(comprobante.monto_parrotpay || 0);
      propinaParrot = Number(comprobante.propina_parrotpay || 0);
      totPropina = propinaEfec + propinaTerm + propinaParrot;
      granTotal = Number(
        comprobante.monto ||
          totEfec + propinaEfec + totTerm + propinaTerm + totParrot + propinaParrot
      );
      ventaNeta = Math.max(0, granTotal - totPropina);
    }

    return {
      totEfec,
      propinaEfec,
      countEfec,
      totTerm,
      propinaTerm,
      countTerm,
      totParrot,
      propinaParrot,
      countParrot,
      totPropina,
      ventaNeta,
      granTotal,
      totalTickets: tickets.length,
    };
  }, [tickets, comprobante]);

  // Depósitos bancarios vinculados
  const linkedDepositos = useMemo(() => {
    const rels = comprobante?.comprobantes_deposito_movimientos || [];
    return rels.map((r: any) => {
      const mov = r.movimientos_bancarios;
      const cuenta = cuentasBancarias.find((cb) => cb.id === mov?.cuenta_bancaria_id);
      return {
        montoAsociado: Number(r.monto_asociado || 0),
        comentario: r.comentario_diferencia || '',
        movimiento: mov,
        cuentaNombre: cuenta?.nombre || cuenta?.banco || 'Cuenta Bancaria',
        fechaMov: mov?.fecha || '',
        conceptoMov: mov?.concepto || mov?.descripcion || '',
      };
    });
  }, [comprobante, cuentasBancarias]);

  const totalDepositado = useMemo(() => {
    return linkedDepositos.reduce((acc: number, d: any) => acc + d.montoAsociado, 0);
  }, [linkedDepositos]);

  const diferenciaDeposito = Math.max(0, stats.granTotal - totalDepositado);
  const isFullyReconciled =
    stats.granTotal > 0 && totalDepositado > 0 && Math.abs(stats.granTotal - totalDepositado) < 0.05;

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
      if (
        tipoFilter === 'parrotpay' &&
        !(tp.includes('parrot') || tp.includes('qr') || tp.includes('transferencia'))
      ) {
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

      return (
        numPed.includes(s) ||
        user.includes(s) ||
        canal.includes(s) ||
        marca.includes(s) ||
        totStr.includes(s) ||
        tp.includes(s)
      );
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
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* Header Superior */}
        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
              <Receipt size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                  Desglose de Ventas del Día
                </h3>
                <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-300 dark:border-amber-700">
                  📅 {formatDate(comprobante.fecha)}
                </span>
                {isFullyReconciled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" /> Conciliado 100% con Banco
                  </span>
                ) : totalDepositado > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-black border border-amber-300 dark:border-amber-700">
                    <Clock size={13} className="text-amber-600 dark:text-amber-400" /> Depósito Parcial
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-bold border border-gray-200 dark:border-gray-700">
                    Sin Vincular a Depósito
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {comprobante.tipo === 'corte_parrot' ? 'Corte Parrot POS' : 'Corte de Ventas'} — {stats.totalTickets} ventas registradas en el archivo del día
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen KPI Cards - Más Grandes, Claras y Legibles */}
        <div className="p-4 bg-gray-50/80 dark:bg-gray-950/60 border-b border-gray-200 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Efectivo */}
          <div
            onClick={() => setTipoFilter(tipoFilter === 'efectivo' ? 'todos' : 'efectivo')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              tipoFilter === 'efectivo'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-400/40 shadow-sm'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>💵 Efectivo</span>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-md font-black">
                {stats.countEfec} tickets
              </span>
            </div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1.5">
              {formatCurrency(stats.totEfec + stats.propinaEfec)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-1 flex flex-col gap-0.5">
              <span>Venta: <strong className="text-gray-700 dark:text-gray-300">{formatCurrency(stats.totEfec)}</strong></span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                Propina: +{formatCurrency(stats.propinaEfec)}
              </span>
            </div>
          </div>

          {/* Terminal / Tarjeta */}
          <div
            onClick={() => setTipoFilter(tipoFilter === 'terminal' ? 'todos' : 'terminal')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              tipoFilter === 'terminal'
                ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 ring-2 ring-sky-400/40 shadow-sm'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-sky-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>💳 Terminal POS</span>
              <span className="text-[10px] font-mono bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 px-2 py-0.5 rounded-md font-black">
                {stats.countTerm} tickets
              </span>
            </div>
            <div className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono mt-1.5">
              {formatCurrency(stats.totTerm + stats.propinaTerm)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-1 flex flex-col gap-0.5">
              <span>Venta: <strong className="text-gray-700 dark:text-gray-300">{formatCurrency(stats.totTerm)}</strong></span>
              <span className="font-bold text-sky-700 dark:text-sky-300">
                Propina: +{formatCurrency(stats.propinaTerm)}
              </span>
            </div>
          </div>

          {/* ParrotPay */}
          <div
            onClick={() => setTipoFilter(tipoFilter === 'parrotpay' ? 'todos' : 'parrotpay')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              tipoFilter === 'parrotpay'
                ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-400/40 shadow-sm'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
              <span>🦜 ParrotPay</span>
              <span className="text-[10px] font-mono bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 px-2 py-0.5 rounded-md font-black">
                {stats.countParrot} tickets
              </span>
            </div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono mt-1.5">
              {formatCurrency(stats.totParrot + stats.propinaParrot)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-1 flex flex-col gap-0.5">
              <span>Venta: <strong className="text-gray-700 dark:text-gray-300">{formatCurrency(stats.totParrot)}</strong></span>
              {stats.propinaParrot > 0 && (
                <span className="font-bold text-purple-700 dark:text-purple-300">
                  Propina: +{formatCurrency(stats.propinaParrot)}
                </span>
              )}
            </div>
          </div>

          {/* Propinas Totales */}
          <div className="p-3.5 rounded-2xl border bg-amber-50/50 dark:bg-amber-955/25 border-amber-300 dark:border-amber-800/60">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
              <span>💰 Total Propinas</span>
              <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">
                Excluidas SAT
              </span>
            </div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-1.5">
              {formatCurrency(stats.totPropina)}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-mono mt-1 flex flex-col gap-0.5">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                Efec: {formatCurrency(stats.propinaEfec)}
              </span>
              <span className="text-sky-700 dark:text-sky-300 font-bold">
                Tarj: {formatCurrency(stats.propinaTerm)}
              </span>
            </div>
          </div>

          {/* Ventas Netas (Subtotal Excel) */}
          <div className="p-3.5 rounded-2xl border bg-white dark:bg-gray-900 border-emerald-300 dark:border-emerald-800/60">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-400">
              <span>🏷️ Ventas Netas</span>
              <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-black">
                Excel
              </span>
            </div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono mt-1.5">
              {formatCurrency(stats.ventaNeta)}
            </div>
            <span className="text-[10px] text-gray-500 font-mono block mt-1">
              Subtotal base sin propinas
            </span>
          </div>

          {/* Total del Día con Propinas */}
          <div className="p-3.5 rounded-2xl border bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-md">
            <div className="flex items-center justify-between text-xs font-bold text-gray-300 dark:text-gray-700">
              <span>🏆 Total Cobrado</span>
              <span className="text-[10px] font-mono bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 px-2 py-0.5 rounded-md font-black">
                {stats.totalTickets} tickets
              </span>
            </div>
            <div className="text-lg font-black font-mono mt-1.5 text-white dark:text-gray-900">
              {formatCurrency(stats.granTotal)}
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-600 font-mono block mt-1">
              Ventas + Propinas Cobradas
            </span>
          </div>
        </div>

        {/* Sección de Depósitos Bancarios Vinculados */}
        {linkedDepositos.length > 0 ? (
          <div className="px-4 py-3 bg-emerald-50/70 dark:bg-emerald-955/20 border-b border-emerald-200 dark:border-emerald-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Landmark size={15} className="text-emerald-600 dark:text-emerald-400" />
                Depósitos Bancarios Vinculados ({linkedDepositos.length}):
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {linkedDepositos.map((ld: any, i: number) => (
                  <div
                    key={i}
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-800/60 shadow-2xs flex items-center gap-2"
                  >
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      {ld.cuentaNombre}
                    </span>
                    {ld.fechaMov && (
                      <span className="text-[10px] text-gray-500 font-mono">
                        ({formatDate(ld.fechaMov)})
                      </span>
                    )}
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(ld.montoAsociado)}
                    </span>
                    {ld.comentario && (
                      <span className="text-[10px] text-gray-400 italic">
                        &quot;{ld.comentario}&quot;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono font-bold">
              <span className="text-emerald-800 dark:text-emerald-300">
                Total en Banco: <strong className="text-sm font-black">{formatCurrency(totalDepositado)}</strong>
              </span>
              {diferenciaDeposito > 0.05 && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-955 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-300 dark:border-amber-700">
                  ⚠️ Pendiente: {formatCurrency(diferenciaDeposito)}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-950/40 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-500" />
              Este ticket o corte aún no tiene movimientos de depósito bancario vinculados.
            </span>
          </div>
        )}

        {/* Controles de Búsqueda y Filtros Rápidos */}
        <div className="p-3 md:px-5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTipoFilter('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tipoFilter === 'efectivo'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
              }`}
            >
              💵 Solo Efectivo ({stats.countEfec})
            </button>
            <button
              type="button"
              onClick={() => setTipoFilter('terminal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tipoFilter === 'terminal'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50'
              }`}
            >
              💳 Solo Terminal ({stats.countTerm})
            </button>
            <button
              type="button"
              onClick={() => setTipoFilter('parrotpay')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tipoFilter === 'parrotpay'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50'
              }`}
            >
              🦜 Solo ParrotPay ({stats.countParrot})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm ml-auto">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por # orden, mesero, canal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 dark:text-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              title="Descargar estas ventas en CSV"
              className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Tabla de Tickets Detallados */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-950/70 border-b border-gray-200 dark:border-gray-800 text-[11px] font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider sticky top-0 backdrop-blur-xs z-10">
                <th className="p-3.5"># Orden / Pedido</th>
                <th className="p-3.5">Mesero / Usuario</th>
                <th className="p-3.5">Canal / Marca</th>
                <th className="p-3.5">Método de Pago</th>
                <th className="p-3.5 text-right font-mono">Subtotal (Venta)</th>
                <th className="p-3.5 text-right font-mono">Propina</th>
                <th className="p-3.5 text-right font-mono">Total Cobrado</th>
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
                const propinaMonto = Number(t.propina || 0);

                return (
                  <tr
                    key={idx}
                    className="hover:bg-amber-50/40 dark:hover:bg-amber-950/15 transition-colors font-sans"
                  >
                    <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Receipt size={15} className="text-amber-500 shrink-0" />
                      <span className="text-xs md:text-sm font-black">{t.numero_pedido || `Venta #${idx + 1}`}</span>
                    </td>
                    <td className="p-3.5 text-gray-800 dark:text-gray-200 font-semibold text-xs md:text-sm">
                      {t.usuario || '-'}
                    </td>
                    <td className="p-3.5 text-gray-600 dark:text-gray-400 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
                        {t.canal || t.marca || 'Sucursal'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wide inline-flex items-center gap-1 ${
                          isEfec
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : isTerm
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                            : isParrot
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {isEfec ? '💵' : isTerm ? '💳' : isParrot ? '🦜' : '🏷️'} {t.tipo_pago || 'Pago'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-gray-700 dark:text-gray-300 text-xs md:text-sm">
                      {formatCurrency(t.total_sin_propina)}
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      {propinaMonto > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-955/60 text-amber-800 dark:text-amber-300 font-black text-xs border border-amber-300 dark:border-amber-700">
                          +{formatCurrency(propinaMonto)}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white text-sm md:text-base">
                      {formatCurrency(t.total)}
                    </td>
                  </tr>
                );
              })}

              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400 italic">
                    {searchTerm || tipoFilter !== 'todos'
                      ? 'No se encontraron tickets con los filtros aplicados.'
                      : 'No hay tickets individuales registrados en el desglose de este comprobante.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con Totales Resumen */}
        <div className="p-4 md:px-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-gray-600 dark:text-gray-300 flex items-center gap-3 font-mono text-xs flex-wrap">
            <span>
              Mostrando <strong className="text-gray-900 dark:text-white font-bold">{filteredTickets.length}</strong> de {stats.totalTickets} ventas
            </span>
            <span>•</span>
            <span>Subtotal: <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(filteredTotals.subtotal)}</strong></span>
            <span>•</span>
            <span>Propinas: <strong className="text-amber-600 dark:text-amber-400 font-bold">+{formatCurrency(filteredTotals.propina)}</strong></span>
            <span>•</span>
            <span>Total Cobrado: <strong className="text-emerald-700 dark:text-emerald-400 font-black text-sm">{formatCurrency(filteredTotals.total)}</strong></span>
            {totalDepositado > 0 && (
              <>
                <span>•</span>
                <span>En Banco: <strong className="text-sky-700 dark:text-sky-400 font-black">{formatCurrency(totalDepositado)}</strong></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
