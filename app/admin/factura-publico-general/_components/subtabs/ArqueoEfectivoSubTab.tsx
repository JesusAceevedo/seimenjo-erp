'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Unlink,
  X,
} from 'lucide-react';

type CashAmount = number | string | null | undefined;

interface CashMovementLink {
  id: string;
  montoAsociado?: CashAmount;
  concepto?: string;
  fecha?: string;
}

interface CashDepositRelation {
  monto_asociado?: CashAmount;
  comprobantes_deposito?: { monto?: CashAmount } | null;
}

interface CashDeposit {
  id: string;
  _monto?: CashAmount;
  _isExcluded?: boolean;
  _isNoVenta?: boolean;
  _cdms?: CashDepositRelation[];
  concepto?: string;
  fecha?: string;
  _isOtherMonth?: boolean;
}

interface CashTicket {
  id: string;
  monto_efectivo?: CashAmount;
  propina_efectivo?: CashAmount;
  fecha?: string;
  descripcion?: string;
  _associatedMovs?: CashMovementLink[];
}

interface CashTicketRow extends CashTicket {
  _cashBase: number;
  _cashTip: number;
  _cashAmount: number;
  _cashDeposits: CashMovementLink[];
  _cashLinked: number;
  _cashPending: number;
}

interface CashLinkResult {
  success: boolean;
  error?: string;
}

interface ArqueoEfectivoSubTabProps {
  ticketsMes: CashTicket[];
  depositosBbvaMes: CashDeposit[];
  selectedMonth: string;
  cashDepositPeriods: Record<string, 'anterior' | 'actual' | 'siguiente'>;
  setCashDepositPeriod?: (movementId: string, period: 'anterior' | 'actual' | 'siguiente') => void;
  esMovimientoEfectivo: (concepto: string) => boolean;
  vincularComprobante?: (comprobanteId: string, movimientoId: string, montoAsociado?: number) => Promise<CashLinkResult>;
  desvincularComprobante?: (comprobanteId: string, movimientoId?: string) => Promise<CashLinkResult>;
  formatCurrency: (val: number | string | null | undefined) => string;
}

export const ArqueoEfectivoSubTab: React.FC<ArqueoEfectivoSubTabProps> = ({
  ticketsMes,
  depositosBbvaMes,
  selectedMonth,
  cashDepositPeriods,
  setCashDepositPeriod,
  esMovimientoEfectivo,
  vincularComprobante,
  desvincularComprobante,
  formatCurrency,
}) => {
  const [ticketToLink, setTicketToLink] = React.useState<CashTicketRow | null>(null);
  const [selectedDepositIds, setSelectedDepositIds] = React.useState<Set<string>>(new Set());
  const [savingLinks, setSavingLinks] = React.useState(false);

  const cashDeposits = React.useMemo(() => depositosBbvaMes.filter(deposit =>
    !deposit._isNoVenta && esMovimientoEfectivo(deposit.concepto || '')
  ), [depositosBbvaMes, esMovimientoEfectivo]);

  const periodForDeposit = React.useCallback((deposit: CashDeposit) =>
    cashDepositPeriods[deposit.id] || (deposit._isOtherMonth ? 'anterior' : 'actual'),
  [cashDepositPeriods]);

  const currentCashDeposits = React.useMemo(
    () => cashDeposits.filter(deposit => periodForDeposit(deposit) === 'actual'),
    [cashDeposits, periodForDeposit]
  );
  const previousCashDeposits = React.useMemo(
    () => cashDeposits.filter(deposit => periodForDeposit(deposit) === 'anterior'),
    [cashDeposits, periodForDeposit]
  );
  const nextCashDeposits = React.useMemo(
    () => cashDeposits.filter(deposit => periodForDeposit(deposit) === 'siguiente'),
    [cashDeposits, periodForDeposit]
  );

  const cashTickets = React.useMemo<CashTicketRow[]>(() => ticketsMes
    .map(ticket => {
      const cashBase = Number(ticket.monto_efectivo || 0);
      const cashTip = Number(ticket.propina_efectivo || 0);
      const cashAmount = cashBase + cashTip;
      const associatedCashDeposits = (ticket._associatedMovs || []).filter(movement =>
        currentCashDeposits.some(deposit => deposit.id === movement.id) &&
        esMovimientoEfectivo(movement.concepto || '')
      );
      const linkedAmount = associatedCashDeposits.reduce(
        (sum, movement) => sum + Number(movement.montoAsociado || 0),
        0
      );
      return {
        ...ticket,
        _cashBase: cashBase,
        _cashTip: cashTip,
        _cashAmount: cashAmount,
        _cashDeposits: associatedCashDeposits,
        _cashLinked: linkedAmount,
        _cashPending: Math.max(0, cashAmount - linkedAmount),
      };
    })
    .filter(ticket => ticket._cashAmount > 0)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))),
  [ticketsMes, currentCashDeposits, esMovimientoEfectivo]);

  const dailyCashGroups = React.useMemo(() => {
    const groups = new Map<string, { fecha: string; tickets: CashTicketRow[]; base: number; propina: number; venta: number; ligado: number; pendiente: number }>();
    cashTickets.forEach(ticket => {
      const fecha = String(ticket.fecha || '').slice(0, 10) || 'Sin fecha';
      const group = groups.get(fecha) || { fecha, tickets: [], base: 0, propina: 0, venta: 0, ligado: 0, pendiente: 0 };
      group.tickets.push(ticket);
      group.base += ticket._cashBase;
      group.propina += ticket._cashTip;
      group.venta += ticket._cashAmount;
      group.ligado += ticket._cashLinked;
      group.pendiente += ticket._cashPending;
      groups.set(fecha, group);
    });
    return Array.from(groups.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [cashTickets]);

  const depositoDisponible = (deposit: CashDeposit) => {
    const montoAsociado = (deposit._cdms || []).reduce((sum, relation) => {
      const amount = relation.monto_asociado ?? relation.comprobantes_deposito?.monto ?? 0;
      return sum + Number(amount || 0);
    }, 0);
    return Math.max(0, Number(deposit._monto || 0) - montoAsociado);
  };

  const cashTotal = cashTickets.reduce((sum, ticket) => sum + ticket._cashAmount, 0);
  const cashLinkedTotal = cashTickets.reduce((sum, ticket) => sum + ticket._cashLinked, 0);
  const cashDepositTotal = currentCashDeposits.reduce((sum, deposit) => sum + Number(deposit._monto || 0), 0);
  const cashPreviousMonthTotal = previousCashDeposits.reduce((sum, deposit) => sum + Number(deposit._monto || 0), 0);
  const cashNextMonthTotal = nextCashDeposits.reduce((sum, deposit) => sum + Number(deposit._monto || 0), 0);
  const cashUnassignedTotal = currentCashDeposits.reduce((sum, deposit) => sum + depositoDisponible(deposit), 0);
  const cashNotDeposited = Math.max(0, cashTotal - cashLinkedTotal - cashUnassignedTotal);
  const selectedAllocations: Array<{ deposit: CashDeposit; amount: number }> = [];
  if (ticketToLink) {
    let pending = Number(ticketToLink._cashPending || 0);
    Array.from(selectedDepositIds).forEach(id => {
      const deposit = currentCashDeposits.find(item => item.id === id);
      const amount = deposit ? Math.min(pending, depositoDisponible(deposit)) : 0;
      pending -= amount;
      if (deposit && amount > 0) selectedAllocations.push({ deposit, amount });
    });
  }
  const monthWithOffset = (offset: number) => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) return selectedMonth || 'Mes';
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return date.toISOString().slice(0, 7);
  };

  const openLinkDialog = (ticket: CashTicketRow) => {
    setTicketToLink(ticket);
    setSelectedDepositIds(new Set());
  };

  const saveLinks = async () => {
    if (!ticketToLink || !vincularComprobante || selectedAllocations.length === 0) return;
    setSavingLinks(true);
    try {
      for (const allocation of selectedAllocations) {
        const result = await vincularComprobante(
          ticketToLink.id,
          allocation.deposit.id,
          Number(allocation.amount.toFixed(2))
        );
        if (!result?.success) throw new Error(result?.error || 'No se pudo guardar el vínculo.');
      }
      setTicketToLink(null);
      setSelectedDepositIds(new Set());
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : 'No se pudieron guardar los vínculos.');
    } finally {
      setSavingLinks(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">Venta efectivo Parrot</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashTotal)}</strong>
          <span className="text-[9px] text-gray-500">Base {formatCurrency(cashTickets.reduce((sum, ticket) => sum + ticket._cashBase, 0))} + propinas {formatCurrency(cashTickets.reduce((sum, ticket) => sum + ticket._cashTip, 0))}</span>
        </div>
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20">
          <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300">Depósitos de {monthWithOffset(0)}</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashDepositTotal)}</strong>
        </div>
        <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20">
          <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Vinculado a tickets</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashLinkedTotal)}</strong>
        </div>
        <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20">
          <span className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-300">Saldo sin asignar · mes actual</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashUnassignedTotal)}</strong>
        </div>
        <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/60 dark:bg-purple-950/20">
          <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300">Arrastre · {monthWithOffset(-1)}</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashPreviousMonthTotal)}</strong>
        </div>
        <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/20">
          <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300">Para · {monthWithOffset(1)}</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashNextMonthTotal)}</strong>
        </div>
        <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20">
          <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300">Sin depósito BBVA disponible</span>
          <strong className="block text-lg font-black font-mono mt-1">{formatCurrency(cashNotDeposited)}</strong>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h5 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200">Conciliación diaria: efectivo Parrot → depósitos BBVA</h5>
            <p className="text-[10px] text-gray-500 mt-0.5">Vincula cada ticket con el depósito que recibió ese efectivo. Se admite un depósito para varios tickets y varios depósitos para un ticket.</p>
          </div>
          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300">Sin conciliar: {formatCurrency(Math.max(0, cashTotal - cashLinkedTotal))}</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3">Día / Ticket Parrot</th>
                <th className="p-3 text-right">Efectivo base</th>
                <th className="p-3 text-right">Propina efectivo</th>
                <th className="p-3 text-right">Total efectivo</th>
                <th className="p-3 text-right">Depósitos vinculados</th>
                <th className="p-3 text-right">Por conciliar</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {dailyCashGroups.map(day => (
                <React.Fragment key={day.fecha}>
                  <tr className="bg-amber-50/50 dark:bg-amber-950/10 font-black">
                    <td className="p-3 text-amber-800 dark:text-amber-300">{day.fecha} · Total del día ({day.tickets.length} ticket{day.tickets.length === 1 ? '' : 's'})</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(day.base)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(day.propina)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(day.venta)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600">{formatCurrency(day.ligado)}</td>
                    <td className="p-3 text-right font-mono text-amber-600">{formatCurrency(day.pendiente)}</td>
                    <td />
                  </tr>
                  {day.tickets.map(ticket => (
                    <tr key={ticket.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30">
                      <td className="p-3 pl-6 text-gray-700 dark:text-gray-300">{ticket.descripcion || `Corte Parrot ${day.fecha}`}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(ticket._cashBase)}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(ticket._cashTip)}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(ticket._cashAmount)}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{formatCurrency(ticket._cashLinked)}</td>
                      <td className="p-3 text-right font-mono text-amber-600">{formatCurrency(ticket._cashPending)}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => openLinkDialog(ticket)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[10px] font-bold cursor-pointer"
                        >
                          <Link2 size={12} /> Vincular depósito
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {dailyCashGroups.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic">No hay tickets Parrot con efectivo en el período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
          <h5 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200">Detalle y período de los depósitos de efectivo</h5>
          <p className="text-[10px] text-gray-500 mt-0.5">Clasifica a qué mes pertenecen las ventas cubiertas por cada abono. Solo aparecen movimientos de efectivo, no pagos con tarjeta.</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[700px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase">
                <th className="p-3">Fecha depósito</th>
                <th className="p-3">Concepto</th>
                <th className="p-3 text-right">Monto</th>
                <th className="p-3 text-right">Saldo sin asignar</th>
                <th className="p-3">Mes de las ventas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {cashDeposits.map(deposit => (
                <tr key={deposit.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30">
                  <td className="p-3 font-mono">{String(deposit.fecha || '').slice(0, 10)}</td>
                  <td className="p-3 max-w-[360px] truncate" title={deposit.concepto}>{deposit.concepto || 'Depósito efectivo BBVA'}</td>
                  <td className="p-3 text-right font-mono font-bold">{formatCurrency(deposit._monto)}</td>
                  <td className="p-3 text-right font-mono text-sky-700 dark:text-sky-300">{formatCurrency(depositoDisponible(deposit))}</td>
                  <td className="p-3">
                    <select
                      value={periodForDeposit(deposit)}
                      onChange={event => setCashDepositPeriod?.(deposit.id, event.target.value as 'anterior' | 'actual' | 'siguiente')}
                      className="max-w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-[11px] font-bold"
                      aria-label={`Mes al que corresponden las ventas del depósito ${deposit.concepto || deposit.id}`}
                    >
                      <option value="anterior">Mes anterior · {monthWithOffset(-1)}</option>
                      <option value="actual">Este mes · {monthWithOffset(0)}</option>
                      <option value="siguiente">Mes siguiente · {monthWithOffset(1)}</option>
                    </select>
                  </td>
                </tr>
              ))}
              {cashDeposits.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">No hay depósitos de efectivo BBVA en el período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {ticketToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60" role="dialog" aria-modal="true" aria-label="Vincular ticket Parrot a depósitos BBVA">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2"><Link2 size={16} className="text-blue-600" /> Vincular efectivo Parrot con depósito BBVA</h4>
                <p className="text-xs text-gray-500 mt-1">{ticketToLink.descripcion || 'Ticket Parrot'} · {String(ticketToLink.fecha || '').slice(0, 10)} · Efectivo: <strong>{formatCurrency(ticketToLink._cashAmount)}</strong></p>
              </div>
              <button type="button" onClick={() => setTicketToLink(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cerrar"><X size={17} /></button>
            </div>
            <div className="p-4 overflow-auto space-y-4">
              <div>
                <h5 className="text-[10px] font-black uppercase text-gray-500 mb-2">Depósitos ya vinculados a este ticket</h5>
                <div className="space-y-1.5">
                  {ticketToLink._cashDeposits.map(deposit => (
                    <div key={deposit.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                      <span className="min-w-0 text-xs truncate">{String(deposit.fecha || '').slice(0, 10)} · {deposit.concepto}</span>
                      <span className="flex items-center gap-2 shrink-0 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(deposit.montoAsociado)}
                        {desvincularComprobante && <button type="button" title="Desvincular" onClick={async () => {
                          if (window.confirm('¿Desvincular este depósito de efectivo del ticket?')) {
                            await desvincularComprobante(ticketToLink.id, deposit.id);
                            setTicketToLink(null);
                          }
                        }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"><Unlink size={13} /></button>}
                      </span>
                    </div>
                  ))}
                  {ticketToLink._cashDeposits.length === 0 && <p className="text-xs text-gray-400 italic">Aún no hay depósitos ligados a este ticket.</p>}
                </div>
              </div>
              <div>
                <div className="flex justify-between gap-3 text-xs mb-2">
                  <h5 className="text-[10px] font-black uppercase text-gray-500">Depósitos BBVA de efectivo disponibles</h5>
                  <span className="font-mono text-amber-700 dark:text-amber-300">Pendiente del ticket: {formatCurrency(ticketToLink._cashPending)}</span>
                </div>
                <div className="max-h-64 overflow-auto divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg">
                  {currentCashDeposits.filter(deposit =>
                    !ticketToLink._cashDeposits.some(linked => linked.id === deposit.id) && depositoDisponible(deposit) > 0
                  ).map(deposit => {
                    const isSelected = selectedDepositIds.has(deposit.id);
                    const allocation = selectedAllocations.find(item => item.deposit?.id === deposit.id)?.amount || 0;
                    return (
                      <label key={deposit.id} className={`p-3 flex items-center gap-3 cursor-pointer ${isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => setSelectedDepositIds(previous => {
                          const next = new Set(previous);
                          if (next.has(deposit.id)) next.delete(deposit.id);
                          else next.add(deposit.id);
                          return next;
                        })} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold truncate">{deposit.concepto || 'Depósito efectivo'}</span>
                          <span className="block text-[10px] text-gray-500">{String(deposit.fecha || '').slice(0, 10)} · Saldo disponible {formatCurrency(depositoDisponible(deposit))}</span>
                        </span>
                        <span className="text-right font-mono text-xs font-black">{formatCurrency(deposit._monto)}{allocation > 0 && <span className="block text-[10px] text-blue-600">Asignar {formatCurrency(allocation)}</span>}</span>
                      </label>
                    );
                  })}
                  {currentCashDeposits.filter(deposit =>
                    !ticketToLink._cashDeposits.some(linked => linked.id === deposit.id) && depositoDisponible(deposit) > 0
                  ).length === 0 && <p className="p-5 text-center text-xs text-gray-400">No hay depósitos de efectivo BBVA disponibles para asignar.</p>}
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <span className="text-[10px] text-gray-500">Se asignará hasta cubrir el efectivo pendiente, respetando el saldo libre de cada depósito.</span>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => setTicketToLink(null)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-bold">Cerrar</button>
                <button type="button" onClick={saveLinks} disabled={savingLinks || selectedAllocations.length === 0} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
                  {savingLinks ? 'Guardando…' : `Guardar ${selectedAllocations.length} vínculo${selectedAllocations.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ALERTA VISUAL DE FALTANTE */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-4 ${
        cashNotDeposited > 0
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          {cashNotDeposited > 0 ? (
            <AlertTriangle className="text-amber-500 w-8 h-8 shrink-0" />
          ) : (
            <CheckCircle2 className="text-emerald-500 w-8 h-8 shrink-0" />
          )}
          <div>
            <h5 className="text-sm font-black uppercase tracking-wide">
              {cashNotDeposited > 0
                ? `⚠️ Falta por depositar (sin depósito BBVA disponible): ${formatCurrency(cashNotDeposited)}`
                : '✅ Los depósitos BBVA registrados cubren el efectivo del período'}
            </h5>
            <p className="text-xs opacity-90 mt-0.5">
              Efectivo Parrot con propinas: <strong>{formatCurrency(cashTotal)}</strong> | Vinculado: <strong>{formatCurrency(cashLinkedTotal)}</strong> | Depósitos BBVA aún sin asignar: <strong>{formatCurrency(cashUnassignedTotal)}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* TABLA CRONOLÓGICA DÍA POR DÍA DE EFECTIVO */}
    </div>
  );
};
